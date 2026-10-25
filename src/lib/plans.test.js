import { describe, it, expect } from 'vitest'
import { occursOn, plansOn, planEvents, setWeekPlan, weekPlanOf, toICS, dropPlan, toggleNote, planDone } from './plans.js'
import { weekday } from './day.js'

const MON = '2026-10-26'
const base = { profile: { weightKg: 80 }, workoutLog: {}, weightLog: [] }

describe('plans', () => {
  const weekly = { id: 'w1', kind: 'workout', title: 'Legs', date: MON, time: '18:00', repeat: 'weekly', remind: true }
  const once = { id: 'n1', kind: 'note', title: 'Physio', date: '2026-10-28', time: '09:15', repeat: 'none', remind: true }

  it('weekly repeats on the same weekday from its start, minus skipped days', () => {
    expect(occursOn(weekly, '2026-10-19')).toBe(false)
    expect(occursOn(weekly, MON)).toBe(true)
    expect(occursOn(weekly, '2026-11-02')).toBe(true)
    expect(occursOn(weekly, '2026-10-27')).toBe(false)
    expect(occursOn({ ...weekly, skip: ['2026-11-02'] }, '2026-11-02')).toBe(false)
    expect(occursOn(once, '2026-10-28')).toBe(true)
    expect(occursOn(once, '2026-11-04')).toBe(false)
  })

  it('lists a day by time, drops one occurrence or the whole series', () => {
    const st = { ...base, plans: [weekly, { ...once, date: MON, time: '07:00' }] }
    expect(plansOn(st, MON).map(p => p.id)).toEqual(['n1', 'w1'])
    const one = dropPlan(st.plans, weekly, MON, false)
    expect(occursOn(one.find(p => p.id === 'w1'), MON)).toBe(false)
    expect(occursOn(one.find(p => p.id === 'w1'), '2026-11-02')).toBe(true)
    expect(dropPlan(st.plans, weekly, MON, true).map(p => p.id)).toEqual(['n1'])
  })

  it('notes tick per day; workouts are done when sets are logged', () => {
    const t = toggleNote([once], once, '2026-10-28')
    expect(planDone({ ...base }, t[0], '2026-10-28')).toBe(true)
    expect(planDone({ ...base, workoutLog: { [MON]: { Squat: { sets: [{ reps: 5 }] } } } }, weekly, MON)).toBe(true)
  })

  it('builds push events for the next two weeks, skipping past and done ones', () => {
    const st = { ...base, plans: [weekly, once, { ...once, id: 'x', remind: false }] }
    const now = new Date(2026, 9, 26, 19, 0).getTime() // Mon 19:00, after today's 18:00 workout
    const ev = planEvents(st, now)
    expect(ev[0]).toMatchObject({ kind: 'note', title: 'Physio', url: '/?cal=2026-10-28' })
    expect(ev[0].at).toBe(new Date(2026, 9, 28, 9, 15).getTime())
    expect(ev.filter(e => e.kind === 'workout')).toHaveLength(2) // Nov 2, Nov 9
    const done = { ...st, workoutLog: { '2026-11-02': { A: { sets: [{ reps: 1 }] } } } }
    expect(planEvents(done, now).filter(e => e.kind === 'workout')).toHaveLength(1)
  })

  it('plan my week replaces the previous set', () => {
    let plans = setWeekPlan([once], [0, 2, 4], '07:30', true, '2026-10-24') // from a Saturday
    expect(plans.filter(p => p.auto === 'week').map(p => p.date)).toEqual(['2026-10-26', '2026-10-28', '2026-10-30'])
    expect(weekPlanOf({ plans })).toEqual({ days: [0, 2, 4], time: '07:30', remind: true })
    plans = setWeekPlan(plans, [5], '10:00', false, '2026-10-24')
    expect(plans.map(p => p.id)).toContain('n1')
    expect(plans.filter(p => p.auto === 'week').map(p => weekday(p.date))).toEqual([5])
  })

  it('exports a valid calendar file', () => {
    const ics = toICS([{ ...weekly, skip: ['2026-11-02'] }, { ...once, title: 'Physio, knee; 2nd', time: null, remind: false }], new Date('2026-10-24T12:00:00Z'))
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/)
    expect(ics).toContain('DTSTART:20261026T180000\r\nDURATION:PT60M\r\nRRULE:FREQ=WEEKLY\r\nEXDATE:20261102T180000')
    expect(ics).toContain('TRIGGER:-PT10M')
    expect(ics).toContain('SUMMARY:Physio\\, knee\\; 2nd')
    expect(ics).toContain('DTSTART;VALUE=DATE:20261028\r\nDTEND;VALUE=DATE:20261029')
    expect(ics.split('\r\n').every(l => l.length <= 75)).toBe(true)
    expect((ics.match(/BEGIN:VEVENT/g) || []).length).toBe(2)
  })
})
