import { describe, it, expect } from 'vitest'
import { suggestBudget, suggestMeals, SLOT_SPLIT } from './meals.js'

describe('suggestBudget', () => {
  it('is sized to the meal slot, not to everything that is left', () => {
    expect(suggestBudget('dinner', 2400, 0)).toBe(720)
    expect(suggestBudget('breakfast', 2400, 0)).toBe(600)
  })
  it('never exceeds what is left', () => {
    expect(suggestBudget('dinner', 2400, 2000)).toBe(400)
  })
  it('is 0 once the day is covered', () => {
    expect(suggestBudget('snack', 2400, 2300)).toBe(0)
    expect(suggestBudget('lunch', 2000, 2500)).toBe(0)
  })
  it('keeps a floor for tiny slots', () => {
    expect(suggestBudget('snack', 1200, 0)).toBeGreaterThanOrEqual(150)
  })
})

describe('suggestMeals', () => {
  it('returns three distinct ideas for one slot, near the budget', () => {
    const r = suggestMeals('lunch', 600, { rnd: () => 0.5 })
    expect(r).toHaveLength(3)
    expect(new Set(r.map(x => x.name)).size).toBe(3)
    for (const x of r) { expect(x.slot).toBe('lunch'); expect(Math.abs(x.kcal - 600)).toBeLessThan(250) }
  })
  it('skips excluded names', () => {
    const first = suggestMeals('dinner', 650, { rnd: () => 0.3 })
    const next = suggestMeals('dinner', 650, { exclude: first.map(x => x.name), rnd: () => 0.3 })
    expect(next.some(x => first.map(f => f.name).includes(x.name))).toBe(false)
  })
  it('gives nothing when the budget is 0', () => {
    expect(suggestMeals('dinner', 0)).toEqual([])
  })
  it('slot split sums to 1', () => {
    expect(Object.values(SLOT_SPLIT).reduce((a, b) => a + b, 0)).toBeCloseTo(1)
  })
})
