import { describe, it, expect } from 'vitest'
import { HABIT_TEMPLATES, habitsOf, newHabit, addHabitPatch, editHabitPatch, removeHabitPatch, markHabitPatch, habitDone, habitStreak, scheduledOn, seen, MAX_HABITS } from './habits.js'

const key = '2026-11-11'
describe('habits', () => {
  it('adds, edits and removes inside settings.reminders.habits', () => {
    let st = { settings: { reminders: { water: { on: true, h: 15, m: 0 } } } }
    st = { ...st, ...addHabitPatch(st, HABIT_TEMPLATES[1]) }
    expect(habitsOf(st).map(h => h.id)).toEqual(['teeth'])
    expect(st.settings.reminders.water).toBeTruthy() // other reminders untouched
    st = { ...st, ...editHabitPatch(st, 'teeth', { h: 6, m: 45 }) }
    expect(habitsOf(st)[0]).toMatchObject({ h: 6, m: 45, on: true })
    st = { ...st, ...removeHabitPatch(st, 'teeth') }
    expect(habitsOf(st)).toEqual([])
  })
  it('gives custom habits unique ids and caps the list', () => {
    let st = { settings: {} }
    for (let i = 0; i < 9; i++) st = { ...st, ...addHabitPatch(st, { n: 'Read', labels: ['book'] }) }
    expect(habitsOf(st)).toHaveLength(MAX_HABITS)
    expect(new Set(habitsOf(st).map(h => h.id)).size).toBe(MAX_HABITS)
    expect(newHabit([], { n: 'Read a book!!' }.n ? { n: 'Read a book!!', labels: ['book'] } : null).id).toBe('read-a-book')
  })
  it('logs per day and counts the streak', () => {
    let st = {}
    for (const d of ['2026-11-09', '2026-11-10']) st = { ...st, ...markHabitPatch(st, 'teeth', 'camera', d) }
    expect(habitDone(st, 'teeth', '2026-11-10')).toBe(true)
    expect(habitStreak(st, 'teeth', key)).toBe(2) // today not done yet: streak runs to yesterday
    st = { ...st, ...markHabitPatch(st, 'teeth', 'manual', key) }
    expect(habitStreak(st, 'teeth', key)).toBe(3)
    expect(habitStreak(st, 'water', key)).toBe(0)
  })
  it('streak skips days off and forgives one miss, not two in a row', () => {
    const mk = days => days.reduce((st, d) => ({ ...st, ...markHabitPatch(st, 'g', 'camera', d) }), {})
    // 2026-11-11 is a Wednesday. Mon/Wed/Fri habit: done Mon 9th... and the Fri before (6th), Wed 4th, Mon 2nd
    const mwf = [1, 3, 5]
    expect(habitStreak(mk(['2026-11-02', '2026-11-04', '2026-11-06', '2026-11-09']), 'g', key, mwf)).toBe(4) // today (Wed) still open
    expect(habitStreak(mk(['2026-11-02', '2026-11-04', '2026-11-09', '2026-11-11']), 'g', key, mwf)).toBe(4) // missed Fri 6th once: forgiven
    expect(habitStreak(mk(['2026-11-02', '2026-11-11']), 'g', key, mwf)).toBe(1) // missed Wed 4th + Fri 6th + Mon 9th: broken
    expect(scheduledOn({ days: mwf }, '2026-11-10')).toBe(false) // Tuesday
    expect(scheduledOn({ days: [] }, '2026-11-10')).toBe(true)
  })
  it('matches only wanted labels above the bar', () => {
    const dets = [{ label: 'chair', score: 0.9 }, { label: 'cup', score: 0.4 }, { label: 'bottle', score: 0.6 }]
    expect(seen(dets, ['toothbrush'])).toBe(null)
    expect(seen(dets, ['cup'])).toBe(null)
    expect(seen(dets, ['cup', 'bottle']).label).toBe('bottle')
  })
})

import { habitIcon, habitWeek, habitByHand } from './habits.js'
describe('habit look', () => {
  it('icons by template, then by object, else a sparkle', () => {
    expect(habitIcon({ id: 'teeth', labels: ['toothbrush'] })).toBe('🪥')
    expect(habitIcon({ id: 'vitamins-2', labels: ['bottle'] })).toBe('💊')
    expect(habitIcon({ id: 'read', labels: ['book'] })).toBe('📖')
    expect(habitIcon({ id: 'x', labels: ['nope'] })).toBe('✨')
  })
  it('week strip: done, missed, off-day and today', () => {
    const st = { habitLog: { '2026-11-09': { g: 1 }, '2026-11-11': { g: 2 } } }
    const w = habitWeek(st, { id: 'g', days: [1, 2, 3, 5] }, '2026-11-11') // Wed
    expect(w).toHaveLength(7)
    expect(w.map(c => c.st)).toEqual(['off', 'miss', 'off', 'off', 'done', 'miss', 'done']) // Thu5 Fri6 Sat7 Sun8 Mon9 Tue10 Wed11
  })
  it('manual ticks are marked, camera ticks are not', () => {
    const m = markHabitPatch({}, 'g', 'manual', '2026-11-11')
    expect(habitByHand(m, 'g', '2026-11-11')).toBe(true)
    expect(habitByHand(markHabitPatch({}, 'g', 'camera', '2026-11-11'), 'g', '2026-11-11')).toBe(false)
  })
})
