// BeetFit API — Cloudflare Worker.
//   GET  /api/health
//   GET  /api/food/barcode/:code   Open Food Facts product → normalized per-100 g macros (cached 7 days)
//   GET  /api/food/search?q=       Open Food Facts text search (+ USDA FoodData Central when USDA_API_KEY is set)
//   POST /api/snap                 JPEG body → Gemini vision → [{ name, grams, kcal, p, c, f, confidence }]
//
// Every /api/* call except /health must carry the Telegram Mini App initData in `X-Telegram-Init-Data`.
// The Worker verifies its HMAC with BOT_TOKEN, so only people who opened the app from your bot can spend
// your Gemini quota. Set ALLOW_UNSIGNED=1 only for local `wrangler dev`.

const OFF = 'https://world.openfoodfacts.org'
const UA = 'BeetFit/0.2 (https://t.me/beetfit_bot)' // OFF asks for AppName/Version (contact)
const SNAP_DAILY_LIMIT = 30

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url)
    const cors = corsHeaders(req, env)
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    try {
      if (url.pathname === '/api/health') return json({ ok: true, gemini: !!env.GEMINI_API_KEY, usda: !!env.USDA_API_KEY }, 200, cors)

      const user = await authenticate(req, env)
      if (!user) return json({ error: 'unauthorized' }, 401, cors)

      const bc = url.pathname.match(/^\/api\/food\/barcode\/(\d{6,14})$/)
      if (bc && req.method === 'GET') return withCache(req, ctx, 60 * 60 * 24 * 7, () => barcode(bc[1]), cors)

      if (url.pathname === '/api/food/search' && req.method === 'GET') {
        const q = (url.searchParams.get('q') || '').trim().slice(0, 80)
        if (q.length < 2) return json({ items: [] }, 200, cors)
        return withCache(req, ctx, 60 * 60 * 24, () => search(q, env), cors)
      }

      if (url.pathname === '/api/snap' && req.method === 'POST') {
        if (!env.GEMINI_API_KEY) return json({ error: 'snap_not_configured' }, 503, cors)
        if (!(await underLimit(env, `snap:${user.id}`, SNAP_DAILY_LIMIT))) return json({ error: 'daily_limit' }, 429, cors)
        const buf = await req.arrayBuffer()
        if (!buf.byteLength || buf.byteLength > 4 * 1024 * 1024) return json({ error: 'bad_image' }, 400, cors)
        const result = await snap(buf, req.headers.get('content-type') || 'image/jpeg', env)
        return json(result, 200, cors)
      }
      return json({ error: 'not_found' }, 404, cors)
    } catch (e) {
      return json({ error: 'server_error', detail: String(e?.message || e).slice(0, 200) }, 502, cors)
    }
  }
}

// ---------- Open Food Facts ----------

function normalizeOff(p, code) {
  const n = p.nutriments || {}
  const kcal = n['energy-kcal_100g'] ?? (n['energy_100g'] != null ? n['energy_100g'] / 4.184 : null)
  if (kcal == null) return null
  const servingG = parseFloat(String(p.serving_size || '').match(/([\d.]+)\s*g/i)?.[1]) || null
  return {
    source: 'off',
    code: code || p.code,
    name: p.product_name || p.generic_name || 'Unnamed product',
    brand: (p.brands || '').split(',')[0].trim() || null,
    image: p.image_front_small_url || null,
    per100: { kcal: Math.round(kcal), p: r1(n.proteins_100g), c: r1(n.carbohydrates_100g), f: r1(n.fat_100g) },
    servingG
  }
}

async function barcode(code) {
  const fields = 'code,product_name,generic_name,brands,nutriments,serving_size,image_front_small_url'
  const res = await fetch(`${OFF}/api/v2/product/${code}.json?fields=${fields}`, { headers: { 'User-Agent': UA } })
  if (res.status === 404) return json({ found: false, code }, 404)
  if (!res.ok) throw new Error(`off ${res.status}`)
  const data = await res.json()
  const item = data.status === 1 ? normalizeOff(data.product, code) : null
  return item ? json({ found: true, item }) : json({ found: false, code }, 404)
}

async function search(q, env) {
  const offP = fetch(`${OFF}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&json=1&page_size=12&fields=code,product_name,brands,nutriments,serving_size,image_front_small_url`,
    { headers: { 'User-Agent': UA } })
    .then(r => (r.ok ? r.json() : { products: [] }))
    .then(d => (d.products || []).map(p => normalizeOff(p)).filter(Boolean))
    .catch(() => [])
  const usdaP = env.USDA_API_KEY
    ? fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${env.USDA_API_KEY}&query=${encodeURIComponent(q)}&pageSize=8&dataType=Foundation,SR%20Legacy`)
        .then(r => (r.ok ? r.json() : { foods: [] }))
        .then(d => (d.foods || []).map(normalizeUsda).filter(Boolean))
        .catch(() => [])
    : Promise.resolve([])
  const [usda, off] = await Promise.all([usdaP, offP])
  return json({ items: [...usda, ...off].slice(0, 16) })
}

function normalizeUsda(f) {
  const get = id => f.foodNutrients?.find(n => n.nutrientId === id || n.nutrientNumber === String(id))?.value
  const kcal = get(1008) ?? get(208)
  if (kcal == null) return null
  return { source: 'usda', code: `fdc:${f.fdcId}`, name: f.description, brand: null, image: null,
    per100: { kcal: Math.round(kcal), p: r1(get(1003) ?? get(203)), c: r1(get(1005) ?? get(205)), f: r1(get(1004) ?? get(204)) }, servingG: null }
}

// ---------- Gemini meal recognition ----------

const SNAP_PROMPT = `You are a nutrition assistant. Identify every distinct food or drink visible in this photo.
For each item estimate the portion in grams (or ml for drinks, treat 1 ml = 1 g) and its total kcal, protein, carbs and fat for that portion.
Use typical restaurant/home recipes when ingredients are hidden. Set confidence 0–1 for how sure you are about the portion size.
Title: 2–4 words describing the plate, lowercase, e.g. "chicken & rice". If there is no food, return an empty items list.`

const SNAP_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' }, grams: { type: 'NUMBER' }, kcal: { type: 'NUMBER' },
          p: { type: 'NUMBER' }, c: { type: 'NUMBER' }, f: { type: 'NUMBER' }, confidence: { type: 'NUMBER' }
        },
        required: ['name', 'grams', 'kcal', 'p', 'c', 'f', 'confidence']
      }
    }
  },
  required: ['title', 'items']
}

async function snap(buf, mimeType, env) {
  const model = env.GEMINI_MODEL || 'gemini-2.5-flash'
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ inlineData: { mimeType, data: toBase64(buf) } }, { text: SNAP_PROMPT }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: SNAP_SCHEMA, temperature: 0.2 }
    })
  })
  if (res.status === 429) throw new Error('gemini_rate_limited')
  if (!res.ok) throw new Error(`gemini ${res.status}`)
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '{}'
  const out = JSON.parse(text)
  const items = (out.items || []).slice(0, 8).map(i => ({
    name: String(i.name).slice(0, 60),
    grams: Math.max(1, Math.round(i.grams)),
    kcal: Math.max(0, Math.round(i.kcal)),
    p: r1(i.p), c: r1(i.c), f: r1(i.f),
    confidence: Math.max(0, Math.min(1, +i.confidence || 0))
  }))
  return { title: String(out.title || '').slice(0, 40), items, model }
}

// ---------- Telegram initData verification ----------
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app

async function authenticate(req, env) {
  const raw = req.headers.get('x-telegram-init-data') || ''
  if (!raw) return env.ALLOW_UNSIGNED === '1' ? { id: 'dev' } : null
  if (!env.BOT_TOKEN) return null
  const params = new URLSearchParams(raw)
  const hash = params.get('hash')
  if (!hash) return null
  params.delete('hash')
  const dataCheck = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n')
  const secret = await hmac(new TextEncoder().encode('WebAppData'), env.BOT_TOKEN)
  const sig = hex(await hmac(secret, dataCheck))
  if (!timingSafeEqual(sig, hash)) return null
  const authDate = +params.get('auth_date')
  if (!authDate || Date.now() / 1000 - authDate > 60 * 60 * 24) return null
  try { return JSON.parse(params.get('user') || '{}') } catch { return null }
}

async function hmac(keyBytes, msg) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg)))
}

// ---------- helpers ----------

async function underLimit(env, key, max) {
  if (!env.RATE) return true // KV not bound → no per-user cap (Gemini's own quota still applies)
  const k = `${key}:${new Date().toISOString().slice(0, 10)}`
  const n = +(await env.RATE.get(k)) || 0
  if (n >= max) return false
  await env.RATE.put(k, String(n + 1), { expirationTtl: 60 * 60 * 26 })
  return true
}

async function withCache(req, ctx, ttl, produce, cors) {
  const cache = caches.default
  const key = new Request(new URL(req.url).toString(), { method: 'GET' }) // cache key ignores auth header
  const hit = await cache.match(key)
  if (hit) return addHeaders(hit, cors)
  const res = await produce()
  if (res.status === 200 || res.status === 404) {
    const copy = new Response(res.clone().body, res)
    copy.headers.set('cache-control', `public, max-age=${res.status === 200 ? ttl : 3600}`)
    ctx.waitUntil(cache.put(key, copy))
  }
  return addHeaders(res, cors)
}

function corsHeaders(req, env) {
  const origin = req.headers.get('origin') || ''
  const allowed = (env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim())
  const ok = allowed.includes('*') || allowed.includes(origin)
  return {
    'access-control-allow-origin': ok ? origin || '*' : allowed[0],
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,x-telegram-init-data',
    'access-control-max-age': '86400',
    vary: 'origin'
  }
}

function addHeaders(res, extra) {
  const r = new Response(res.body, res)
  for (const [k, v] of Object.entries(extra)) r.headers.set(k, v)
  return r
}

function json(obj, status = 200, headers = {}) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } })
}

function toBase64(buf) {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

const hex = b => [...b].map(x => x.toString(16).padStart(2, '0')).join('')
const r1 = v => (v == null || isNaN(v) ? 0 : Math.round(v * 10) / 10)
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

export { authenticate, normalizeOff, normalizeUsda }
