import { describe, it, expect } from 'vitest'
import { mkProg, paceInfo, planWhy, activityFrom, exPool, DEFAULT_INTAKE } from './program.js'

const it_ = (p = {}) => ({ ...DEFAULT_INTAKE, ...p })
const names = prog => prog.flatMap(d => d.exercises.map(e => e.name))

describe('mkProg', () => {
  it('home, no equipment → bodyweight only, 3 full-body days', () => {
    const prog = mkProg('lose', it_())
    expect(prog.map(d => d.name)).toEqual(['Full Body A', 'Full Body B', 'Full Body C'])
    expect(names(prog)).not.toContain('Goblet squat')
    expect(names(prog)).not.toContain('Bench press')
    expect(names(prog)).toContain('Bodyweight squat')
  })
  it('no repeats inside a session', () => {
    for (const d of mkProg('maintain', it_({ loc: 'gym', exp: 'regular', daysWk: 4 }))) {
      const n = d.exercises.map(e => e.name)
      expect(new Set(n).size).toBe(n.length)
    }
  })
  it('gym + regular → 4-day upper/lower with loaded lifts', () => {
    const prog = mkProg('gain', it_({ loc: 'gym', exp: 'regular', daysWk: 4 }))
    expect(prog.map(d => d.name)).toEqual(['Lower A', 'Upper A', 'Lower B', 'Upper B'])
    expect(names(prog).some(n => /Back squat|Romanian deadlift|Bench press/.test(n))).toBe(true)
  })
  it('beginners get rep ranges and no advanced moves', () => {
    const prog = mkProg('lose', it_({ loc: 'gym' }))
    expect(names(prog)).not.toContain('Back squat')
    expect(prog[0].exercises.find(e => !e.reps.endsWith('s')).reps).toMatch(/^\d+-\d+/)
  })
  it('knee injury removes squats and lunges', () => {
    const prog = mkProg('lose', it_({ injuries: 'left knee pain' }))
    expect(prog.flatMap(d => d.exercises).some(e => e.pattern === 'squat' || e.pattern === 'lunge')).toBe(false)
  })
  it('home kit is used when owned', () => {
    const pool = exPool(it_({ loc: 'home, basic', ownEq: ['dumbbell'] })).map(l => l.n)
    expect(pool).toContain('Goblet squat')
    expect(pool).not.toContain('Lat pulldown')
  })
  it('adds a run day when asked (not for gain)', () => {
    expect(mkProg('lose', it_({ running: true })).at(-1).run).toBe(true)
    expect(mkProg('gain', it_({ running: true })).some(d => d.run)).toBe(false)
  })
  it('camera tracker ids are attached', () => {
    const all = mkProg('lose', it_()).flatMap(d => d.exercises)
    expect(all.find(e => e.name === 'Bodyweight squat').trackerId).toBe('squat')
  })
})

describe('paceInfo', () => {
  const prof = { weightKg: 90, targetKg: 80 }
  it('warns when loss is faster than 1 %/week and suggests months', () => {
    const p = paceInfo(prof, { timeframe: 1 })
    expect(p.tone).toBe('warn')
    expect(p.sugg).toBeGreaterThanOrEqual(3)
  })
  it('accepts a sane pace', () => {
    expect(paceInfo(prof, { timeframe: 6 }).tone).toBe('ok')
  })
})

describe('planWhy / activity', () => {
  it('explains from answers', () => {
    const intake = it_({ sugary: 'daily', prevAttempt: 'lost it, gained it back' })
    const why = planWhy(intake, mkProg('lose', intake))
    expect(why.join(' ')).toMatch(/sugary drinks/)
    expect(why.join(' ')).toMatch(/Regain/)
  })
  it('derives activity', () => {
    expect(activityFrom(it_({ work: 'sedentary', stepsR: '<5k', daysWk: 3 }))).toBe('sedentary')
    expect(activityFrom(it_({ work: 'physical labor' }))).toBe('active')
  })
})

describe('exercise priority', () => {
  it('prefers compound lifts over isolation within a pattern', () => {
    const prog = mkProg('lose', it_({ loc: 'home, basic', ownEq: ['dumbbell'], injuries: 'left knee' }))
    const a = prog[0].exercises.map(e => e.name)
    expect(a).toContain('Push-up')
    expect(a).not.toContain('Lateral raises')
    expect(a).toContain('Table row')
  })
})
