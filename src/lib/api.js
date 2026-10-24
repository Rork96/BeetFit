// API client. On the website the API is same-origin (the Worker serves both); native builds
// point VITE_API_URL at https://beetfit.wealthifai.xyz.
export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const TOKEN_KEY = 'beetfit_device_token'

// The Worker issues a signed per-install token; it rate-limits photo recognition per device.
// No account needed. Replace with real sign-in when sync/coach mode lands.
let tokenP = null
async function deviceToken(force = false) {
  if (!force) {
    try { const t = localStorage.getItem(TOKEN_KEY); if (t) return t } catch { /* ignore */ }
  }
  tokenP ??= fetch(API_URL + '/api/device', { method: 'POST' })
    .then(r => (r.ok ? r.json() : Promise.reject(new Error('device ' + r.status))))
    .then(({ token }) => { try { localStorage.setItem(TOKEN_KEY, token) } catch { /* ignore */ } return token })
    .finally(() => { tokenP = null })
  return tokenP
}

async function call(path, opts = {}, retry = true) {
  let token = ''
  try { token = await deviceToken() } catch { /* API offline → call fails below with a clear status */ }
  const res = await fetch(API_URL + path, { ...opts, headers: { authorization: `Bearer ${token}`, ...(opts.headers || {}) } })
  if (res.status === 401 && retry) { await deviceToken(true).catch(() => {}); return call(path, opts, false) }
  const body = await res.json().catch(() => ({}))
  return { status: res.status, ...body }
}

// Barcode → { found, item }
export async function lookupBarcode(code) {
  try {
    const r = await call(`/api/food/barcode/${code}`)
    // Server misconfigured or down (401 / 5xx) → don't report "not found", ask Open Food Facts directly.
    if (r.status === 401 || r.status >= 500 || r.status === 0) return lookupOffDirect(code)
    return r
  } catch {
    // API unreachable (local dev without the Worker) → Open Food Facts directly; it allows CORS.
    return lookupOffDirect(code)
  }
}

async function lookupOffDirect(code) {
  const fields = 'code,product_name,generic_name,brands,nutriments,serving_size,image_front_small_url'
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${fields}`)
  const data = await res.json().catch(() => ({}))
  if (data.status !== 1) return { found: false, code }
  const p = data.product, n = p.nutriments || {}
  const kcal = n['energy-kcal_100g'] ?? (n.energy_100g != null ? n.energy_100g / 4.184 : null)
  if (kcal == null) return { found: false, code }
  return {
    found: true,
    item: {
      source: 'off', code, name: p.product_name || p.generic_name || 'Unnamed product',
      brand: (p.brands || '').split(',')[0].trim() || null, image: p.image_front_small_url || null,
      per100: { kcal: Math.round(kcal), p: r1(n.proteins_100g), c: r1(n.carbohydrates_100g), f: r1(n.fat_100g) },
      servingG: Math.round(parseFloat(String(p.serving_size || '').match(/([\d.]+)\s*g/i)?.[1])) || null
    }
  }
}

export async function searchFood(q) {
  try {
    const r = await call(`/api/food/search?q=${encodeURIComponent(q)}`)
    if (r.status === 200) return r
  } catch { /* fall through */ }
  // Server down or misconfigured → Open Food Facts search straight from the device (CORS allowed).
  try { return { status: 200, items: await searchOffDirect(q), direct: true } } catch { return { status: 0, items: [], error: 'offline' } }
}

async function searchOffDirect(q) {
  const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&json=1&page_size=12&fields=code,product_name,brands,nutriments,serving_size,image_front_small_url`)
  const d = await res.json()
  return (d.products || []).map(p => {
    const n = p.nutriments || {}
    const kcal = n['energy-kcal_100g'] ?? (n.energy_100g != null ? n.energy_100g / 4.184 : null)
    if (kcal == null || !p.product_name) return null
    return { source: 'off', code: p.code, name: p.product_name, brand: (p.brands || '').split(',')[0].trim() || null, image: p.image_front_small_url || null,
      per100: { kcal: Math.round(kcal), p: r1(n.proteins_100g), c: r1(n.carbohydrates_100g), f: r1(n.fat_100g) },
      servingG: Math.round(parseFloat(String(p.serving_size || '').match(/([\d.]+)\s*g/i)?.[1])) || null }
  }).filter(Boolean)
}

// JPEG blob → { title, items: [{ name, grams, kcal, p, c, f, confidence }] }
export async function snapMeal(blob) {
  try {
    return await call('/api/snap', { method: 'POST', body: blob, headers: { 'content-type': blob.type || 'image/jpeg' } })
  } catch {
    return { status: 0, error: 'offline' }
  }
}

const r1 = v => (v == null || isNaN(v) ? 0 : Math.round(v * 10) / 10)
