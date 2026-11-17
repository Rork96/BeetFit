import { describe, it, expect } from 'vitest'
import { toWire, fromWire, applyCoachProgram, progPending, blankEx } from './coachProgram.js'
import { mkProg, DEFAULT_INTAKE } from './program.js'
import { LIB } from '../data/library.js'

describe('coach-built program', () => {
  const plan = mkProg('lose', { ...DEFAULT_INTAKE, loc: 'gym', daysWk: 3 })
  it('round-trips a plan through the wire form', () => {
    const back = fromWire(toWire(plan), { ...DEFAULT_INTAKE, loc: 'gym' })
    expect(back.map(d => d.exercises.map(e => e.name))).toEqual(plan.map(d => d.exercises.map(e => e.name)))
    expect(back[0].exercises[0].sets).toBe(plan[0].exercises[0].sets)
  })
  it('keeps the coach’s sets and reps, and library extras like trackers', () => {
    const w = [{ name: 'Mon', exercises: [{ id: 'pushup', name: 'Push-up', sets: 5, reps: '8', rest: 90 }] }]
    const [d] = fromWire(w)
    expect(d.exercises[0]).toMatchObject({ sets: 5, reps: '8', rest: 90, pattern: 'push' })
    expect(d.exercises[0].trackerId).toBeTruthy()
  })
  it('keeps unknown (custom) exercises by name', () => {
    const [d] = fromWire([{ name: 'X', exercises: [{ id: 'zz', name: 'Sled push', sets: 4, reps: '20 m', rest: 60 }] }])
    expect(d.exercises[0]).toMatchObject({ name: 'Sled push', sets: 4 })
  })
  it('applying keeps the old plan and marks it seen; pending clears', () => {
    const ov = { program: toWire(plan), progAt: 123, at: 123 }
    const st = { program: plan, settings: {} }
    expect(progPending(st, ov)).toBe(true)
    const patch = applyCoachProgram(st, ov)
    expect(patch.prevProgram).toBe(plan)
    expect(progPending({ ...st, settings: patch.settings }, ov)).toBe(false)
  })
  it('blankEx builds a sensible row for any library exercise', () => {
    for (const L of LIB) { const e = blankEx(L); expect(e.name).toBe(L.n); expect(e.reps).toBeTruthy() }
  })
})
