import { describe, it, expect } from 'vitest'
import { nextDue, localToUtc, localDay, message, eventMessage, cleanEvents, cleanPrefs, DEFAULT_PREFS, validTz } from './reminders.js'

describe('reminder schedule', () => {
  it('converts local wall time across DST', () => {
    // Offsets come from the runtime's tz database
    expect(new Date(localToUtc(2026, 10, 24, 18, 0, 'America/Winnipeg')).toISOString()).toBe('2026-10-24T23:00:00.000Z')
    expect(new Date(localToUtc(2026, 11, 2, 18, 0, 'America/New_York')).toISOString()).toBe('2026-11-02T23:00:00.000Z') // EST after Nov 1
    expect(new Date(localToUtc(2026, 10, 30, 18, 0, 'America/New_York')).toISOString()).toBe('2026-10-30T22:00:00.000Z') // EDT
    expect(new Date(localToUtc(2026, 10, 24, 9, 30, 'Europe/Kyiv')).toISOString()).toBe('2026-10-24T06:30:00.000Z')
  })
  it('picks the next enabled reminder, rolling to tomorrow', () => {
    const p = cleanPrefs(DEFAULT_PREFS) // meals 12:30, workout 18:00, streak 20:30
    const from = Date.parse('2026-10-24T20:00:00Z') // 15:00 in Winnipeg
    expect(nextDue(p, 'America/Winnipeg', from)).toEqual({ at: Date.parse('2026-10-24T23:00:00Z'), kind: 'workout' })
    const late = Date.parse('2026-10-25T00:30:00Z') // 19:30
    expect(nextDue(p, 'America/Winnipeg', late)).toEqual({ at: Date.parse('2026-10-25T01:30:00Z'), kind: 'streak' })
    const later = Date.parse('2026-10-25T02:00:00Z') // 21:00
    expect(nextDue(p, 'America/Winnipeg', later)).toEqual({ at: Date.parse('2026-10-25T17:30:00Z'), kind: 'meals' })
    expect(nextDue(cleanPrefs({ meals: { on: false }, workout: { on: false }, streak: { on: false } }), 'UTC', from)).toBeNull()
  })
  it('local day follows the time zone', () => {
    expect(localDay(Date.parse('2026-10-25T02:00:00Z'), 'America/Winnipeg')).toBe('2026-10-24')
    expect(validTz('America/Winnipeg')).toBe(true)
    expect(validTz('Mars/Olympus')).toBe(false)
  })
  it('stays quiet when the thing is done', () => {
    const d = '2026-10-24'
    expect(message('meals', { foodLog: { [d]: [{}] } }, d)).toBeNull()
    expect(message('meals', { settings: { name: 'Max P' } }, d).body).toMatch(/^Max, nothing logged/)
    expect(message('workout', { workoutLog: { [d]: { Squat: { sets: [{}] } } } }, d)).toBeNull()
    const week = { program: [{}, {}], workoutLog: { '2026-10-22': { A: { sets: [{}] } }, '2026-10-20': { B: { sets: [{}] } } } }
    expect(message('workout', week, d)).toBeNull()
    expect(message('workout', { program: [{}, {}, {}], workoutLog: {} }, d).body).toMatch(/3 sessions left/)
    expect(message('water', { water: { [d]: 8 } }, d)).toBeNull()
    expect(message('water', { water: { [d]: 3 } }, d).body).toBe('3 of 8 glasses so far. Have one now.')
    expect(message('weigh', { weightLog: [{ date: d, kg: 80 }] }, d)).toBeNull()
  })

  it('streak nudge only when yesterday counted and today not yet', () => {
    const d = '2026-10-24', y = '2026-10-23'
    const food = [{ at: 1 }]
    expect(message('streak', null, d)).toBeNull()
    expect(message('streak', { foodLog: { [d]: food } }, d)).toBeNull() // no streak yesterday
    const doc = { foodLog: { [y]: food, [d]: food }, water: { [y]: 8 } }
    expect(message('streak', doc, d).body).toBe('Today isn’t counted yet. Finish your water or do a short session and it is.')
    expect(message('streak', { ...doc, water: { [y]: 8, [d]: 8 } }, d)).toBeNull()
  })
})

describe('calendar events', () => {
  const now = Date.parse('2026-10-24T20:00:00Z')
  it('cleans what the phone sends', () => {
    const ev = cleanEvents([
      { at: now + 3600e3, kind: 'note', title: 'Physio\u0000', body: 'x', url: '/?cal=2026-10-24', tag: 'plan-a1' },
      { at: now + 40 * 864e5, kind: 'note', title: 'too far' },
      { at: now + 7200e3, kind: 'shell', title: 'bad kind' },
      { at: now + 1800e3, kind: 'workout', title: 'Workout at 15:30', url: 'https://evil.example' }
    ], now)
    expect(ev.map(e => e.title)).toEqual(['Workout at 15:30', 'Physio'])
    expect(ev[0].url).toBe('/')
  })
  it('comes before daily reminders when earlier', () => {
    const p = cleanPrefs(DEFAULT_PREFS)
    const ev = [{ at: now + 600e3, kind: 'note', title: 'x' }]
    expect(nextDue(p, 'America/Winnipeg', now, ev)).toEqual({ at: now + 600e3, kind: 'event' })
    expect(nextDue(p, 'America/Winnipeg', now + 601e3, ev).kind).toBe('workout')
  })
  it('is quiet when the planned thing is done', () => {
    const d = '2026-10-24'
    expect(eventMessage({ kind: 'workout', title: 'W', body: '', url: '/', tag: 't' }, { workoutLog: { [d]: { A: { sets: [{}] } } } }, d)).toBeNull()
    expect(eventMessage({ kind: 'weigh', title: 'W' }, { weightLog: [{ date: d }] }, d)).toBeNull()
    expect(eventMessage({ kind: 'note', title: 'Physio', body: 'b', url: '/', tag: 't' }, null, d)).toEqual({ title: 'Physio', body: 'b', url: '/', tag: 't' })
    expect(eventMessage(undefined, null, d)).toBeNull()
  })
})
