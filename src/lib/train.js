// What the Train tab should recommend today. Nothing is ever locked: these are suggestions,
// the person can always start any day (Hevy/Strong let you start any routine; Fitbod suggests
// the freshest muscles and lets you override).
import { dayKey, addDays, setsLogged, program, nextDayIndex, mondayOf, isRestDay } from './day.js'

// Days between sessions the plan assumes. 2/wk → every 3rd day, 3/wk → every other day, 4+/wk → back-to-back is fine.
export const minGap = perWeek => (perWeek <= 2 ? 3 : perWeek === 3 ? 2 : 1)

const trainedDays = (state, key) => Object.keys(state.workoutLog || {}).filter(k => k <= key && setsLogged(state, k) > 0).sort()

export function lastSession(state, key = dayKey()) {
  const ks = trainedDays(state, addDays(key, -1))
  return ks.length ? ks[ks.length - 1] : null
}
const gapDays = (a, b) => Math.round((Date.parse(b + 'T12:00') - Date.parse(a + 'T12:00')) / 864e5)

// Which plan day a logged date matches best (by exercise names).
export function dayIndexOf(state, k) {
  const names = new Set(Object.keys(state.workoutLog?.[k] || {}))
  let best = -1, hit = 0
  program(state).days.forEach((d, j) => { const h = d.exercises.filter(e => names.has(e.name)).length; if (h > hit) { hit = h; best = j } })
  return best
}

/** kind: 'done' (trained today) | 'rest' (too soon after the last session) | 'week' (week's sessions done) | 'train' */
export function trainStatus(state, key = dayKey()) {
  const days = program(state).days
  const planned = days.filter(d => !d.run).length || days.length
  const gap = minGap(planned)
  const mon = mondayOf(key)
  const thisWeek = trainedDays(state, key).filter(k => k >= mon)
  const doneIdx = new Set(thisWeek.map(k => dayIndexOf(state, k)).filter(i => i >= 0))
  const nextIdx = nextDayIndex(state, key)

  if (setsLogged(state, key) > 0) {
    const today = dayIndexOf(state, key)
    const after = today >= 0 ? (today + 1) % days.length : nextIdx
    return { kind: 'done', todayIdx: today, nextIdx: after, nextDate: addDays(key, gap), sessions: thisWeek.length, planned, doneIdx }
  }
  if (thisWeek.length >= planned) return { kind: 'week', nextIdx, nextDate: addDays(mon, 7), sessions: thisWeek.length, planned, doneIdx }
  const last = lastSession(state, key)
  if (last && gapDays(last, key) < gap) {
    return { kind: 'rest', nextIdx, nextDate: addDays(last, gap), last, sessions: thisWeek.length, planned, doneIdx }
  }
  return { kind: 'train', nextIdx, sessions: thisWeek.length, planned, doneIdx }
}

// trainStatus reconciled with the calendar: weekly training days and a workout put on today's date win over the gap rule,
// so Today and Train always agree on whether today is a rest day.
export function planStatus(state, key = dayKey()) {
  const ts = trainStatus(state, key)
  if (ts.kind === 'done') return ts
  const rest = isRestDay(state, key)
  if (rest && ts.kind === 'train') {
    let i = 1; while (i < 14 && isRestDay(state, addDays(key, i))) i++
    return { ...ts, kind: 'rest', nextDate: addDays(key, i) }
  }
  if (!rest && (ts.kind === 'rest' || ts.kind === 'week')) return { ...ts, kind: 'train' }
  return ts
}

// Movement patterns trained on a date (squat, hinge, push, pull, lunge, core…).
export function patternsOn(state, k) {
  const byName = {}
  program(state).days.forEach(d => d.exercises.forEach(e => { if (e.pattern) byName[e.name] = e.pattern }))
  return new Set(Object.keys(state.workoutLog?.[k] || {}).filter(n => !n.startsWith('__') && setsLogged({ workoutLog: { x: { [n]: state.workoutLog[k][n] } } }, 'x') > 0).map(n => byName[n]).filter(Boolean))
}

// Patterns of plan day `i` that were already trained yesterday. Core and carries recover fast, so they don't count.
const SLOW = new Set(['squat', 'hinge', 'lunge', 'push', 'pull', 'vpush', 'vpull', 'hpush', 'hpull'])
export function overlapYesterday(state, i, key = dayKey()) {
  const y = patternsOn(state, addDays(key, -1))
  if (!y.size) return []
  return [...new Set(program(state).days[i]?.exercises.map(e => e.pattern).filter(p => p && SLOW.has(p) && y.has(p)))]
}

// Progressive overload: if every set last time reached the top of the rep range, add weight; otherwise repeat it.
const repTop = reps => { const m = String(reps || '').match(/(\d+)\s*[-–]\s*(\d+)/); return m ? +m[2] : parseInt(reps, 10) || null }
export function suggestLoad(workoutLog, ex, before = dayKey()) {
  if (!(ex.weight > 0)) return null
  const dates = Object.keys(workoutLog || {}).filter(d => d < before).sort().reverse()
  for (const d of dates) {
    const e = workoutLog[d][ex.name]
    const sets = (e?.sets || []).filter(s => s && s.reps != null && s.w > 0)
    if (!sets.length) continue
    const w = Math.max(...sets.map(s => s.w))
    const top = repTop(ex.reps)
    const heavy = ['squat', 'hinge'].includes(ex.pattern) && w >= 40
    const hitAll = top && sets.length >= (ex.sets || 1) && sets.every(s => s.reps >= top)
    return hitAll ? { w: +(w + (heavy ? 5 : 2.5)).toFixed(1), up: true, from: w, top } : { w, up: false, from: w, top }
  }
  return null
}
