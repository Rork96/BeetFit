import { describe, it, expect } from 'vitest'
import { streakInfo, weekReview, addDays, weekday, nextDayIndex } from './day.js'

const profile = { sex: 'male', age: 30, heightCm: 180, weightKg: 80, targetKg: 75, goal: 'lose', activity: 'moderate' }
const program = [{ name: 'A', exercises: [] }, { name: 'B', exercises: [] }, { name: 'C', exercises: [] }]

// Build a state where the given days hit 2 of 3 tasks (food + train).
function stateWith(goodDays, extra = {}) {
  const foodLog = {}, workoutLog = {}
  for (const k of goodDays) {
    foodLog[k] = [{ name: 'x', kcal: 500, p: 40, c: 50, f: 10 }]
    workoutLog[k] = { Squat: { sets: [{ reps: 10 }] } }
  }
  return { profile, program, settings: {}, foodLog, workoutLog, water: {}, weightLog: [], ...extra }
}

const SUN = '2026-10-25' // Sunday
const MON = '2026-10-26'

describe('streakInfo', () => {
  it('counts consecutive good days', () => {
    const s = stateWith([SUN, addDays(SUN, -1), addDays(SUN, -2)])
    expect(streakInfo(s, SUN)).toMatchObject({ days: 3, frozen: [], freezeLeft: true })
  })

  it('today does not break the streak before it is over', () => {
    const s = stateWith([addDays(SUN, -1), addDays(SUN, -2)])
    expect(streakInfo(s, SUN).days).toBe(2)
  })

  it('one missed day in a week is frozen, not reset', () => {
    // Thu, Fri good; Sat missed; Sun good
    const s = stateWith([SUN, addDays(SUN, -2), addDays(SUN, -3)])
    const r = streakInfo(s, SUN)
    expect(r.days).toBe(3)
    expect(r.frozen).toEqual([addDays(SUN, -1)])
    expect(r.freezeLeft).toBe(false)
  })

  it('a second miss in the same week ends it', () => {
    // Wed good; Thu missed; Fri good; Sat missed; Sun good
    const s = stateWith([SUN, addDays(SUN, -2), addDays(SUN, -4)])
    const r = streakInfo(s, SUN)
    expect(r.days).toBe(2)
    expect(r.frozen).toEqual([addDays(SUN, -1)])
  })

  it('freeze resets on Monday', () => {
    // Sun missed (last week's freeze), Mon good, Tue missed today's week freeze
    const s = stateWith([MON, addDays(MON, -2)])
    const r = streakInfo(s, addDays(MON, 1)) // Tuesday, not done yet
    expect(r.days).toBe(2)
    expect(r.freezeLeft).toBe(true)
  })

  it('no history means no streak and no phantom freezes', () => {
    expect(streakInfo(stateWith([]), SUN)).toMatchObject({ days: 0, frozen: [] })
  })
})

describe('weekReview', () => {
  it('only on Sunday and Monday', () => {
    expect(weekday(SUN)).toBe(6)
    expect(weekReview(stateWith([]), addDays(SUN, -1))).toBeNull()
    expect(weekReview(stateWith([]), SUN)).not.toBeNull()
    expect(weekReview(stateWith([]), MON)).not.toBeNull()
    expect(weekReview(stateWith([]), addDays(MON, 1))).toBeNull()
  })

  it('Monday reviews the previous Mon–Sun', () => {
    const wk = [0, 2, 4].map(i => addDays(SUN, -6 + i)) // Mon, Wed, Fri
    const r = weekReview(stateWith(wk), MON)
    expect(r).toMatchObject({ start: addDays(SUN, -6), end: SUN, sessions: 3, planned: 3, kept: true, foodDays: 3, protein: 40, final: true })
  })

  it('weight change from the 7-day average', () => {
    const weightLog = []
    for (let i = -13; i <= 0; i++) weightLog.push({ date: addDays(SUN, i), kg: i < -6 ? 81 : 80 })
    const r = weekReview(stateWith([], { weightLog }), MON)
    expect(r.weightChange).toBe(-1)
  })

  it('no weight change without weigh-ins', () => {
    expect(weekReview(stateWith([]), MON).weightChange).toBeNull()
  })
})

describe('nextDayIndex', () => {
  const plan = [{ name: 'A', exercises: [{ name: 'Squat' }, { name: 'Row' }] }, { name: 'B', exercises: [{ name: 'Press' }, { name: 'Lunge' }] }, { name: 'C', exercises: [{ name: 'Deadlift' }] }]
  const s = log => ({ profile, program: plan, workoutLog: log })
  it('goes to the day after the last one trained', () => {
    // three sessions in the window used to wrap back to A after A
    const log = { [addDays(SUN, -6)]: { Squat: { sets: [{ reps: 5 }] } }, [addDays(SUN, -4)]: { Press: { sets: [{ reps: 5 }] } }, [addDays(SUN, -2)]: { Deadlift: { sets: [{ reps: 5 }] } }, [SUN]: { Squat: { sets: [{ reps: 5 }] }, Row: { sets: [{ reps: 5 }] } } }
    expect(nextDayIndex(s(log), addDays(SUN, 1))).toBe(1)
    expect(nextDayIndex(s(log), SUN)).toBe(0) // today itself isn't counted
  })
  it('starts at day A with no history', () => { expect(nextDayIndex(s({}), SUN)).toBe(0) })
  it('ignores warm-up only days', () => { expect(nextDayIndex(s({ [addDays(SUN, -1)]: { __warmup: 'done' } }), SUN)).toBe(0) })
})
