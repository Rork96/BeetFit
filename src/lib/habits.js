// Habit check: a reminder at a set time, ticked off by showing the camera a related object.
// Habits live in settings.reminders.habits (so the times travel with the other reminders and sync);
// what was done lives in state.habitLog[day][habitId] = timestamp (merged day by day across devices).
import { dayKey, addDays } from './day.js'

// Labels are MediaPipe's COCO class names. A habit is done when any of its labels is seen.
export const HABIT_TEMPLATES = [
  { id: 'water', n: 'Drink water', labels: ['bottle', 'cup'], ask: 'a glass or a bottle of water', h: 9, m: 0 },
  { id: 'teeth', n: 'Brush teeth', labels: ['toothbrush'], ask: 'your toothbrush', h: 7, m: 30 },
  { id: 'vitamins', n: 'Vitamins', labels: ['bottle', 'cup'], ask: 'the vitamins bottle, or the glass you take them with', h: 8, m: 0 },
  { id: 'breakfast', n: 'Breakfast', labels: ['bowl', 'cup', 'banana', 'apple', 'sandwich', 'orange'], ask: 'your breakfast', h: 8, m: 30 }
]

// For a habit of your own: pick any of these objects the camera can recognise.
export const HABIT_OBJECTS = [
  ['bottle', 'Bottle'], ['cup', 'Cup or mug'], ['toothbrush', 'Toothbrush'], ['bowl', 'Bowl'], ['book', 'Book'],
  ['banana', 'Banana'], ['apple', 'Apple'], ['orange', 'Orange'], ['sandwich', 'Sandwich'], ['sink', 'Sink'],
  ['laptop', 'Laptop'], ['backpack', 'Backpack'], ['chair', 'Chair'], ['sports ball', 'Ball'], ['clock', 'Clock']
]

export const MAX_HABITS = 6
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 16) || 'habit'

export const habitsOf = state => (state.settings?.reminders?.habits || []).filter(h => h && h.id && h.n)
export const habitDone = (state, id, key = dayKey()) => !!state.habitLog?.[key]?.[id]

// A habit from a template or from custom input, with a free id.
export function newHabit(existing, base) {
  let id = base.id || slug(base.n)
  const taken = new Set(existing.map(h => h.id))
  for (let i = 2; taken.has(id); i++) id = `${(base.id || slug(base.n)).slice(0, 13)}-${i}`
  return { id, n: String(base.n).slice(0, 24), labels: base.labels, ask: base.ask || `a ${base.labels[0]}`, h: base.h ?? 9, m: base.m ?? 0, on: true }
}

// State patch helpers (use inside update(prev => ...)).
const patchHabits = (prev, fn) => {
  const cur = prev.settings?.reminders || {}
  return { settings: { ...(prev.settings || {}), reminders: { ...cur, habits: fn(habitsOf(prev)) } } }
}
export const addHabitPatch = (prev, base) => patchHabits(prev, list => (list.length >= MAX_HABITS ? list : [...list, newHabit(list, base)]))
export const editHabitPatch = (prev, id, patch) => patchHabits(prev, list => list.map(h => (h.id === id ? { ...h, ...patch } : h)))
export const removeHabitPatch = (prev, id) => patchHabits(prev, list => list.filter(h => h.id !== id))

export const markHabitPatch = (prev, id, how = 'camera', key = dayKey()) => ({
  habitLog: { ...(prev.habitLog || {}), [key]: { ...(prev.habitLog?.[key] || {}), [id]: Date.now() } },
  habitHow: how
})

// Consecutive days up to today (or up to yesterday if today isn't done yet).
export function habitStreak(state, id, key = dayKey()) {
  let d = habitDone(state, id, key) ? key : addDays(key, -1), n = 0
  while (habitDone(state, id, d)) { n++; d = addDays(d, -1) }
  return n
}

// Detections from the model: [{ label, score }]. Done when a wanted label clears the bar.
export const seen = (dets, labels, min = 0.45) => (dets || []).find(d => labels.includes(d.label) && d.score >= min) || null
