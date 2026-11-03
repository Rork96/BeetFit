import { describe, it, expect } from 'vitest'
import { mergeStates } from './sync.js'

const base = { profile: { goal: 'lose', weightKg: 84 }, settings: { units: 'kg' }, _t: { profile: 100, settings: 100 } }

describe('mergeStates', () => {
  it('unions food logged on two phones the same day', () => {
    const a = { ...base, foodLog: { '2026-10-24': [{ at: 1, name: 'Oats' }] } }
    const b = { ...base, foodLog: { '2026-10-24': [{ at: 2, name: 'Eggs' }], '2026-10-23': [{ at: 0, name: 'Rice' }] } }
    const m = mergeStates(a, b)
    expect(m.foodLog['2026-10-24'].map(x => x.name)).toEqual(['Oats', 'Eggs'])
    expect(m.foodLog['2026-10-23']).toHaveLength(1)
  })
  it('keeps the exercise entry with more sets, max water', () => {
    const a = { ...base, workoutLog: { d: { Squat: { sets: [{ reps: 10 }] } } }, water: { d: 3 } }
    const b = { ...base, workoutLog: { d: { Squat: { sets: [{ reps: 10 }, { reps: 9 }] }, 'Push-up': { sets: [{ reps: 12 }] } } }, water: { d: 5 } }
    const m = mergeStates(a, b)
    expect(m.workoutLog.d.Squat.sets).toHaveLength(2)
    expect(m.workoutLog.d['Push-up']).toBeTruthy()
    expect(m.water.d).toBe(5)
  })
  it('takes the most recently edited profile/settings', () => {
    const local = { ...base, settings: { units: 'lb' }, _t: { profile: 100, settings: 300 } }
    const remote = { ...base, profile: { goal: 'gain', weightKg: 80 }, _t: { profile: 200, settings: 100 } }
    const m = mergeStates(local, remote)
    expect(m.settings.units).toBe('lb')
    expect(m.profile.goal).toBe('gain')
    expect(m._t).toEqual({ profile: 200, settings: 300 })
  })
  it('unions weights and measurements by date', () => {
    const a = { ...base, weightLog: [{ date: '2026-10-01', kg: 85 }], measurements: [{ date: '2026-10-01', waist: 90 }] }
    const b = { ...base, weightLog: [{ date: '2026-10-08', kg: 84 }], measurements: [{ date: '2026-10-01', chest: 100 }] }
    const m = mergeStates(a, b)
    expect(m.weightLog.map(w => w.date)).toEqual(['2026-10-01', '2026-10-08'])
    expect(m.measurements[0]).toEqual({ date: '2026-10-01', waist: 90, chest: 100 })
  })
  it('handles a missing side', () => {
    expect(mergeStates(base, null).profile).toBe(base.profile)
    const once = mergeStates(base, null)
    expect(mergeStates(once, once)).toEqual(once)
    expect(mergeStates(null, base)).toBe(base)
  })
})
