// Day-level derivations shared by Today, Meals, Workout and Progress. One source of truth per number.
import { macros } from './calories.js'
import { PROGRAMS } from '../data/workouts.js'

// Local calendar date (not UTC — an evening log in Winnipeg must land on today).
export function dayKey(d = new Date()) {
  const z = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}

export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number)
  return dayKey(new Date(y, m - 1, d + n))
}

export function currentWeight(state) {
  const log = state.weightLog || []
  return log.length ? log[log.length - 1].kg : state.profile.weightKg
}

export function targets(state) {
  const m = macros({ ...state.profile, weightKg: currentWeight(state) })
  return { kcal: m.kcal, protein: m.protein, fat: m.fat, carbs: m.carbs, water: state.settings?.waterTarget || 8 }
}

// Eaten = today's plan meals (if generated for that day) + everything logged by scan, photo or search.
export function eaten(state, key = dayKey()) {
  const plan = state.mealPlan?.date === key ? state.mealPlan.items : []
  const logged = state.foodLog?.[key] || []
  const t = { kcal: 0, p: 0, c: 0, f: 0, items: plan.length + logged.length }
  for (const m of plan) { t.kcal += m.kcal; t.p += m.p; t.c += m.c; t.f += m.f_ ?? 0 }
  for (const m of logged) { t.kcal += m.kcal; t.p += m.p; t.c += m.c; t.f += m.f }
  return { ...t, kcal: Math.round(t.kcal), p: Math.round(t.p), c: Math.round(t.c), f: Math.round(t.f) }
}

export const waterOf = (state, key = dayKey()) => state.water?.[key] || 0

export function setsLogged(state, key = dayKey()) {
  const day = state.workoutLog?.[key] || {}
  return Object.values(day).reduce((n, e) => n + (e === true || typeof e === 'number' ? 1 : (e?.sets?.length || 0)), 0)
}

export function program(state) {
  return PROGRAMS[state.profile.goal] || PROGRAMS.maintain
}

// Next training day = rotate through the program by sessions done in the last 7 days.
export function nextDayIndex(state, key = dayKey()) {
  const days = program(state).days.length
  let done = 0
  for (let i = 1; i <= 7; i++) if (setsLogged(state, addDays(key, -i)) > 0) done++
  return done % days
}

// Three daily tasks: log food, hit water, train. A day "counts" for the streak at 2 of 3.
export function dayTasks(state, key = dayKey()) {
  const t = targets(state)
  return [
    { id: 'food', label: 'Log what you eat', done: (state.foodLog?.[key]?.length || 0) > 0 || state.mealPlan?.date === key },
    { id: 'water', label: `Drink ${t.water} glasses of water`, done: waterOf(state, key) >= t.water },
    { id: 'train', label: 'Train', done: setsLogged(state, key) > 0 }
  ]
}

export const dayScore = (state, key) => dayTasks(state, key).filter(t => t.done).length

export function streak(state, key = dayKey()) {
  let n = 0
  let k = dayScore(state, key) >= 2 ? key : addDays(key, -1) // today doesn't break it until it's over
  while (dayScore(state, k) >= 2 && n < 3650) { n++; k = addDays(k, -1) }
  return n
}

// Mon–Sun of the current week.
export function week(state, key = dayKey()) {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const monday = addDays(key, -((date.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const k = addDays(monday, i)
    return { key: k, label: 'MTWTFSS'[i], score: k > key ? null : dayScore(state, k), today: k === key }
  })
}

export const KG_TO_LB = 2.20462
export function fmtWeight(kg, units = 'kg') {
  return units === 'lb' ? `${(kg * KG_TO_LB).toFixed(1)} lb` : `${(+kg).toFixed(1)} kg`
}
