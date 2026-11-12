import { describe, it, expect } from 'vitest'
import { cleanCustom, customToEx, customError, saveCustom, applyCustom, addToDay, removeFromDay, moveInDay, rebuildKeep, libToEx, defaultWeekdays } from './myex.js'
import { mkProg, DEFAULT_INTAKE } from './program.js'
import { LIB } from '../data/library.js'

const sled = cleanCustom({ id: 'c_sled', n: '  Sled   push ', pat: 'push', eq: ['machine'], sets: '4', reps: '20 m', rest: 90, video: { key: 'ex/u/x.mp4' } })

describe('custom exercises', () => {
  it('cleans a draft', () => {
    expect(sled).toMatchObject({ n: 'Sled push', sets: 4, reps: '20 m', rest: 90, eq: ['machine'], video: { key: 'ex/u/x.mp4' } })
    expect(cleanCustom({ n: 'Hang', type: 'hold', reps: '45' }).reps).toBe('45s')
    expect(cleanCustom({ n: 'X', sets: 99 }).sets).toBe(10)
    expect(cleanCustom({ n: 'X' }).eq).toEqual(['none'])
  })
  it('turns into a plan exercise', () => {
    expect(customToEx(sled)).toMatchObject({ id: 'c_sled', name: 'Sled push', custom: true, video: { key: 'ex/u/x.mp4' } })
  })
  it('refuses empty and clashing names', () => {
    expect(customError({ n: 'a' })).toBe('Give it a name')
    expect(customError({ n: 'sled push' }, [sled])).toMatch(/already/)
    expect(customError({ id: 'c_sled', n: 'Sled push' }, [sled])).toBe(null)
    expect(customError({ n: 'push-up' })).toMatch(/library/)
  })
  it('edits flow into the plan, deletes leave it', () => {
    const prog = [{ name: 'A', exercises: [customToEx(sled), { id: 'pushup', name: 'Push-up', sets: 3 }] }]
    const renamed = saveCustom([sled], { ...sled, n: 'Prowler push' })
    expect(applyCustom(prog, renamed)[0].exercises[0].name).toBe('Prowler push')
    expect(applyCustom(prog, [])[0].exercises.map(e => e.name)).toEqual(['Push-up'])
  })
})

describe('editing a plan day', () => {
  const prog = mkProg('lose', DEFAULT_INTAKE)
  it('adds without duplicates, removes but never empties, moves', () => {
    const a = addToDay(prog, 0, customToEx(sled))
    expect(a[0].exercises.at(-1).name).toBe('Sled push')
    expect(addToDay(a, 0, customToEx(sled))).toBe(a)
    const r = removeFromDay(a, 0, a[0].exercises.length - 1)
    expect(r[0].exercises.length).toBe(prog[0].exercises.length)
    const one = [{ name: 'X', exercises: [{ name: 'Y' }] }]
    expect(removeFromDay(one, 0, 0)).toBe(one)
    const m = moveInDay(prog, 0, 0, 1)
    expect(m[0].exercises[0].name).toBe(prog[0].exercises[1].name)
    expect(moveInDay(prog, 0, 0, -1)).toBe(prog)
  })
})

describe('rebuildKeep', () => {
  it('a new setup keeps exercises put in by hand', () => {
    const home = mkProg('lose', DEFAULT_INTAKE)
    const curl = LIB.find(L => L.id === 'lat_pull')
    let mine = addToDay(home, 1, customToEx(sled))
    mine = addToDay(mine, 2, libToEx(curl))
    const gym = rebuildKeep('lose', { ...DEFAULT_INTAKE, loc: 'gym', daysWk: 2 }, mine, [sled])
    expect(gym.length).toBe(2)
    const names = gym.flatMap(d => d.exercises.map(e => e.name))
    expect(names).toContain('Sled push')
    expect(names).toContain('Lat pulldown')
    expect(gym[1].exercises.some(e => e.name === 'Sled push')).toBe(true)
    expect(gym[1].exercises.filter(e => e.name === 'Lat pulldown').length).toBe(1) // never twice in one day
  })
  it('weekday defaults spread the sessions', () => {
    expect(defaultWeekdays(3)).toEqual([0, 2, 4])
    expect(defaultWeekdays(9)).toEqual([0, 1, 2, 3, 4, 5])
  })
})
