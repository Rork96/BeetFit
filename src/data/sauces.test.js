import { describe, it, expect } from 'vitest'
import { findSauce, fixSauce, sauceItem, SAUCES } from './sauces.js'

describe('sauces', () => {
  it('recognises a standalone sauce, not a dish', () => {
    expect(findSauce('Ranch dressing')?.id).toBe('ranch')
    expect(findSauce('Ketchup (side)')?.id).toBe('ketchup')
    expect(findSauce('mayo')?.id).toBe('mayo')
    expect(findSauce('Chicken in teriyaki sauce')).toBeNull()
    expect(findSauce('Caesar salad')).toBeNull()
    expect(findSauce('Cheese pizza')).toBeNull()
  })
  it('a tablespoon of mayo is ~95 kcal, not a made-up number', () => {
    const r = fixSauce({ name: 'Mayonnaise', grams: 14, kcal: 40, p: 0, c: 0, f: 4, confidence: 0.5 })
    expect(r.kcal).toBe(95)
    expect(r.f).toBeCloseTo(10.5, 1)
    expect(r.name).toBe('Mayonnaise')
  })
  it('scales with the grams the model saw', () => {
    expect(fixSauce({ name: 'Ranch dressing', grams: 30, kcal: 60 }).kcal).toBe(129)
  })
  it('leaves other items alone', () => {
    const x = { name: 'Grilled chicken', grams: 150, kcal: 250 }
    expect(fixSauce(x)).toEqual(x)
  })
  it('every entry has sane macros (kcal ≈ 4p + 4c + 9f within 35%)', () => {
    for (const s of SAUCES) {
      const [k, p, c, f] = s.per100
      const calc = 4 * p + 4 * c + 9 * f
      expect(Math.abs(calc - k) / k, s.id).toBeLessThan(0.35)
    }
  })
  it('sauceItem builds a logged item', () => {
    expect(sauceItem(SAUCES.find(s => s.id === 'ketchup'))).toMatchObject({ name: 'Ketchup', grams: 17, kcal: 17 })
  })
})
