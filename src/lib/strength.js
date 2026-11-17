// Strength trends from the workout log. Weighted sets → estimated 1-rep max (Epley, reps capped at 12);
// bodyweight sets → best reps (or seconds held). One point per training day, best set of the day.
import { addDays } from './day.js'

const setsOf = e => (!e ? [] : e === true ? [] : typeof e === 'number' ? [{ reps: e }] : (e.sets || []).filter(Boolean))
export const e1rm = s => (s.w > 0 && s.reps > 0 ? s.w * (1 + Math.min(s.reps, 12) / 30) : null)

function dayBest(sets) {
  const w = sets.map(e1rm).filter(v => v != null)
  if (w.length) return { v: Math.round(Math.max(...w) * 10) / 10, unit: 'kg' }
  const reps = sets.map(s => s.reps || 0), secs = sets.map(s => s.secs || 0)
  if (Math.max(...reps, 0) > 0) return { v: Math.max(...reps), unit: 'reps' }
  if (Math.max(...secs, 0) > 0) return { v: Math.max(...secs), unit: 's' }
  return null
}

// [{ name, unit, points: [{ date, v }], first, last, change (%), sessions }] most-trained first.
export function strengthTrends(workoutLog = {}, today, weeks = 12, min = 2) {
  const from = addDays(today, -weeks * 7)
  const by = new Map()
  for (const d of Object.keys(workoutLog).filter(k => k >= from && k <= today).sort()) {
    for (const [name, e] of Object.entries(workoutLog[d] || {})) {
      if (name.startsWith('__') || e?.skipped) continue
      const b = dayBest(setsOf(e))
      if (!b) continue
      if (!by.has(name)) by.set(name, { name, unit: b.unit, points: [] })
      const t = by.get(name)
      if (t.unit === b.unit) t.points.push({ date: d, v: b.v })
    }
  }
  return [...by.values()].filter(t => t.points.length >= min).map(t => {
    const first = t.points[0].v, last = t.points.at(-1).v
    return { ...t, first, last, best: Math.max(...t.points.map(p => p.v)), change: first ? Math.round(((last - first) / first) * 100) : 0, sessions: t.points.length }
  }).sort((a, b) => b.sessions - a.sessions || b.last - a.last)
}
