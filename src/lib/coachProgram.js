// A program a coach builds for a client. Travels as a small list (ids into the exercise library plus sets / reps / rest);
// the client's phone rebuilds full exercises from it, so cues, camera trackers and how-to cards come along.
import { LIB } from '../data/library.js'
import { mkEx, DEFAULT_INTAKE } from './program.js'

// App program → wire form (what the coach edits and sends).
export const toWire = days => (days || []).map(d => ({
  name: d.name || '', ...(d.run ? { run: true } : {}),
  exercises: d.exercises.map(e => ({ id: e.id || '', name: e.name, sets: e.sets || 3, reps: String(e.reps ?? '10'), rest: e.rest ?? 75 }))
}))

// Wire form → app program for the client. Library exercises get their full definition; unknown ones keep what was sent.
export function fromWire(wire, it = DEFAULT_INTAKE) {
  return (wire || []).map(d => ({
    name: d.name, ...(d.run ? { run: true } : {}),
    exercises: d.exercises.map(e => {
      const L = LIB.find(x => x.id === e.id)
      const base = L ? mkEx(L, it) : { id: e.id || e.name, name: e.name, pattern: 'custom', weight: 0, cue: '', progression: '' }
      return { ...base, name: L ? base.name : e.name, sets: e.sets, reps: e.reps, rest: e.rest, coachSet: true }
    })
  }))
}

// Apply the coach's program: the old one is kept so the client can go back.
export function applyCoachProgram(state, override) {
  if (!override?.program?.length) return {}
  return {
    program: fromWire(override.program, state.intake || DEFAULT_INTAKE),
    prevProgram: state.program?.length ? state.program : undefined,
    settings: { ...state.settings, coachProgAt: override.progAt || override.at }
  }
}

export const progPending = (state, override) => !!override?.program?.length && (state.settings?.coachProgAt || 0) !== (override.progAt || override.at)

export const blankEx = L => ({ id: L.id, name: L.n, sets: 3, reps: String(L.type === 'hold' ? `${Math.max(20, L.dr)}s` : L.dr >= 20 ? L.dr : `${Math.max(1, Math.round(L.dr * 0.7))}-${L.dr}`), rest: L.pat === 'cardio' ? 45 : 75 })
