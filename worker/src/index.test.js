import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { authenticate, normalizeOff, normalizeUsda } from './index.js'

const BOT = '123456:TEST-token'

function sign(fields) {
  const dcs = Object.keys(fields).sort().map(k => `${k}=${fields[k]}`).join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(BOT).digest()
  const hash = createHmac('sha256', secret).update(dcs).digest('hex')
  return new URLSearchParams({ ...fields, hash }).toString()
}

const req = initData => new Request('https://x/api/food/search?q=egg', { headers: initData ? { 'x-telegram-init-data': initData } : {} })

describe('Telegram initData', () => {
  const fields = { auth_date: String(Math.floor(Date.now() / 1000)), query_id: 'AAE', user: JSON.stringify({ id: 42, first_name: 'Pavlo' }) }

  it('accepts a correctly signed payload', async () => {
    const u = await authenticate(req(sign(fields)), { BOT_TOKEN: BOT })
    expect(u.id).toBe(42)
  })
  it('rejects a tampered payload', async () => {
    const tampered = sign(fields).replace('Pavlo', 'Mallory')
    expect(await authenticate(req(tampered), { BOT_TOKEN: BOT })).toBeNull()
  })
  it('rejects stale auth_date', async () => {
    const old = sign({ ...fields, auth_date: String(Math.floor(Date.now() / 1000) - 3 * 86400) })
    expect(await authenticate(req(old), { BOT_TOKEN: BOT })).toBeNull()
  })
  it('rejects unsigned unless ALLOW_UNSIGNED', async () => {
    expect(await authenticate(req(''), { BOT_TOKEN: BOT })).toBeNull()
    expect((await authenticate(req(''), { ALLOW_UNSIGNED: '1' })).id).toBe('dev')
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
