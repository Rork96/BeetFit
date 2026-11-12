// The person's own exercises (state.myEx) and hand edits to plan days.
// A custom exercise: { id: 'c_…', n, pat, eq: [...], type: 'reps'|'hold', sets, reps, rest, cue, video: { key } | null }.
// In a plan day it becomes a normal exercise with custom: true, so Session, history and sync treat it like any other.
// Library exercises put in by hand carry added: true. Both survive "Rebuild my plan".
import { mkProg, mkEx, DEFAULT_INTAKE } from './program.js'
import { LIB } from '../data/library.js'
import { API_URL } from './api.js'

export const myExOf = state => state.myEx || []
export const newExId = () => 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

const clampInt = (v, lo, hi, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d }

export function cleanCustom(c) {
  const type = c.type === 'hold' ? 'hold' : 'reps'
  const reps = String(c.reps ?? '').trim().slice(0, 24) || (type === 'hold' ? '30s' : '10')
  return {
    id: c.id || newExId(),
    n: String(c.n || '').trim().replace(/\s+/g, ' ').slice(0, 40),
    pat: c.pat || 'core',
    eq: (c.eq || []).length ? [...new Set(c.eq)] : ['none'],
    type,
    sets: clampInt(c.sets, 1, 10, 3),
    reps: type === 'hold' && /^\d+$/.test(reps) ? reps + 's' : reps,
    rest: clampInt(c.rest, 0, 600, 75),
    weight: Math.max(0, Math.min(500, +c.weight || 0)),
    cue: String(c.cue || '').trim().slice(0, 140),
    video: c.video?.key ? { key: c.video.key } : null
  }
}

// What a plan day holds for a custom exercise.
export const customToEx = c => ({
  id: c.id, name: c.n, sets: c.sets, reps: c.reps, rest: c.rest, weight: c.weight || 0, cue: c.cue, pattern: c.pat,
  custom: true, ...(c.video ? { video: c.video } : {})
})

// Problems with a draft, or null. Names must be unique: workout history is keyed by exercise name.
export function customError(c, myEx = [], program = []) {
  const n = (c.n || '').trim().toLowerCase()
  if (n.length < 2) return 'Give it a name'
  if (myEx.some(x => x.id !== c.id && x.n.toLowerCase() === n)) return 'You already have one with that name'
  if (LIB.some(L => L.n.toLowerCase() === n)) return 'That name is taken by a library exercise'
  if (program.some(d => d.exercises.some(e => e.id !== c.id && !e.custom && e.name.toLowerCase() === n))) return 'Your plan already has an exercise with that name'
  return null
}

export function saveCustom(myEx = [], c) {
  const x = cleanCustom(c)
  return myEx.some(e => e.id === x.id) ? myEx.map(e => (e.id === x.id ? x : e)) : [...myEx, x]
}

// Keep plan days in step after an edit (name, sets, cue, clip). Removed exercises leave the plan too.
export function applyCustom(program = [], myEx = []) {
  const by = Object.fromEntries(myEx.map(c => [c.id, c]))
  return program.map(d => ({
    ...d,
    exercises: d.exercises.flatMap(e => {
      if (!e.custom) return [e]
      const c = by[e.id]
      return c ? [{ ...customToEx(c), sets: e.sets ?? c.sets }] : []
    })
  }))
}

export const dropCustom = (myEx = [], id) => myEx.filter(c => c.id !== id)

export function addToDay(program, i, ex) {
  if (!program[i]) return program
  if (program[i].exercises.some(e => e.name === ex.name)) return program
  return program.map((d, j) => (j !== i ? d : { ...d, exercises: [...d.exercises, ex] }))
}
export const libToEx = (L, it = DEFAULT_INTAKE) => ({ ...mkEx(L, it), added: true })

export function removeFromDay(program, i, k) {
  if (!program[i] || program[i].exercises.length <= 1) return program
  return program.map((d, j) => (j !== i ? d : { ...d, exercises: d.exercises.filter((_, x) => x !== k) }))
}

export function moveInDay(program, i, k, dir) {
  const ex = program[i]?.exercises
  const t = k + dir
  if (!ex || t < 0 || t >= ex.length) return program
  const next = [...ex];[next[k], next[t]] = [next[t], next[k]]
  return program.map((d, j) => (j !== i ? d : { ...d, exercises: next }))
}

// New plan for a new setup, keeping what the person (or their coach) put in by hand, on the same day number.
export function rebuildKeep(goal, intake, old = [], myEx = []) {
  const fresh = mkProg(goal, intake)
  const lifting = fresh.filter(d => !d.run)
  old.forEach((d, i) => {
    if (d.run) return
    const keep = d.exercises.filter(e => e.custom || e.added)
    if (!keep.length || !lifting.length) return
    const target = lifting[Math.min(i, lifting.length - 1)]
    for (const e of keep) if (!target.exercises.some(x => x.name === e.name)) target.exercises.push(e)
  })
  return applyCustom(fresh, myEx)
}

// Weekdays (0 = Mon) that spread n sessions over the week with rest in between.
export const DEFAULT_WEEKDAYS = { 1: [2], 2: [1, 4], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5] }
export const defaultWeekdays = n => DEFAULT_WEEKDAYS[Math.max(1, Math.min(6, n))]

export const clipUrl = v => (v?.key ? `${API_URL}/api/media/${v.key}` : null)
