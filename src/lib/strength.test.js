import { describe, it, expect } from 'vitest'
import { strengthTrends, e1rm } from './strength.js'

describe('strength trends', () => {
  it('e1RM uses Epley with reps capped', () => {
    expect(e1rm({ w: 100, reps: 5 })).toBeCloseTo(116.67, 1)
    expect(e1rm({ w: 100, reps: 30 })).toBeCloseTo(140, 1)
    expect(e1rm({ reps: 10 })).toBeNull()
  })
  it('one point per day, most-trained first, bodyweight in reps', () => {
    const log = {
      '2026-10-01': { Squat: { sets: [{ w: 60, reps: 5 }, { w: 65, reps: 3 }] }, 'Push-up': { sets: [{ reps: 12 }] }, __warmup: 'done' },
      '2026-10-08': { Squat: { sets: [{ w: 70, reps: 5 }] }, 'Push-up': { sets: [{ reps: 15 }, { reps: 13 }] } },
      '2026-10-15': { Squat: { sets: [{ w: 72.5, reps: 5 }] }, Plank: { sets: [{ secs: 40 }] } },
      '2026-10-20': { Row: { skipped: true, pain: 'back', sets: [] } }
    }
    const t = strengthTrends(log, '2026-10-20')
    expect(t.map(x => x.name)).toEqual(['Squat', 'Push-up'])
    expect(t[0]).toMatchObject({ unit: 'kg', sessions: 3, first: 71.5, last: 84.6 })
    expect(t[0].change).toBe(18)
    expect(t[1]).toMatchObject({ unit: 'reps', first: 12, last: 15, change: 25 })
  })
})
