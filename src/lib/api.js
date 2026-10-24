import { initData } from './tg.js'

// Worker base URL, e.g. https://beetfit-api.<you>.workers.dev — set VITE_API_URL at build time.
export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
export const hasApi = () => !!API_URL

async function call(path, opts = {}) {
  const res = await fetch(API_URL + path, {
    ...opts,
    headers: { 'x-telegram-init-data': initData(), ...(opts.headers || {}) }
  })
  const body = await res.json().catch(() => ({}))
  return { status: res.status, ...body }
}

// Barcode → { found, item }. Without the Worker we hit Open Food Facts directly (it allows CORS).
export async function lookupBarcode(code) {
  if (hasApi()) return call(`/api/food/barcode/${code}`)
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
      servingG: parseFloat(String(p.serving_size || '').match(/([\d.]+)\s*g/i)?.[1]) || null
    }
  }
}

export async function searchFood(q) {
  if (!hasApi()) return { items: [] }
  return call(`/api/food/search?q=${encodeURIComponent(q)}`)
}

// JPEG blob → { title, items: [{ name, grams, kcal, p, c, f, confidence }] }
export async function snapMeal(blob) {
  if (!hasApi()) return { status: 0, error: 'no_api' }
  return call('/api/snap', { method: 'POST', body: blob, headers: { 'content-type': blob.type || 'image/jpeg' } })
}

const r1 = v => (v == null || isNaN(v) ? 0 : Math.round(v * 10) / 10)
