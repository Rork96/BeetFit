import { describe, it, expect } from 'vitest'
import { STAPLES, stapleMatches } from './staples.js'

describe('staples', () => {
  it('plain foods come first for the words people actually type', () => {
    expect(stapleMatches('egg')[0].name).toBe('Egg, whole')
    expect(stapleMatches('rice')[0].name).toBe('White rice, cooked')
    expect(stapleMatches('apple')[0].name).toBe('Apple')
    expect(stapleMatches('chicken breast')[0].name).toBe('Chicken breast, cooked')
    expect(stapleMatches('oatmeal').map(x => x.name)).toEqual(expect.arrayContaining(['Oatmeal, cooked with water', 'Oats, dry']))
    expect(stapleMatches('coffee')[0].name).toBe('Coffee, black')
    expect(stapleMatches('chick br')[0].name).toBe('Chicken breast, cooked')
    expect(stapleMatches('greek yog')[0].name).toMatch(/Greek yogurt/)
  })
  it('nothing for one letter or a brand it does not know', () => {
    expect(stapleMatches('e')).toEqual([])
    expect(stapleMatches('tim hortons')).toEqual([])
    expect(stapleMatches('wrap')).toEqual([])
  })
  it('every row is sane: macros add up to the calories, portions are real, ids are unique', () => {
    expect(new Set(STAPLES.map(s => s.code)).size).toBe(STAPLES.length)
    for (const s of STAPLES) {
      const { kcal, p, c, f } = s.per100
      expect(s.servingG, s.name).toBeGreaterThan(0)
      expect(s.serving, s.name).toBeTruthy()
      // Atwater 4/4/9; alcohol and fibre make a few rows drift, so the band is wide, and drinks with alcohol are skipped.
      if (!/Beer|wine/i.test(s.name)) expect(Math.abs(p * 4 + c * 4 + f * 9 - kcal), s.name).toBeLessThanOrEqual(Math.max(16, kcal * 0.16))
    }
  })
  it('items carry what the portion card needs and no search internals', () => {
    const x = stapleMatches('banana')[0]
    expect(x).toMatchObject({ source: 'staple', code: 'fdc:173944', per100: { kcal: 89 }, servingG: 118, serving: '1 medium' })
    expect(x._hay).toBeUndefined()
  })
})
