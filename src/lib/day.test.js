import { describe, it, expect } from 'vitest'
import { nextUp, eaten, dayTasks, streakInfo, weekReview, addDays, weekday, nextDayIndex, bestStreak, nextMilestone, prevMilestone, todayStanding } from './day.js'

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

describe('best streak and milestones', () => {
  it('finds the longest run with the same freeze rule', () => {
    // 5-day run (with one frozen day inside), a break, then 2 days
    const run = [-14, -13, -11, -10, -9, -8].map(i => addDays(SUN, i))
    const s = stateWith([...run, addDays(SUN, -1), SUN])
    expect(bestStreak(s, SUN)).toBe(6)
    expect(streakInfo(s, SUN).days).toBe(2)
    expect(bestStreak(stateWith([]), SUN)).toBe(0)
  })
  it('milestones', () => {
    expect(nextMilestone(0)).toBe(3)
    expect(nextMilestone(7)).toBe(14)
    expect(nextMilestone(400)).toBe(500)
    expect(prevMilestone(8)).toBe(7)
    expect(prevMilestone(2)).toBe(0)
  })
  it('today standing', () => {
    expect(todayStanding(stateWith([SUN]), SUN)).toMatchObject({ done: 2, need: 0 })
    expect(todayStanding(stateWith([]), SUN).need).toBe(2)
  })
})

describe('streak pause', () => {
  it('paused days neither count nor break, and best streak skips them too', () => {
    // 3 good days, 3 paused (no logs, would need 3 freezes), then 2 good days up to SUN
    const good = [-7, -6, -5, -1, 0].map(i => addDays(SUN, i))
    const s = stateWith(good, { pauses: [{ from: addDays(SUN, -4), to: addDays(SUN, -2) }] })
    expect(streakInfo(s, SUN).days).toBe(5)
    expect(bestStreak(s, SUN)).toBe(5)
    expect(streakInfo(stateWith(good), SUN).days).toBe(2) // without the pause it breaks
  })
})

describe('suggested meals are not eaten food', () => {
  const k = '2026-11-02'
  const plan = { date: k, slot: 'lunch', items: [{ name: 'Idea', slot: 'lunch', kcal: 600, p: 40, c: 60, f_: 20 }] }
  it('eaten() ignores mealPlan', () => {
    expect(eaten({ mealPlan: plan, foodLog: {} }, k)).toMatchObject({ kcal: 0, p: 0, items: 0 })
  })
  it('the food task and streak do not count a suggestion', () => {
    const st = { profile, mealPlan: plan, foodLog: {} }
    expect(dayTasks(st, k).find(t => t.id === 'food').done).toBe(false)
    const logged = { ...st, foodLog: { [k]: [{ name: 'Rice', kcal: 260, p: 5, c: 56, f: 1 }] } }
    expect(dayTasks(logged, k).find(t => t.id === 'food').done).toBe(true)
  })
  it('eaten() counts logged food only', () => {
    const st = { mealPlan: plan, foodLog: { [k]: [{ name: 'Rice', kcal: 260, p: 5, c: 56, f: 1 }] } }
    expect(eaten(st, k)).toMatchObject({ kcal: 260, items: 1 })
  })
})

describe('nextUp by time of day', () => {
  const T = '2026-11-02'
  const base = { profile: { sex: 'male', age: 30, heightCm: 180, weightKg: 90, targetKg: 80, activity: 'moderate', goal: 'lose' }, settings: {}, weightLog: [{ date: T, kg: 90 }], foodLog: {}, water: {}, workoutLog: {} }
  it('morning with nothing scheduled: breakfast first, then the workout', () => {
    expect(nextUp(base, T, { hour: 7.5 }).id).toBe('food')
    const fed = { ...base, foodLog: { [T]: [{ name: 'Eggs', kcal: 150, p: 12, c: 1, f: 10, grams: 100 }] } }
    expect(nextUp(fed, T, { hour: 7.5 }).id).toBe('train')
  })
  it('daytime: workout first; after 21:00 do not start one', () => {
    expect(nextUp(base, T, { hour: 17 }).id).toBe('train')
    expect(nextUp(base, T, { hour: 22 }).id).toBe('food')
    const fed = { ...base, foodLog: { [T]: [{ name: 'Eggs', kcal: 150, p: 12, c: 1, f: 10, grams: 100 }] } }
    expect(nextUp(fed, T, { hour: 22 }).id).toBe('water')
  })
  it('a scheduled workout wins from 90 minutes before its time', () => {
    expect(nextUp(base, T, { hour: 15, workoutTime: '18:30' }).id).toBe('food')
    expect(nextUp(base, T, { hour: 17.1, workoutTime: '18:30' }).id).toBe('train')
    expect(nextUp(base, T, { hour: 7, workoutTime: '07:30' }).id).toBe('train')
  })
})

describe('nextUp', () => {
  const T = '2026-11-02'
  const base = { profile: { sex: 'male', age: 30, heightCm: 180, weightKg: 90, targetKg: 80, activity: 'moderate', goal: 'lose' }, settings: {}, weightLog: [{ date: T, kg: 90 }], foodLog: {}, water: {}, workoutLog: {} }
  const food = { foodLog: { [T]: [{ name: 'Eggs', kcal: 150, p: 12, c: 1, f: 10, grams: 100 }] } }
  const rest = { plans: [{ id: 'w', auto: 'week', kind: 'workout', repeat: 'weekly', date: addDays(T, 1) }] } // training day is tomorrow, so today is a rest day
  it('starts with the workout, then food, then water, then done', () => {
    expect(nextUp(base, T, { hour: 14 }).id).toBe('train')
    expect(nextUp({ ...base, workoutLog: { [T]: { goblet: { sets: [{ reps: 8, kg: 20 }] } } } }, T, { hour: 14 }).id).toBe('food') // trained → next is the first meal
  })
  it('rest day skips the workout', () => {
    expect(nextUp({ ...base, ...rest }, T).id).toBe('food')
    expect(nextUp({ ...base, ...rest, ...food }, T).id).toBe('water')
    expect(nextUp({ ...base, ...rest, ...food, water: { [T]: 8 } }, T).id).toBe('done')
  })
  it('asks for a weigh-in when the last one is a week old, before water', () => {
    const s = { ...base, ...rest, ...food, weightLog: [{ date: addDays(T, -8), kg: 90 }] }
    expect(nextUp(s, T)).toEqual({ id: 'weigh', last: addDays(T, -8) })
    expect(nextUp({ ...s, weightLog: [{ date: addDays(T, -6), kg: 90 }] }, T).id).toBe('water')
  })
})
