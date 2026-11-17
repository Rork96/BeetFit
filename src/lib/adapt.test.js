import { describe, it, expect } from 'vitest'
import { energyCheck, applyCheck, fullLogDays, NEED } from './adapt.js'
import { tdee, burn, targetCalories, realRate, eta, targetNote, maxRate } from './calories.js'
import { addDays } from './day.js'

const T = '2026-11-16'
const profile = { sex: 'male', age: 30, heightCm: 180, weightKg: 90, targetKg: 82, goal: 'lose', activity: 'light', rateKg: 0.5 }
// `days` of food at `kcal`, and a weigh-in every other day drifting by `perWeek` kg a week.
function mk({ kcal = 2100, days = 14, perWeek = -0.5, skip = [], p = profile } = {}) {
  const foodLog = {}, weightLog = []
  for (let i = 1; i <= days; i++) {
    const k = addDays(T, -i)
    if (!skip.includes(i)) foodLog[k] = [{ name: 'Food', kcal, p: 100, c: 200, f: 60 }]
    if (i % 2 === 0) weightLog.push({ date: k, kg: +(90 + perWeek * (days - i) / 7).toFixed(2) })
  }
  return { profile: p, settings: {}, foodLog, weightLog: weightLog.reverse() }
}

describe('pace-based calories', () => {
  it('the target follows the planned pace, not a flat 20%', () => {
    const F = tdee(profile)
    expect(targetCalories(profile)).toBe(Math.round((F - 550) / 10) * 10)
    expect(targetCalories({ ...profile, rateKg: 0.25 })).toBe(Math.round((F - 275) / 10) * 10)
    expect(realRate(profile)).toBeCloseTo(-0.5, 1)
  })
  it('caps the deficit at 25% and says so', () => {
    const p = { ...profile, rateKg: 1.2 }
    expect(targetCalories(p)).toBe(Math.round(tdee(p) * 0.75 / 10) * 10)
    expect(targetNote(p)).toMatch(/Capped at a 25% deficit/)
    expect(Math.abs(realRate(p))).toBeLessThan(1.2)
  })
  it('never goes under the floor; teens are held at maintenance', () => {
    const small = { sex: 'female', age: 40, heightCm: 155, weightKg: 52, targetKg: 48, goal: 'lose', activity: 'sedentary', rateKg: 0.5 }
    expect(targetCalories(small)).toBe(1200)
    expect(targetCalories({ ...profile, age: 17 })).toBe(tdee({ ...profile, age: 17 }))
  })
  it('gain adds a surplus, capped at 15%; maintain ignores the rate', () => {
    const g = { ...profile, goal: 'gain', targetKg: 95, rateKg: 0.25 }
    expect(targetCalories(g)).toBe(Math.round((tdee(g) + 275) / 10) * 10)
    expect(targetCalories({ ...g, rateKg: 2 })).toBe(Math.round(tdee(g) * 1.15 / 10) * 10)
    expect(targetCalories({ ...profile, goal: 'maintain' })).toBe(tdee(profile))
  })
  it('profiles from before the pace existed keep the flat 20%', () => {
    const { rateKg, ...old } = profile
    expect(targetCalories(old)).toBe(Math.round(tdee(old) * 0.8))
  })
  it('eta comes from the pace the calories really deliver', () => {
    const e = eta(profile, 90, new Date(2026, 10, 16))
    expect(e.weeks).toBe(16) // 8 kg at 0.5 kg a week
    expect(eta({ ...profile, goal: 'maintain' })).toBeNull()
    expect(maxRate(profile)).toBe(0.9)
  })
  it('a measured burn replaces the formula, within ±30%', () => {
    expect(burn({ ...profile, burnAdj: -200 })).toBe(tdee(profile) - 200)
    expect(Math.abs(burn({ ...profile, burnAdj: -5000 }) - tdee(profile) * 0.7)).toBeLessThan(1)
  })
})

describe('energyCheck', () => {
  it('waits for enough food days and weigh-ins, and says how far along it is', () => {
    const c = energyCheck(mk({ days: 5 }), T)
    expect(c.ready).toBe(false)
    expect(c.have).toMatchObject({ logDays: 5, weighIns: 2 })
    expect(c.pct).toBeGreaterThan(0)
    expect(c.pct).toBeLessThan(100)
    expect(NEED.logDays).toBe(8)
  })
  it('burn = intake − weight change × 7700', () => {
    const c = energyCheck(mk({ kcal: 2100, perWeek: -0.5 }), T) // 2100 + 550
    expect(c.ready).toBe(true)
    expect(c.intake).toBe(2100)
    expect(c.rate).toBeCloseTo(-0.5, 1)
    expect(c.raw).toBeGreaterThan(2600)
    expect(c.raw).toBeLessThan(2700)
  })
  it('a reading moves the estimate part of the way, and offers both ways to act', () => {
    const st = mk({ kcal: 2100, perWeek: 0 }) // not losing at 2100: this reading says 2100, the formula says more
    const c = energyCheck(st, T)
    const F = tdee({ ...profile, weightKg: 90 })
    expect(c.formula).toBe(F)
    expect(c.raw).toBe(2100)
    expect(c.measured).toBeGreaterThan(2100)
    expect(c.measured).toBeLessThan(F - 100)
    expect(c.gain).toBeGreaterThan(0.3)
    expect(c.gain).toBeLessThan(0.8)
    expect(c.changes).toBe(true)
    expect(c.keepPace.kcal).toBeLessThan(c.kcalNow) // hold the pace → eat less
    expect(c.keepKcal.kcal).toBe(c.kcalNow) // hold the calories → slower
    expect(Math.abs(c.keepKcal.rate)).toBeLessThan(0.5)
  })
  it('half-logged days are left out', () => {
    const st = mk({})
    st.foodLog[addDays(T, -3)] = [{ name: 'Coffee', kcal: 120, p: 0, c: 10, f: 5 }]
    expect(fullLogDays(st, T).some(d => d.key === addDays(T, -3))).toBe(false)
  })
  it('a wild number is flagged as noise and changes nothing', () => {
    const c = energyCheck(mk({ kcal: 1200, perWeek: 1.5 }), T) // eating little, gaining fast: water or a broken log
    expect(c.noisy).toBe(true)
    expect(c.changes).toBe(false)
  })
  it('applyCheck: pace keeps the rate and moves calories; kcal keeps calories and moves the rate; both are logged', () => {
    const st = mk({ kcal: 2100, perWeek: 0 })
    const c = energyCheck(st, T)
    const a = { ...st, ...applyCheck(st, c, 'pace', T) }
    expect(a.profile.rateKg).toBe(0.5)
    expect(targetCalories(a.profile)).toBe(c.keepPace.kcal)
    expect(a.settings.adaptAt).toBe(T)
    expect(a.adaptLog).toHaveLength(1)
    const b = { ...st, ...applyCheck(st, c, 'kcal', T) }
    if (c.keepKcal.ok) expect(targetCalories(b.profile)).toBe(c.kcalNow)
    expect(energyCheck(a, T).due).toBe(false)
    expect(energyCheck(a, addDays(T, 7)).due).toBe(true)
    const s = { ...st, ...applyCheck(st, c, 'skip', T) }
    expect(s.profile.burnAdj).toBeUndefined()
    // The second reading is trusted less than the first: the estimate has firmed up.
    const again = energyCheck({ ...a, settings: {} }, T)
    expect(again.gain).toBeLessThan(c.gain)
    expect(Math.abs(again.measured - c.measured)).toBeLessThan(Math.abs(c.measured - c.formula))
  })
})

import { planPath, planStanding } from './adapt.js'
describe('plan path', () => {
  const st = { profile, weightLog: [{ date: '2026-11-01', kg: 90 }], settings: {} }
  it('runs from the first weigh-in at the planned pace and stops at the target', () => {
    const p = planPath(st)
    expect(p.at('2026-10-31')).toBeNull()
    expect(p.at('2026-11-01')).toBe(90)
    expect(p.at('2026-11-15')).toBeCloseTo(89, 0) // 0.5 kg a week
    expect(p.at('2028-01-01')).toBe(82)
  })
  it('no path when maintaining, coached or never weighed', () => {
    expect(planPath({ ...st, profile: { ...profile, goal: 'maintain' } })).toBeNull()
    expect(planPath({ ...st, coach: { override: { kcal: 1800 } } })).toBeNull()
    expect(planPath({ profile, weightLog: [] })).toBeNull()
  })
  it('standing waits a week, then says ahead, on or behind', () => {
    expect(planStanding(st, 89.9, '2026-11-04')).toBeNull()
    expect(planStanding(st, 88.4, '2026-11-15').state).toBe('ahead')
    expect(planStanding(st, 89.1, '2026-11-15').state).toBe('on')
    expect(planStanding(st, 90.0, '2026-11-15')).toMatchObject({ state: 'behind', delta: 1 })
  })
})

describe('energyCheck stays calm', () => {
  it('a small difference changes nothing and asks nothing', () => {
    const F = tdee({ ...profile, weightKg: 90 })
    const c = energyCheck(mk({ kcal: F - 550 + 60, perWeek: -0.5 }), T) // reading ≈ formula + 60
    expect(c.changes).toBe(false)
    const st = mk({ kcal: F - 490, perWeek: -0.5 })
    const held = { ...st, ...applyCheck(st, c, 'hold', T) }
    expect(held.profile.burnAdj).toBeUndefined()
    expect(held.settings.adaptAt).toBe(T)
  })
})
