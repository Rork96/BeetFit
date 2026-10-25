// BeetFit — one Cloudflare Worker serves the web app (static assets from ../dist) and the API.
//   POST /api/device               issue a signed per-install token (no account needed)
//   GET  /api/health
//   GET  /api/food/barcode/:code   Open Food Facts product → normalized per-100 g macros (cached 7 days)
//   GET  /api/food/search?q=       Open Food Facts text search (+ USDA FoodData Central when USDA_API_KEY is set)
//   POST /api/snap                 JPEG body → Gemini vision → [{ name, grams, kcal, p, c, f, confidence }]
//   everything else                → static assets (SPA fallback to index.html)
//
// /api/food/* and /api/snap need `Authorization: Bearer <device token>`. Tokens are HMAC-signed with
// DEVICE_SECRET, so they can't be forged; KV (binding RATE) caps token issue per IP and photos per device.
// Set ALLOW_UNSIGNED=1 only for local `wrangler dev`.

const OFF = 'https://world.openfoodfacts.org'
const UA = 'BeetFit/0.3 (https://beetfit.wealthifai.xyz)' // OFF asks for AppName/Version (contact)
const SNAP_DAILY_LIMIT = 30      // per device
const SNAP_IP_DAILY_LIMIT = 80   // per IP, stops token farming
const DEVICE_IP_DAILY_LIMIT = 10 // new tokens per IP per day

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url)
    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS ? env.ASSETS.fetch(req) : new Response('Not found', { status: 404 })
    }
    const cors = corsHeaders(req, env)
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    const ip = req.headers.get('cf-connecting-ip') || 'local'
    try {
      if (url.pathname === '/api/health') {
        const out = { ok: true, device: !!env.DEVICE_SECRET, sync: !!env.DB, gemini: !!env.GEMINI_API_KEY, usda: !!env.USDA_API_KEY, kv: !!env.RATE, model: env.GEMINI_MODEL || 'gemini-2.5-flash' }
        // ?check=gemini makes one tiny real call so a bad key or retired model shows up here. Cached 5 min.
        if (url.searchParams.get('check') === 'gemini' && env.GEMINI_API_KEY) {
          return withCache(new Request(url.origin + '/api/health?check=gemini'), ctx, 300, async () => json({ ...out, geminiCheck: await geminiPing(env) }), cors)
        }
        return json(out, 200, { ...cors, 'cache-control': 'no-store' })
      }

      if (url.pathname === '/api/device' && req.method === 'POST') {
        if (!env.DEVICE_SECRET) return json({ error: 'not_configured' }, 503, cors)
        if (!(await underLimit(env, `dev:${ip}`, DEVICE_IP_DAILY_LIMIT))) return json({ error: 'daily_limit' }, 429, cors)
        return json({ token: await issueToken(env.DEVICE_SECRET) }, 200, { ...cors, 'cache-control': 'no-store' })
      }

      const device = await authenticate(req, env)
      if (!device) return json({ error: 'unauthorized' }, 401, cors)

      const bc = url.pathname.match(/^\/api\/food\/barcode\/(\d{6,14})$/)
      if (bc && req.method === 'GET') return withCache(req, ctx, 60 * 60 * 24 * 7, () => barcode(bc[1]), cors)

      if (url.pathname === '/api/food/search' && req.method === 'GET') {
        const q = (url.searchParams.get('q') || '').trim().slice(0, 80)
        if (q.length < 2) return json({ items: [] }, 200, cors)
        return withCache(req, ctx, 60 * 60 * 24, () => search(q, env), cors)
      }

      if (url.pathname === '/api/snap' && req.method === 'POST') {
        if (!env.GEMINI_API_KEY) return json({ error: 'snap_not_configured' }, 503, cors)
        if (!(await underLimit(env, `snapip:${ip}`, SNAP_IP_DAILY_LIMIT)) || !(await underLimit(env, `snap:${device.id}`, SNAP_DAILY_LIMIT))) {
          return json({ error: 'daily_limit' }, 429, cors)
        }
        const buf = await req.arrayBuffer()
        if (!buf.byteLength || buf.byteLength > 4 * 1024 * 1024) return json({ error: 'bad_image' }, 400, cors)
        const result = await snap(buf, req.headers.get('content-type') || 'image/jpeg', env)
        return json(result, 200, cors)
      }
      if (url.pathname.startsWith('/api/sync') || url.pathname.startsWith('/api/pair')) {
        if (!env.DB) return json({ error: 'sync_not_configured' }, 503, cors)
        return await syncRoutes(req, url, env, device, ip, cors)
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
  const servingG = Math.round(parseFloat(String(p.serving_size || '').match(/([\d.]+)\s*g/i)?.[1])) || null
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

async function geminiPing(env) {
  const model = env.GEMINI_MODEL || 'gemini-2.5-flash'
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with the single word: ok' }] }], generationConfig: { maxOutputTokens: 5 } })
    })
    if (res.ok) return { ok: true, status: 200 }
    const body = await res.json().catch(() => ({}))
    return { ok: false, status: res.status, error: String(body.error?.message || '').slice(0, 200) }
  } catch (e) {
    return { ok: false, status: 0, error: String(e?.message || e).slice(0, 200) }
  }
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
  if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 160)}`)
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

// ---------- device tokens ----------
// token = <uuid>.<issued unix>.<base64url HMAC-SHA256(secret, "<uuid>.<issued>")>

async function issueToken(secret) {
  const body = `${crypto.randomUUID()}.${Math.floor(Date.now() / 1000)}`
  return `${body}.${b64url(await hmac(new TextEncoder().encode(secret), body))}`
}

async function authenticate(req, env) {
  const raw = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!raw) return env.ALLOW_UNSIGNED === '1' ? { id: 'dev' } : null
  if (!env.DEVICE_SECRET) return null
  const parts = raw.split('.')
  if (parts.length !== 3) return null
  const [id, ts, sig] = parts
  if (!/^[0-9a-f-]{36}$/.test(id) || !/^\d{9,11}$/.test(ts)) return null
  const want = b64url(await hmac(new TextEncoder().encode(env.DEVICE_SECRET), `${id}.${ts}`))
  return timingSafeEqual(want, sig) ? { id } : null
}

async function hmac(keyBytes, msg) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg)))
}

// ---------- sync (Cloudflare D1) ----------
// One JSON document per user. Devices map to users; a 6-digit pairing code links a new device to an
// existing user. Optimistic concurrency: PUT carries the rev it was based on, a stale rev gets 409 + server copy.

const MAX_DOC = 900 * 1024
let schemaReady = false

async function ensureSchema(db) {
  if (schemaReady) return
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS devices (device_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, created INTEGER NOT NULL, seen INTEGER)'),
    db.prepare('CREATE TABLE IF NOT EXISTS docs (user_id TEXT PRIMARY KEY, data TEXT NOT NULL, rev INTEGER NOT NULL, updated INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS pairs (code TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires INTEGER NOT NULL)')
  ])
  schemaReady = true
}

async function userOf(db, deviceId) {
  const row = await db.prepare('SELECT user_id FROM devices WHERE device_id = ?').bind(deviceId).first()
  const now = Date.now()
  if (row) { await db.prepare('UPDATE devices SET seen = ? WHERE device_id = ?').bind(now, deviceId).run(); return row.user_id }
  const userId = crypto.randomUUID()
  await db.prepare('INSERT INTO devices (device_id, user_id, created, seen) VALUES (?, ?, ?, ?)').bind(deviceId, userId, now, now).run()
  return userId
}

async function readDoc(db, userId) {
  const row = await db.prepare('SELECT data, rev, updated FROM docs WHERE user_id = ?').bind(userId).first()
  const devices = (await db.prepare('SELECT COUNT(*) AS n FROM devices WHERE user_id = ?').bind(userId).first())?.n || 1
  return row ? { rev: row.rev, updated: row.updated, data: JSON.parse(row.data), devices } : { rev: 0, updated: 0, data: null, devices }
}

async function syncRoutes(req, url, env, device, ip, cors) {
  const db = env.DB
  await ensureSchema(db)
  const userId = await userOf(db, device.id)

  if (url.pathname === '/api/sync' && req.method === 'GET') return json(await readDoc(db, userId), 200, { ...cors, 'cache-control': 'no-store' })

  if (url.pathname === '/api/sync' && req.method === 'PUT') {
    const raw = await req.text()
    if (raw.length > MAX_DOC) return json({ error: 'too_large' }, 413, cors)
    let body
    try { body = JSON.parse(raw) } catch { return json({ error: 'bad_json' }, 400, cors) }
    if (!body || typeof body.data !== 'object' || !Number.isInteger(body.baseRev)) return json({ error: 'bad_request' }, 400, cors)
    const cur = await readDoc(db, userId)
    if (cur.rev !== body.baseRev) return json({ error: 'conflict', ...cur }, 409, cors)
    const rev = cur.rev + 1, now = Date.now()
    const res = await db.prepare(
      'INSERT INTO docs (user_id, data, rev, updated) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(user_id) DO UPDATE SET data = ?2, rev = ?3, updated = ?4 WHERE docs.rev = ?5'
    ).bind(userId, JSON.stringify(body.data), rev, now, cur.rev).run()
    if (!res.meta.changes) return json({ error: 'conflict', ...(await readDoc(db, userId)) }, 409, cors)
    return json({ rev, updated: now, devices: cur.devices }, 200, cors)
  }

  if (url.pathname === '/api/pair' && req.method === 'POST') {
    if (!(await underLimit(env, `paircreate:${userId}`, 20))) return json({ error: 'daily_limit' }, 429, cors)
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0')
    const expires = Date.now() + 10 * 60 * 1000
    await db.batch([
      db.prepare('DELETE FROM pairs WHERE user_id = ? OR expires < ?').bind(userId, Date.now()),
      db.prepare('INSERT OR REPLACE INTO pairs (code, user_id, expires) VALUES (?, ?, ?)').bind(code, userId, expires)
    ])
    return json({ code, expires }, 200, cors)
  }

  if (url.pathname === '/api/pair/claim' && req.method === 'POST') {
    // 10 tries per IP per day: guessing 1 of 1,000,000 codes in a 10-minute window is not practical.
    if (!(await underLimit(env, `pairclaim:${ip}`, 10))) return json({ error: 'too_many_tries' }, 429, cors)
    const { code } = await req.json().catch(() => ({}))
    if (!/^\d{6}$/.test(code || '')) return json({ error: 'bad_code' }, 400, cors)
    const pair = await db.prepare('SELECT user_id, expires FROM pairs WHERE code = ?').bind(code).first()
    if (!pair || pair.expires < Date.now()) return json({ error: 'bad_code' }, 404, cors)
    if (pair.user_id === userId) return json({ error: 'same_device' }, 400, cors)
    await db.batch([
      db.prepare('UPDATE devices SET user_id = ? WHERE device_id = ?').bind(pair.user_id, device.id),
      db.prepare('DELETE FROM pairs WHERE code = ?').bind(code)
    ])
    return json(await readDoc(db, pair.user_id), 200, cors)
  }

  if (url.pathname === '/api/sync/leave' && req.method === 'POST') {
    // Unlink this device: it gets a fresh empty user next time.
    await db.prepare('DELETE FROM devices WHERE device_id = ?').bind(device.id).run()
    return json({ ok: true }, 200, cors)
  }

  return json({ error: 'not_found' }, 404, cors)
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
  const key = new Request(new URL(req.url).toString(), { method: 'GET' }) // cache key ignores the token
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
    'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
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

const b64url = b => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const r1 = v => (v == null || isNaN(v) ? 0 : Math.round(v * 10) / 10)
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

export { authenticate, issueToken, normalizeOff, normalizeUsda }
