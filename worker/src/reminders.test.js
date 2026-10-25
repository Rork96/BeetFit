import { describe, it, expect } from 'vitest'
import { nextDue, localToUtc, localDay, message, cleanPrefs, DEFAULT_PREFS, validTz } from './reminders.js'

describe('reminder schedule', () => {
  it('converts local wall time across DST', () => {
    // Offsets come from the runtime's tz database
    expect(new Date(localToUtc(2026, 10, 24, 18, 0, 'America/Winnipeg')).toISOString()).toBe('2026-10-24T23:00:00.000Z')
    expect(new Date(localToUtc(2026, 11, 2, 18, 0, 'America/New_York')).toISOString()).toBe('2026-11-02T23:00:00.000Z') // EST after Nov 1
    expect(new Date(localToUtc(2026, 10, 30, 18, 0, 'America/New_York')).toISOString()).toBe('2026-10-30T22:00:00.000Z') // EDT
    expect(new Date(localToUtc(2026, 10, 24, 9, 30, 'Europe/Kyiv')).toISOString()).toBe('2026-10-24T06:30:00.000Z')
  })
  it('picks the next enabled reminder, rolling to tomorrow', () => {
    const p = cleanPrefs(DEFAULT_PREFS) // meals 12:30, workout 18:00
    const from = Date.parse('2026-10-24T20:00:00Z') // 15:00 in Winnipeg
    expect(nextDue(p, 'America/Winnipeg', from)).toEqual({ at: Date.parse('2026-10-24T23:00:00Z'), kind: 'workout' })
    const late = Date.parse('2026-10-25T00:30:00Z') // 19:30
    expect(nextDue(p, 'America/Winnipeg', late)).toEqual({ at: Date.parse('2026-10-25T17:30:00Z'), kind: 'meals' })
    expect(nextDue(cleanPrefs({ meals: { on: false }, workout: { on: false } }), 'UTC', from)).toBeNull()
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
})
