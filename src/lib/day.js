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
  const o = state.coach?.override // set by the client's coach; wins over the formula
  return { kcal: o?.kcal ?? m.kcal, protein: o?.protein ?? m.protein, coach: !!(o?.kcal || o?.protein), fat: m.fat, carbs: m.carbs, water: state.settings?.waterTarget || 8 }
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

// Generated at onboarding (lib/program.js); older installs fall back to the fixed templates.
export function program(state) {
  if (state.program?.length) return { name: planName(state), days: state.program }
  return PROGRAMS[state.profile.goal] || PROGRAMS.maintain
}

function planName(state) {
  const g = { lose: 'Fat loss', maintain: 'Get fit', gain: 'Muscle' }[state.profile.goal] || 'Your plan'
  return `${g} · ${state.program.filter(d => !d.run).length} days/week`
}

// Next training day = the plan day after the last one trained (matched by exercise names, last 14 days).
// Falls back to counting sessions in the last 7 days when nothing matches (e.g. the plan was rebuilt).
export function nextDayIndex(state, key = dayKey()) {
  const days = program(state).days
  for (let i = 1; i <= 14; i++) {
    const k = addDays(key, -i)
    if (setsLogged(state, k) === 0) continue
    const names = new Set(Object.keys(state.workoutLog[k]))
    let best = -1, hit = 0
    days.forEach((d, j) => { const h = d.exercises.filter(e => names.has(e.name)).length; if (h > hit) { hit = h; best = j } })
    if (best >= 0) return (best + 1) % days.length
  }
  let done = 0
  for (let i = 1; i <= 7; i++) if (setsLogged(state, addDays(key, -i)) > 0) done++
  return done % days.length
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

// 0 = Monday … 6 = Sunday
export const weekday = key => { const [y, m, d] = key.split('-').map(Number); return (new Date(y, m - 1, d).getDay() + 6) % 7 }
export const mondayOf = key => addDays(key, -weekday(key))

// A day counts at 2 of 3 tasks. One missed day per Mon–Sun week is covered by a freeze:
// the streak holds through it but doesn't grow. A second miss in the same week ends it.
export function streakInfo(state, key = dayKey()) {
  let days = 0, oldest = null
  const frozen = [], used = new Set()
  let k = dayScore(state, key) >= 2 ? key : addDays(key, -1) // today doesn't break it until it's over
  for (let i = 0; i < 3650; i++, k = addDays(k, -1)) {
    if (dayScore(state, k) >= 2) { days++; oldest = k; continue }
    const wk = mondayOf(k)
    if (used.has(wk)) break
    used.add(wk); frozen.push(k)
  }
  const real = days ? frozen.filter(f => f > oldest) : [] // a freeze only counts inside the streak
  return { days, frozen: real, freezeLeft: !real.some(f => mondayOf(f) === mondayOf(key)) }
}

export const streak = (state, key = dayKey()) => streakInfo(state, key).days

// Mon–Sun of the current week.
export function week(state, key = dayKey()) {
  const monday = mondayOf(key)
  return Array.from({ length: 7 }, (_, i) => {
    const k = addDays(monday, i)
    return { key: k, label: 'MTWTFSS'[i], score: k > key ? null : dayScore(state, k), today: k === key }
  })
}

const foodLogged = (state, k) => (state.foodLog?.[k]?.length || 0) > 0 || state.mealPlan?.date === k

// Weekly review, shown Sunday (this week so far) and Monday (last week). Training, logging, protein, weight trend.
// No calorie verdicts here on purpose: a "you ate under target" line rewards restriction.
export function weekReview(state, key = dayKey()) {
  const dow = weekday(key)
  if (dow !== 6 && dow !== 0) return null
  const start = dow === 6 ? mondayOf(key) : addDays(mondayOf(key), -7)
  const end = addDays(start, 6)
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i)).filter(k => k <= key)
  const planned = program(state).days.length
  const sessions = days.filter(k => setsLogged(state, k) > 0).length
  const logged = days.filter(k => foodLogged(state, k))
  const protein = logged.length ? Math.round(logged.reduce((a, k) => a + eaten(state, k).p, 0) / logged.length) : null
  const series = weightSeries(state, 15, end <= key ? end : key)
  const a = series.find(p => p.key === addDays(start, -1))?.avg, b = series[series.length - 1]?.avg
  const weightChange = a != null && b != null && (state.weightLog || []).filter(w => w.date >= addDays(start, -7)).length >= 2 ? +(b - a).toFixed(1) : null
  return { id: start, final: dow === 0, start, end, sessions, planned, kept: sessions >= planned, foodDays: logged.length, protein, proteinTarget: targets(state).protein, weightChange, goal: state.profile.goal }
}

export const KG_TO_LB = 2.20462
export function fmtWeight(kg, units = 'kg') {
  return units === 'lb' ? `${(kg * KG_TO_LB).toFixed(1)} lb` : `${(+kg).toFixed(1)} kg`
}

// 7-day rolling average over the logged weights (calendar days, not entries).
export function weightSeries(state, days = 30, key = dayKey()) {
  const log = (state.weightLog || []).slice().sort((a, b) => a.date.localeCompare(b.date))
  const byDate = Object.fromEntries(log.map(e => [e.date, e.kg]))
  const start = addDays(key, -(days - 1))
  const out = []
  for (let i = 0; i < days; i++) {
    const k = addDays(start, i)
    const win = []
    for (let j = 0; j < 7; j++) { const v = byDate[addDays(k, -j)]; if (v != null) win.push(v) }
    out.push({ key: k, kg: byDate[k] ?? null, avg: win.length ? win.reduce((a, b) => a + b, 0) / win.length : null })
  }
  return out
}

// kg per week from the rolling average over the last `span` days (null if not enough data).
export function weeklyRate(state, span = 14, key = dayKey()) {
  const s = weightSeries(state, span, key).filter(p => p.avg != null)
  if (s.length < 2) return null
  const daysApart = (Date.parse(s[s.length - 1].key) - Date.parse(s[0].key)) / 864e5
  if (daysApart < 6) return null
  return ((s[s.length - 1].avg - s[0].avg) / daysApart) * 7
}

export function monthGrid(state, year, month) {
  const first = new Date(year, month, 1)
  const lead = (first.getDay() + 6) % 7
  const n = new Date(year, month + 1, 0).getDate()
  const today = dayKey()
  const cells = Array.from({ length: lead }, () => null)
  for (let d = 1; d <= n; d++) {
    const k = dayKey(new Date(year, month, d))
    cells.push({ key: k, d, score: k > today ? null : dayScore(state, k), today: k === today })
  }
  return cells
}
