// BeetFit — one Cloudflare Worker serves the web app (static assets from ../dist) and the API.
//   POST /api/device               issue a signed per-install token (no account needed)
//   GET  /api/health
//   GET  /api/food/barcode/:code   Open Food Facts product → normalized per-100 g macros (cached 7 days)
//   GET  /api/food/search?q=       Open Food Facts text search (+ USDA FoodData Central when USDA_API_KEY is set)
//   POST /api/snap                 JPEG body → Gemini vision → [{ name, grams, kcal, p, c, f, confidence }]
//   /api/sync, /api/pair           cross-device sync (D1), 6-digit pairing codes
//   /api/auth/*                    accounts: email code, Google, Apple; sign out; delete account
//   /api/coach/*                   coach mode: invite codes, client overview, messages, target overrides
//   /api/push/*                    Web Push subscriptions; a 15-minute cron sends daily reminders
//   POST /api/chat                 Beet, the in-app assistant (Gemini)
//   everything else                → static assets (SPA fallback to index.html)
//
// /api/food/* and /api/snap need `Authorization: Bearer <device token>`. Tokens are HMAC-signed with
// DEVICE_SECRET, so they can't be forged; KV (binding RATE) caps token issue per IP and photos per device.
// Set ALLOW_UNSIGNED=1 only for local `wrangler dev`.

import { sendPush, vapidPublic } from './webpush.js'
import { authConfig, ensureAuthSchema, accountOf, startEmail, verifyEmail, verifyGoogle, verifyApple, signIn, signOut, deleteUser, cleanEmail } from './auth.js'
import { cleanPrefs, cleanEvents, validTz, nextDue, message, eventMessage, localDay } from './reminders.js'

const OFF = 'https://world.openfoodfacts.org'
const UA = 'BeetFit/0.3 (https://beetfit.wealthifai.xyz)' // OFF asks for AppName/Version (contact)
const SNAP_DAILY_LIMIT = 30      // per device
const SNAP_IP_DAILY_LIMIT = 80   // per IP, stops token farming
const DEVICE_IP_DAILY_LIMIT = 10 // new tokens per IP per day
const CHAT_DAILY_LIMIT = 40      // Beet chat messages per device
const CHAT_IP_DAILY_LIMIT = 150

export default {
  // Cron (wrangler.toml [triggers]): send the reminders that came due.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runReminders(env, event.scheduledTime || Date.now()))
  },

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
        const out = { ok: true, device: !!env.DEVICE_SECRET, sync: !!env.DB, push: !!env.VAPID_JWK, auth: authConfig(env), gemini: !!env.GEMINI_API_KEY, usda: !!env.USDA_API_KEY, kv: !!env.RATE, model: env.GEMINI_MODEL || 'gemini-2.5-flash' }
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

      if (url.pathname === '/api/auth/config') return json(authConfig(env), 200, { ...cors, 'cache-control': 'no-store' })

      if (url.pathname === '/api/push/key') {
        if (!env.VAPID_JWK) return json({ error: 'push_not_configured' }, 503, cors)
        return json({ key: vapidPublic(env.VAPID_JWK) }, 200, cors)
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
      if (url.pathname === '/api/chat' && req.method === 'POST') {
        if (!env.GEMINI_API_KEY) return json({ error: 'chat_not_configured' }, 503, cors)
        if (!(await underLimit(env, `chatip:${ip}`, CHAT_IP_DAILY_LIMIT)) || !(await underLimit(env, `chat:${device.id}`, CHAT_DAILY_LIMIT))) {
          return json({ error: 'daily_limit' }, 429, cors)
        }
        const body = await req.json().catch(() => null)
        if (!body || !Array.isArray(body.messages) || !body.messages.length) return json({ error: 'bad_request' }, 400, cors)
        return json(await chat(body, env), 200, cors)
      }
      if (url.pathname.startsWith('/api/push')) {
        if (!env.DB) return json({ error: 'sync_not_configured' }, 503, cors)
        return await pushRoutes(req, url, env, device, cors, ctx)
      }
      if (url.pathname.startsWith('/api/coach')) {
        if (!env.DB) return json({ error: 'sync_not_configured' }, 503, cors)
        return await coachRoutes(req, url, env, device, ip, cors, ctx)
      }
      if (url.pathname.startsWith('/api/auth/')) {
        if (!env.DB) return json({ error: 'sync_not_configured' }, 503, cors)
        return await authRoutes(req, url, env, device, ip, cors)
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

// ---------- Beet chat ----------

const BEET_SYSTEM = `You are Beet, the coach inside the BeetFit app (training, food logging, camera rep counting, progress).
Answer like a sharp, friendly personal trainer and nutrition coach: short, concrete, practical. Use the user's numbers from CONTEXT when they matter (targets, what they ate today, their plan, recent weights, check-ins, pain reports) and say which number you used.
Format: plain text. At most ~120 words unless the user asks for more. Up to 5 short bullet lines with "- " when listing. No headings, no tables, no emoji.
Reply in the language the user writes in.
Scope: workouts, exercise technique and swaps, meals and macros, hydration, sleep, recovery, habits, motivation, and how to use BeetFit (log food by photo or barcode, camera counts reps, warm-up, swap an exercise with the ⋯ menu, report pain, weekly check-in, sync, coach code). For other topics, say briefly that you help with training and food.
Safety: you are not a doctor. For chest pain, fainting, sharp or worsening joint pain, or symptoms of illness, tell them to stop and get medical help. Don't diagnose. Don't recommend eating below their calorie target, losing more than about 1% of body weight a week, or skipping meals to compensate. If they describe restricting, bingeing, purging or guilt about food, respond with care, don't give numbers, and suggest talking to a doctor or an eating-disorder helpline.
Never invent data you don't have; if CONTEXT lacks something, ask or give a general answer.`

async function chat(body, env) {
  const model = env.GEMINI_MODEL || 'gemini-2.5-flash'
  const msgs = body.messages.slice(-16).map(m => ({
    role: m.role === 'model' ? 'model' : 'user',
    parts: [{ text: cleanText(m.text, 1500) || '…' }]
  }))
  if (msgs[0].role !== 'user') msgs.shift()
  const context = cleanText(body.context, 4000)
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: `${BEET_SYSTEM}\n\nCONTEXT (today is ${cleanText(body.today, 10) || 'unknown'}):\n${context || 'none'}` }] },
      contents: msgs,
      generationConfig: { temperature: 0.6, maxOutputTokens: 700, thinkingConfig: { thinkingBudget: 0 } },
      safetySettings: [{ category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }]
    })
  })
  if (res.status === 429) throw new Error('gemini_rate_limited')
  if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 160)}`)
  const data = await res.json()
  const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim()
  return { text: text || 'I couldn’t answer that one. Try asking it another way.', model }
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
    db.prepare('CREATE TABLE IF NOT EXISTS pairs (code TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS coaches (user_id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT NOT NULL UNIQUE, created INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS links (id TEXT PRIMARY KEY, coach_id TEXT NOT NULL, client_id TEXT NOT NULL UNIQUE, since INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, link_id TEXT NOT NULL, by TEXT NOT NULL, text TEXT NOT NULL, at INTEGER NOT NULL, seen INTEGER NOT NULL DEFAULT 0)'),
    db.prepare('CREATE INDEX IF NOT EXISTS messages_link ON messages (link_id, id)'),
    db.prepare('CREATE TABLE IF NOT EXISTS overrides (link_id TEXT PRIMARY KEY, data TEXT NOT NULL, at INTEGER NOT NULL)')
  ])
  // Added after the first release: the light per-user summary coaches see in their client list.
  try { await db.prepare('ALTER TABLE docs ADD COLUMN summary TEXT').run() } catch { /* already there */ }
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
      'INSERT INTO docs (user_id, data, rev, updated, summary) VALUES (?1, ?2, ?3, ?4, ?6) ON CONFLICT(user_id) DO UPDATE SET data = ?2, rev = ?3, updated = ?4, summary = ?6 WHERE docs.rev = ?5'
    ).bind(userId, JSON.stringify(body.data), rev, now, cur.rev, body.summary && typeof body.summary === 'object' ? JSON.stringify(body.summary).slice(0, 4000) : null).run()
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

// ---------- accounts ----------
async function authRoutes(req, url, env, device, ip, cors) {
  const db = env.DB
  await ensurePushSchema(db)
  await ensureAuthSchema(db)
  const userId = await userOf(db, device.id)
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
  const out = (v, status = 200) => json(v, status, { ...cors, 'cache-control': 'no-store' })
  const fail = r => out({ error: r.error }, r.status || 400)

  if (url.pathname === '/api/auth/me' && req.method === 'GET') return out({ account: await accountOf(db, userId), config: authConfig(env) })

  if (url.pathname === '/api/auth/email/start' && req.method === 'POST') {
    if (!(await underLimit(env, `mailip:${ip}`, 10)) || !(await underLimit(env, `mail:${cleanEmail(body.email)}`, 5))) return out({ error: 'too_many_tries' }, 429)
    const r = await startEmail(db, env, body.email)
    return r.error ? fail(r) : out({ ok: true })
  }

  let who = null
  if (url.pathname === '/api/auth/email/verify' && req.method === 'POST') {
    if (!(await underLimit(env, `authtry:${ip}`, 40))) return out({ error: 'too_many_tries' }, 429)
    who = await verifyEmail(db, env, body.email, body.code)
  } else if (url.pathname === '/api/auth/google' && req.method === 'POST') {
    who = await verifyGoogle(env, body.credential)
  } else if (url.pathname === '/api/auth/apple' && req.method === 'POST') {
    who = await verifyApple(env, body.idToken)
  }
  if (who) {
    if (who.error) return fail(who)
    const r = await signIn(db, userId, device.id, who)
    return out({ result: r.status, account: await accountOf(db, r.userId), ...(r.status === 'switched' ? { doc: await readDoc(db, r.userId) } : {}) })
  }

  if (url.pathname === '/api/auth/signout' && req.method === 'POST') {
    await signOut(db, device.id)
    return out({ ok: true })
  }
  if (url.pathname === '/api/auth/delete' && req.method === 'POST') {
    if (body.confirm !== 'DELETE') return out({ error: 'confirm' }, 400)
    await deleteUser(db, userId)
    return out({ ok: true })
  }
  return out({ error: 'not_found' }, 404)
}

// ---------- coach mode ----------
// A coach is any user who set a coach name; they get a 6-character invite code. A client joins with it
// (one coach per client). The coach then reads the client's synced doc, messages them and can override
// calorie / protein targets. Either side can end the link.

const CODE_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no 0/O/1/I/L
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => CODE_ABC[b % CODE_ABC.length]).join('')
const cleanText = (t, max) => String(t || '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, max)
const parse = t => { try { return t ? JSON.parse(t) : null } catch { return null } }

async function thread(db, linkId, limit = 100) {
  const { results } = await db.prepare('SELECT id, by, text, at, seen FROM messages WHERE link_id = ? ORDER BY id DESC LIMIT ?').bind(linkId, limit).all()
  return results.reverse().map(m => ({ ...m, seen: !!m.seen }))
}

async function override(db, linkId) {
  const row = await db.prepare('SELECT data, at FROM overrides WHERE link_id = ?').bind(linkId).first()
  return row ? { ...parse(row.data), at: row.at } : null
}

async function coachRoutes(req, url, env, device, ip, cors, ctx) {
  const db = env.DB
  await ensureSchema(db)
  const me = await userOf(db, device.id)
  const body = req.method === 'GET' ? {} : await req.json().catch(() => ({}))
  const path = url.pathname.replace(/\/+$/, '')
  const ok = (v, s = 200) => json(v, s, { ...cors, 'cache-control': 'no-store' })
  const err = (e, s = 400) => json({ error: e }, s, cors)

  // ----- client side -----
  if (path === '/api/coach/peek' && req.method === 'POST') {
    if (!(await underLimit(env, `coachtry:${ip}`, 30))) return err('too_many_tries', 429)
    const code = cleanText(body.code, 12).toUpperCase()
    const c = await db.prepare('SELECT user_id, name FROM coaches WHERE code = ?').bind(code).first()
    if (!c) return err('bad_code', 404)
    if (c.user_id === me) return err('own_code')
    return ok({ name: c.name })
  }
  if (path === '/api/coach/join' && req.method === 'POST') {
    if (!(await underLimit(env, `coachtry:${ip}`, 30))) return err('too_many_tries', 429)
    const code = cleanText(body.code, 12).toUpperCase()
    const c = await db.prepare('SELECT user_id, name FROM coaches WHERE code = ?').bind(code).first()
    if (!c) return err('bad_code', 404)
    if (c.user_id === me) return err('own_code')
    const id = crypto.randomUUID(), now = Date.now()
    await db.prepare('INSERT INTO links (id, coach_id, client_id, since) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(client_id) DO UPDATE SET id = ?1, coach_id = ?2, since = ?4')
      .bind(id, c.user_id, me, now).run()
    return ok({ coach: { name: c.name, since: now }, msgs: [], override: null })
  }
  const asClient = await db.prepare('SELECT l.id, l.since, l.coach_id, c.name FROM links l JOIN coaches c ON c.user_id = l.coach_id WHERE l.client_id = ?').bind(me).first()
  if (path === '/api/coach/link' && req.method === 'GET') {
    if (!asClient) return ok({ coach: null })
    return ok({ coach: { name: asClient.name, since: asClient.since }, msgs: await thread(db, asClient.id), override: await override(db, asClient.id) })
  }
  if (path === '/api/coach/leave' && req.method === 'POST') {
    if (asClient) await dropLink(db, asClient.id)
    return ok({ ok: true })
  }
  if (path === '/api/coach/msg' && req.method === 'POST') {
    if (!asClient) return err('no_coach', 404)
    const res = await postMsg(env, db, me, asClient.id, 'client', body.text, ok, err)
    if (res.status === 200) {
      const doc = await db.prepare('SELECT summary FROM docs WHERE user_id = ?').bind(me).first()
      const who = parse(doc?.summary)?.name || 'Your client'
      notify(ctx, env, asClient.coach_id, { title: who, body: cleanText(body.text, 140), url: '/?coach=1', tag: `coach-${asClient.id}` })
    }
    return res
  }
  if (path === '/api/coach/seen' && req.method === 'POST') {
    if (asClient) await db.prepare("UPDATE messages SET seen = 1 WHERE link_id = ? AND by = 'coach'").bind(asClient.id).run()
    return ok({ ok: true })
  }

  // ----- coach side -----
  if (path === '/api/coach/setup' && req.method === 'POST') {
    const name = cleanText(body.name, 40)
    if (name.length < 2) return err('bad_name')
    const cur = await db.prepare('SELECT code FROM coaches WHERE user_id = ?').bind(me).first()
    if (cur) {
      await db.prepare('UPDATE coaches SET name = ? WHERE user_id = ?').bind(name, me).run()
      return ok({ name, code: cur.code })
    }
    for (let i = 0; i < 5; i++) {
      const code = newCode()
      try {
        await db.prepare('INSERT INTO coaches (user_id, name, code, created) VALUES (?, ?, ?, ?)').bind(me, name, code, Date.now()).run()
        return ok({ name, code })
      } catch { /* code collision, try another */ }
    }
    return err('server_busy', 503)
  }
  const coach = await db.prepare('SELECT name, code FROM coaches WHERE user_id = ?').bind(me).first()
  if (path === '/api/coach/code' && req.method === 'POST') {
    if (!coach) return err('not_coach', 403)
    for (let i = 0; i < 5; i++) {
      const code = newCode()
      try { await db.prepare('UPDATE coaches SET code = ? WHERE user_id = ?').bind(code, me).run(); return ok({ name: coach.name, code }) } catch { /* collision */ }
    }
    return err('server_busy', 503)
  }
  if (path === '/api/coach/clients' && req.method === 'GET') {
    if (!coach) return ok({ coach: null, clients: [] })
    const { results } = await db.prepare(
      `SELECT l.id, l.since, d.summary, d.updated,
        (SELECT COUNT(*) FROM messages m WHERE m.link_id = l.id AND m.by = 'client' AND m.seen = 0) AS unread
       FROM links l LEFT JOIN docs d ON d.user_id = l.client_id WHERE l.coach_id = ? ORDER BY l.since DESC LIMIT 200`
    ).bind(me).all()
    return ok({ coach, clients: results.map(r => ({ id: r.id, since: r.since, updated: r.updated || 0, unread: r.unread, summary: parse(r.summary) })) })
  }
  const m = path.match(/^\/api\/coach\/client\/([0-9a-f-]{36})(?:\/(msg|override|remove|seen))?$/)
  if (m) {
    if (!coach) return err('not_coach', 403)
    const link = await db.prepare('SELECT id, client_id, since FROM links WHERE id = ? AND coach_id = ?').bind(m[1], me).first()
    if (!link) return err('not_found', 404)
    if (!m[2] && req.method === 'GET') {
      const doc = await db.prepare('SELECT data, updated FROM docs WHERE user_id = ?').bind(link.client_id).first()
      return ok({ id: link.id, since: link.since, updated: doc?.updated || 0, data: parse(doc?.data), msgs: await thread(db, link.id), override: await override(db, link.id) })
    }
    if (m[2] === 'msg' && req.method === 'POST') {
      const res = await postMsg(env, db, me, link.id, 'coach', body.text, ok, err)
      if (res.status === 200) notify(ctx, env, link.client_id, { title: `Coach · ${coach.name}`, body: cleanText(body.text, 140), url: '/?chat=coach', tag: 'coach' })
      return res
    }
    if (m[2] === 'seen' && req.method === 'POST') {
      await db.prepare("UPDATE messages SET seen = 1 WHERE link_id = ? AND by = 'client'").bind(link.id).run()
      return ok({ ok: true })
    }
    if (m[2] === 'override' && req.method === 'PUT') {
      const n = (v, lo, hi) => (Number.isFinite(+v) && +v >= lo && +v <= hi ? Math.round(+v) : null)
      const o = { kcal: n(body.kcal, 900, 6000), protein: n(body.protein, 30, 400), note: cleanText(body.note, 280) || null }
      if (o.kcal == null && o.protein == null && !o.note) {
        await db.prepare('DELETE FROM overrides WHERE link_id = ?').bind(link.id).run()
        return ok({ override: null })
      }
      const at = Date.now()
      await db.prepare('INSERT OR REPLACE INTO overrides (link_id, data, at) VALUES (?, ?, ?)').bind(link.id, JSON.stringify(o), at).run()
      return ok({ override: { ...o, at } })
    }
    if (m[2] === 'remove' && req.method === 'POST') { await dropLink(db, link.id); return ok({ ok: true }) }
  }
  return err('not_found', 404)
}

async function postMsg(env, db, me, linkId, by, raw, ok, err) {
  const text = cleanText(raw, 1000)
  if (!text) return err('empty')
  if (!(await underLimit(env, `msg:${me}`, 200))) return err('daily_limit', 429)
  const at = Date.now()
  const r = await db.prepare('INSERT INTO messages (link_id, by, text, at) VALUES (?, ?, ?, ?)').bind(linkId, by, text, at).run()
  return ok({ msg: { id: r.meta?.last_row_id ?? null, by, text, at, seen: false } })
}

async function dropLink(db, linkId) {
  await db.batch([
    db.prepare('DELETE FROM messages WHERE link_id = ?').bind(linkId),
    db.prepare('DELETE FROM overrides WHERE link_id = ?').bind(linkId),
    db.prepare('DELETE FROM links WHERE id = ?').bind(linkId)
  ])
}

// ---------- push notifications ----------
// Browsers hand us an endpoint on their vendor's push service; only those hosts are accepted,
// so the Worker can't be pointed at arbitrary URLs.
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /\.push\.services\.mozilla\.com$/, /^updates\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/, /^web\.push\.apple\.com$/, /\.push\.apple\.com$/]
const okEndpoint = e => { try { const u = new URL(e); return u.protocol === 'https:' && PUSH_HOSTS.some(r => r.test(u.hostname)) } catch { return false } }

async function ensurePushSchema(db) {
  await ensureSchema(db)
  await db.prepare('CREATE TABLE IF NOT EXISTS push_subs (endpoint TEXT PRIMARY KEY, user_id TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, tz TEXT NOT NULL, prefs TEXT NOT NULL, next_at INTEGER, next_kind TEXT, created INTEGER NOT NULL, fails INTEGER NOT NULL DEFAULT 0)').run()
  await db.prepare('CREATE INDEX IF NOT EXISTS push_due ON push_subs (next_at)').run()
  try { await db.prepare('ALTER TABLE push_subs ADD COLUMN events TEXT').run() } catch { /* already there */ }
}

async function pushRoutes(req, url, env, device, cors, ctx) {
  const db = env.DB
  if (!env.VAPID_JWK) return json({ error: 'push_not_configured' }, 503, cors)
  await ensurePushSchema(db)
  const me = await userOf(db, device.id)
  const body = await req.json().catch(() => ({}))
  const ok = v => json(v, 200, { ...cors, 'cache-control': 'no-store' })

  if (url.pathname === '/api/push/subscribe' && req.method === 'POST') {
    const sub = body.sub || {}
    if (!okEndpoint(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) return json({ error: 'bad_subscription' }, 400, cors)
    const tz = validTz(body.tz) ? body.tz : 'UTC'
    const prefs = cleanPrefs(body.prefs)
    const events = cleanEvents(body.events)
    const due = nextDue(prefs, tz, Date.now(), events)
    await db.prepare(`INSERT INTO push_subs (endpoint, user_id, p256dh, auth, tz, prefs, next_at, next_kind, created, events) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
      ON CONFLICT(endpoint) DO UPDATE SET user_id = ?2, p256dh = ?3, auth = ?4, tz = ?5, prefs = ?6, next_at = ?7, next_kind = ?8, fails = 0, events = ?10`)
      .bind(sub.endpoint, me, String(sub.keys.p256dh).slice(0, 200), String(sub.keys.auth).slice(0, 60), tz, JSON.stringify(prefs), due?.at ?? null, due?.kind ?? null, Date.now(), JSON.stringify(events)).run()
    return ok({ ok: true, prefs, events: events.length, next: due })
  }
  if (url.pathname === '/api/push/unsubscribe' && req.method === 'POST') {
    await db.prepare('DELETE FROM push_subs WHERE endpoint = ? AND user_id = ?').bind(String(body.endpoint || ''), me).run()
    return ok({ ok: true })
  }
  if (url.pathname === '/api/push/test' && req.method === 'POST') {
    const row = await db.prepare('SELECT * FROM push_subs WHERE endpoint = ? AND user_id = ?').bind(String(body.endpoint || ''), me).first()
    if (!row) return json({ error: 'not_subscribed' }, 404, cors)
    const r = await sendPush({ endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth }, { title: 'BeetFit', body: 'Notifications are on. Reminders come at the times you picked.', url: '/', tag: 'test' }, env, { urgency: 'high' })
    if (r.gone) await db.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(row.endpoint).run()
    return ok({ ok: r.ok, pushStatus: r.status }) // not "status": the client wrapper uses that for the HTTP code
  }
  return json({ error: 'not_found' }, 404, cors)
}

// Push to every device of a user (coach messages). Runs after the response.
function notify(ctx, env, userId, payload) {
  if (!env.VAPID_JWK || !env.DB) return
  const job = (async () => {
    await ensurePushSchema(env.DB)
    const { results } = await env.DB.prepare('SELECT endpoint, p256dh, auth, prefs FROM push_subs WHERE user_id = ?').bind(userId).all()
    await Promise.all(results.filter(r => parse(r.prefs)?.coach !== false).map(async r => {
      const res = await sendPush(r, payload, env, { urgency: 'high', topic: payload.tag?.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) }).catch(() => ({ ok: false }))
      if (res.gone) await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(r.endpoint).run()
    }))
  })().catch(() => {})
  if (ctx?.waitUntil) ctx.waitUntil(job)
  return job
}

export async function runReminders(env, now = Date.now()) {
  if (!env.VAPID_JWK || !env.DB) return { sent: 0 }
  const db = env.DB
  await ensurePushSchema(db)
  const { results } = await db.prepare('SELECT * FROM push_subs WHERE next_at IS NOT NULL AND next_at <= ? ORDER BY next_at LIMIT 200').bind(now).all()
  const docs = new Map()
  let sent = 0, quiet = 0
  for (const row of results) {
    const prefs = cleanPrefs(parse(row.prefs))
    const events = (parse(row.events) || []).filter(e => e && e.at > now - 3 * 3600e3)
    // Missed by more than 2 h (Worker paused, clock jump): skip rather than nag at the wrong time.
    if (now - row.next_at < 2 * 3600 * 1000) {
      if (!docs.has(row.user_id)) docs.set(row.user_id, parse((await db.prepare('SELECT data FROM docs WHERE user_id = ?').bind(row.user_id).first())?.data))
      const day = localDay(row.next_at, row.tz)
      const msg = row.next_kind === 'event'
        ? eventMessage(events.find(e => e.at === row.next_at), docs.get(row.user_id), day)
        : message(row.next_kind, docs.get(row.user_id), day)
      if (msg) {
        const r = await sendPush(row, msg, env, { ttl: 2 * 3600, topic: (msg.tag || row.next_kind).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) }).catch(() => ({ ok: false }))
        if (r.gone) { await db.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(row.endpoint).run(); continue }
        if (r.ok) sent++
      } else quiet++
    }
    const left = events.filter(e => e.at > row.next_at)
    const due = nextDue(prefs, row.tz, Math.max(now, row.next_at) + 1000, left)
    await db.prepare('UPDATE push_subs SET next_at = ?, next_kind = ?, events = ? WHERE endpoint = ?').bind(due?.at ?? null, due?.kind ?? null, JSON.stringify(left), row.endpoint).run()
  }
  return { due: results.length, sent, quiet }
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
