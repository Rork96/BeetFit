import { describe, it, expect } from 'vitest'
import worker, { authenticate, issueToken, normalizeOff, normalizeUsda } from './index.js'

const SECRET = 'test-secret-0123456789'
const req = token => new Request('https://x/api/food/search?q=egg', { headers: token ? { authorization: `Bearer ${token}` } : {} })

describe('device tokens', () => {
  it('accepts a token it issued', async () => {
    const t = await issueToken(SECRET)
    const d = await authenticate(req(t), { DEVICE_SECRET: SECRET })
    expect(d.id).toMatch(/^[0-9a-f-]{36}$/)
  })
  it('rejects a forged or tampered token', async () => {
    const t = await issueToken(SECRET)
    const [id, ts, sig] = t.split('.')
    expect(await authenticate(req(`${id}.${+ts + 1}.${sig}`), { DEVICE_SECRET: SECRET })).toBeNull()
    expect(await authenticate(req(await issueToken('other-secret')), { DEVICE_SECRET: SECRET })).toBeNull()
    expect(await authenticate(req('garbage'), { DEVICE_SECRET: SECRET })).toBeNull()
  })
  it('rejects missing tokens unless ALLOW_UNSIGNED', async () => {
    expect(await authenticate(req(''), { DEVICE_SECRET: SECRET })).toBeNull()
    expect((await authenticate(req(''), { ALLOW_UNSIGNED: '1' })).id).toBe('dev')
  })
})

describe('routing', () => {
  it('serves non-API paths from static assets', async () => {
    const env = { ASSETS: { fetch: r => new Response('asset:' + new URL(r.url).pathname) } }
    const res = await worker.fetch(new Request('https://x/today'), env, {})
    expect(await res.text()).toBe('asset:/today')
  })
  it('issues a device token on POST /api/device', async () => {
    const res = await worker.fetch(new Request('https://x/api/device', { method: 'POST' }), { DEVICE_SECRET: SECRET }, {})
    const { token } = await res.json()
    expect(res.status).toBe(200)
    expect((await authenticate(req(token), { DEVICE_SECRET: SECRET })).id).toBeTruthy()
  })
  it('401s food routes without a token', async () => {
    const res = await worker.fetch(new Request('https://x/api/food/barcode/3017620422003'), { DEVICE_SECRET: SECRET }, {})
    expect(res.status).toBe(401)
  })
})

describe('normalizers', () => {
  it('maps an Open Food Facts product', () => {
    const it_ = normalizeOff({ product_name: 'Nutella', brands: 'Ferrero, X', serving_size: '15 g',
      nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9 } }, '3017620422003')
    expect(it_).toMatchObject({ name: 'Nutella', brand: 'Ferrero', servingG: 15, per100: { kcal: 539, p: 6.3, c: 57.5, f: 30.9 } })
  })
  it('falls back to kJ', () => {
    expect(normalizeOff({ nutriments: { energy_100g: 418.4 } }).per100.kcal).toBe(100)
  })
  it('maps a USDA food', () => {
    const f = normalizeUsda({ fdcId: 1, description: 'Egg, whole, raw', foodNutrients: [
      { nutrientId: 1008, value: 143 }, { nutrientId: 1003, value: 12.6 }, { nutrientId: 1005, value: 0.7 }, { nutrientId: 1004, value: 9.5 }] })
    expect(f.per100).toEqual({ kcal: 143, p: 12.6, c: 0.7, f: 9.5 })
  })
})

describe('food search ranking', () => {
  it('puts names that contain every typed word first, drops duplicates', async () => {
    const { rankFoods } = await import('./index.js')
    const mk = (name, brand = null) => ({ name, brand, code: name })
    const out = rankFoods([mk('Chicken noodle soup', 'Campbell'), mk('Wrap'), mk('Chicken wrap', 'Tim Hortons'), mk('Chicken wrap', 'Tim Hortons'), mk('Tortilla wraps')], 'chicken wrap')
    expect(out[0].name).toBe('Chicken wrap')
    expect(out.filter(x => x.name === 'Chicken wrap')).toHaveLength(1)
    expect(out.map(x => x.name).indexOf('Chicken noodle soup')).toBeGreaterThan(out.map(x => x.name).indexOf('Chicken wrap'))
  })
})

import { chainMatches } from './index.js'
describe('chain catalog', () => {
  const list = [{ brand: 'Tim Hortons', name: 'Chicken Club Wrap', servingG: 200, per100: { kcal: 200, p: 12, c: 18, f: 9 } }]
  it('matches all words across brand and name and tags source', () => {
    const r = chainMatches('tim wrap', list)
    expect(r).toHaveLength(1)
    expect(r[0].source).toBe('chain')
    expect(r[0].per100.kcal).toBe(200)
  })
  it('no match and empty query give nothing', () => {
    expect(chainMatches('pizza', list)).toEqual([])
    expect(chainMatches('', list)).toEqual([])
  })
})
