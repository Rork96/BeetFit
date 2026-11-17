import { describe, it, expect } from 'vitest'
import { trainStatus, minGap, suggestLoad, overlapYesterday, lastSession } from './train.js'
import { addDays } from './day.js'

const profile = { sex: 'male', age: 30, heightCm: 180, weightKg: 80, targetKg: 75, goal: 'lose', activity: 'moderate' }
const program = [
  { name: 'A', exercises: [{ name: 'Squat', pattern: 'squat', sets: 3, reps: '8-10', weight: 40 }, { name: 'Row', pattern: 'pull', sets: 3, reps: '10', weight: 20 }] },
  { name: 'B', exercises: [{ name: 'Deadlift', pattern: 'hinge', sets: 3, reps: '6-8', weight: 60 }, { name: 'Press', pattern: 'push', sets: 3, reps: '8', weight: 20 }] },
  { name: 'C', exercises: [{ name: 'Lunge', pattern: 'lunge', sets: 3, reps: '10', weight: 0 }, { name: 'Plank', pattern: 'core', sets: 3, reps: '30s', weight: 0 }] },
]
const WED = '2026-10-28'
const st = log => ({ profile, program, workoutLog: log, foodLog: {}, water: {}, weightLog: [], settings: {} })
const did = (...names) => Object.fromEntries(names.map(n => [n, { sets: [{ reps: 10, w: 40 }] }]))

describe('minGap', () => {
  it('spaces sessions by days per week', () => { expect([2, 3, 4, 5].map(minGap)).toEqual([3, 2, 1, 1]) })
})

describe('trainStatus', () => {
  it('train when nothing logged', () => { expect(trainStatus(st({}), WED)).toMatchObject({ kind: 'train', nextIdx: 0 }) })
  it('done after training today, next is the following day', () => {
    const r = trainStatus(st({ [WED]: did('Squat', 'Row') }), WED)
    expect(r).toMatchObject({ kind: 'done', todayIdx: 0, nextIdx: 1, nextDate: addDays(WED, 2) })
  })
  it('rest the day after a session on a 3-day plan, but never locked', () => {
    const r = trainStatus(st({ [addDays(WED, -1)]: did('Squat', 'Row') }), WED)
    expect(r).toMatchObject({ kind: 'rest', nextIdx: 1, nextDate: addDays(WED, 1) })
  })
  it('train again two days later', () => {
    expect(trainStatus(st({ [addDays(WED, -2)]: did('Squat', 'Row') }), WED).kind).toBe('train')
  })
  it('week done once the planned sessions are in', () => {
    const fri = addDays(WED, 2)
    const log = { [addDays(WED, -2)]: did('Squat'), [WED]: did('Deadlift'), [addDays(WED, 1)]: did('Lunge') }
    expect(trainStatus(st(log), addDays(fri, 1)).kind).toBe('week')
  })
  it('lastSession ignores today', () => { expect(lastSession(st({ [WED]: did('Squat') }), WED)).toBeNull() })
})

describe('overlapYesterday', () => {
  it('flags the same heavy pattern trained yesterday, not core', () => {
    const s = st({ [addDays(WED, -1)]: did('Squat', 'Plank') })
    expect(overlapYesterday(s, 0, WED)).toEqual(['squat'])
    expect(overlapYesterday(s, 2, WED)).toEqual([])
  })
})

describe('suggestLoad', () => {
  const sq = program[0].exercises[0]
  it('adds weight when every set hit the top of the range', () => {
    const log = { [addDays(WED, -2)]: { Squat: { sets: [{ w: 40, reps: 10 }, { w: 40, reps: 10 }, { w: 40, reps: 10 }] } } }
    expect(suggestLoad(log, sq, WED)).toMatchObject({ w: 45, up: true })
  })
  it('repeats the weight when a set fell short', () => {
    const log = { [addDays(WED, -2)]: { Squat: { sets: [{ w: 40, reps: 10 }, { w: 40, reps: 9 }, { w: 40, reps: 8 }] } } }
    expect(suggestLoad(log, sq, WED)).toMatchObject({ w: 40, up: false })
  })
  it('light lifts go up 2.5', () => {
    const row = program[0].exercises[1]
    const log = { [addDays(WED, -2)]: { Row: { sets: [{ w: 20, reps: 10 }, { w: 20, reps: 10 }, { w: 20, reps: 11 }] } } }
    expect(suggestLoad(log, row, WED)).toMatchObject({ w: 22.5, up: true })
  })
  it('nothing for bodyweight or no history', () => {
    expect(suggestLoad({}, sq, WED)).toBeNull()
    expect(suggestLoad({}, program[2].exercises[0], WED)).toBeNull()
  })
})
