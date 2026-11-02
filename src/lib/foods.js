// Fast re-logging: the foods you actually eat, and the meal you had in the same slot last time.
import { addDays } from './day.js'

const strip = x => ({ name: x.name, grams: x.grams, kcal: x.kcal, p: x.p, c: x.c, f: x.f, source: x.source, ...(x.code && { code: x.code }), ...(x.est && { est: x.est }) })
const norm = n => String(n || '').trim().toLowerCase()

// Most-logged foods over the last `days` days, most frequent first (ties: most recent).
// Each comes back with the portion you used last time.
export function recentFoods(state, today, n = 8, days = 30) {
  const seen = new Map()
  for (let i = 0; i < days; i++) {
    const k = addDays(today, -i)
    for (const x of state.foodLog?.[k] || []) {
      const id = norm(x.name)
      if (!id) continue
      const cur = seen.get(id)
      if (cur) { cur.count++; continue }
      seen.set(id, { item: strip(x), count: 1, last: k })
    }
  }
  return [...seen.values()].sort((a, b) => b.count - a.count || b.last.localeCompare(a.last)).slice(0, n).map(v => ({ ...v.item, count: v.count }))
}

// The most recent earlier day that has something logged in `slot`, and those items.
export function lastMeal(state, today, slot, days = 14) {
  for (let i = 1; i <= days; i++) {
    const k = addDays(today, -i)
    const items = (state.foodLog?.[k] || []).filter(x => x.slot === slot)
    if (items.length) return { date: k, items: items.map(strip), kcal: Math.round(items.reduce((a, x) => a + (x.kcal || 0), 0)) }
  }
  return null
}

export const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack']
export const slotByHour = (h = new Date().getHours()) => (h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 20 ? 'dinner' : 'snack')

// Cooking fat the camera can't see. Photo estimates run low mostly on fat (NIH test, 2026: ~30 g/meal).
export const FAT_OPTIONS = [
  { id: 'none', label: 'No oil', g: 0 },
  { id: 'some', label: 'A little', g: 5 },
  { id: 'tbsp', label: '1 tbsp', g: 14 },
  { id: 'lots', label: 'Fried', g: 28 }
]
export const fatItem = g => (g > 0 ? { name: 'Cooking oil / butter (est.)', grams: g, kcal: Math.round(g * 8.84), p: 0, c: 0, f: g, source: 'snap', est: true } : null)

// A photo estimate is a range, not a number. ±25% around the point estimate, wider when the model is unsure.
export function kcalRange(kcal, confidence = 0.6) {
  const spread = confidence >= 0.8 ? 0.15 : confidence >= 0.6 ? 0.25 : 0.35
  const r = v => Math.round(v / 10) * 10
  return [r(kcal * (1 - spread)), r(kcal * (1 + spread))]
}

// One CSV with every log, long format: easy to open in Sheets / Excel.
export function toCSV(state) {
  const rows = [['date', 'type', 'item', 'amount', 'unit', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'set', 'weight_kg', 'rpe', 'note']]
  const q = v => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
  for (const k of Object.keys(state.foodLog || {}).sort()) {
    for (const x of state.foodLog[k]) rows.push([k, 'food', x.name, x.grams, 'g', x.kcal, x.p, x.c, x.f, '', '', '', x.slot || ''])
  }
  for (const k of Object.keys(state.workoutLog || {}).sort()) {
    for (const [name, e] of Object.entries(state.workoutLog[k])) {
      if (name.startsWith('__')) continue
      const sets = e === true ? [{}] : typeof e === 'number' ? [{ reps: e }] : e?.sets || []
      sets.forEach((s, i) => { if (s) rows.push([k, 'set', name, s.reps ?? s.secs ?? '', s.secs != null ? 's' : 'reps', '', '', '', '', i + 1, s.w ?? '', s.rpe ?? '', s.auto ? 'camera' : '']) })
      if (e?.skipped) rows.push([k, 'skipped', name, '', '', '', '', '', '', '', '', '', e.pain || ''])
    }
  }
  for (const w of state.weightLog || []) rows.push([w.date, 'weight', 'body weight', w.kg, 'kg', '', '', '', '', '', '', '', ''])
  for (const k of Object.keys(state.water || {}).sort()) if (state.water[k]) rows.push([k, 'water', 'glasses', state.water[k], 'glasses', '', '', '', '', '', '', '', ''])
  return rows.map(r => r.map(q).join(',')).join('\n') + '\n'
}

export function downloadCSV(state) {
  const blob = new Blob(['﻿' + toCSV(state)], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `beetfit-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

// Days that have something logged, newest first (today excluded), grouped by slot, for the History screen.
export function historyDays(state, today, n = 30, span = 120) {
  const out = []
  for (let i = 1; i <= span && out.length < n; i++) {
    const key = addDays(today, -i)
    const items = state.foodLog?.[key] || []
    if (!items.length) continue
    const sum = f => Math.round(items.reduce((a, x) => a + (x[f] || 0), 0))
    out.push({
      key, items, kcal: sum('kcal'), p: sum('p'), c: sum('c'), f: sum('f'),
      slots: SLOTS.filter(sl => items.some(x => x.slot === sl)).map(sl => {
        const its = items.filter(x => x.slot === sl)
        return { slot: sl, items: its, kcal: Math.round(its.reduce((a, x) => a + (x.kcal || 0), 0)) }
      })
    })
  }
  return out
}

// What can be logged again: the same fields the app stores, without the old timestamp.
export const reloggable = x => strip(x)

// Names of everything logged in the last `days` days (so suggestions do not repeat what you just ate).
export function recentNames(state, today, days = 3) {
  const names = new Set()
  for (let i = 0; i <= days; i++) for (const x of state.foodLog?.[addDays(today, -i)] || []) names.add(x.name)
  return [...names]
}
