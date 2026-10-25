import { describe, it, expect } from 'vitest'
import { summarize, overview, cleanCode, CODE_RE } from './coach.js'
import { addDays, targets } from './day.js'

const today = '2026-10-24'
const base = () => ({
  profile: { goal: 'lose', sex: 'male', age: 30, heightCm: 180, weightKg: 90, targetKg: 80, activity: 'moderate' },
  settings: { name: 'Max', waterTarget: 8 },
  program: [{ name: 'A', exercises: [{ name: 'Squat' }] }, { name: 'B', exercises: [{ name: 'Row' }] }, { name: 'C', exercises: [{ name: 'Press' }] }],
  weightLog: [], foodLog: {}, workoutLog: {}, water: {}, checkins: {}, painFlags: []
})

describe('coach numbers', () => {
  it('summarizes the last 7 days', () => {
    const s = base()
    s.workoutLog[today] = { Squat: { sets: [{ reps: 10 }] } }
    s.workoutLog[addDays(today, -2)] = { Row: { sets: [{ reps: 10 }] } }
    s.foodLog[today] = [{ at: 1, kcal: 600, p: 40, c: 50, f: 20 }]
    s.water[today] = 8
    const sum = summarize(s, today)
    expect(sum).toMatchObject({ name: 'Max', goal: 'lose', sessions: 2, planned: 3, logDays: 1, last: today, pain: 0 })
    expect(sum.adh).toBe(Math.round(100 * (3 + 1) / 21))
  })
  it('flags pain, quiet days, missed sessions, weight going the wrong way, short sleep', () => {
    const s = base()
    s.painFlags = [{ date: addDays(today, -1), exercise: 'Squat', area: 'knee' }, { date: addDays(today, -30), exercise: 'Row', area: 'back' }]
    for (let i = 13; i >= 4; i--) s.weightLog.push({ date: addDays(today, -i), kg: 90 + (13 - i) * 0.1 })
    s.checkins[addDays(today, -4)] = { sleep: 5, mood: 2 }
    const o = overview(s, today)
    const titles = o.alerts.map(a => a.t)
    expect(titles).toContain('Pain: knee')
    expect(titles).not.toContain('Pain: back')
    expect(titles).toContain('Quiet for 4 days')
    expect(titles).toContain('3 sessions missed')
    expect(titles).toContain('Weight trending up')
    expect(titles).toContain('Short sleep')
    expect(o.checkin).toMatchObject({ sleep: 5, mood: 2 })
    expect(o.weeks).toHaveLength(4)
  })
  it('clean week has no flags', () => {
    const s = base()
    for (let i = 0; i < 7; i++) {
      const k = addDays(today, -i)
      s.foodLog[k] = [{ at: i, kcal: targets(s).kcal, p: 150, c: 200, f: 60 }]
      if (i % 2 === 0) s.workoutLog[k] = { Squat: { sets: [{ reps: 8 }] } }
    }
    expect(overview(s, today).alerts).toEqual([])
  })
  it('coach override wins over the formula', () => {
    const s = { ...base(), coach: { override: { kcal: 2100, protein: null } } }
    expect(targets(s).kcal).toBe(2100)
    expect(targets(s).protein).toBe(targets(base()).protein)
    expect(targets(s).coach).toBe(true)
  })
  it('code input is cleaned', () => {
    expect(cleanCode('k7p-q2x')).toBe('K7PQ2X')
    expect(CODE_RE.test('K7PQ2X')).toBe(true)
    expect(CODE_RE.test('K7PQ0X')).toBe(false)
  })
})
