import { describe, it, expect } from 'vitest'
import { HABIT_TEMPLATES, habitsOf, newHabit, addHabitPatch, editHabitPatch, removeHabitPatch, markHabitPatch, habitDone, habitStreak, seen, MAX_HABITS } from './habits.js'

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
  it('matches only wanted labels above the bar', () => {
    const dets = [{ label: 'chair', score: 0.9 }, { label: 'cup', score: 0.4 }, { label: 'bottle', score: 0.6 }]
    expect(seen(dets, ['toothbrush'])).toBe(null)
    expect(seen(dets, ['cup'])).toBe(null)
    expect(seen(dets, ['cup', 'bottle']).label).toBe('bottle')
  })
})
