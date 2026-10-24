import React, { useState } from 'react'
import { PROGRAMS } from '../data/workouts.js'
import RepTracker, { trackerFor, parseTarget } from '../camera/RepTracker.jsx'
import { EXERCISES } from '../camera/pose/exercises.js'
import { haptic } from '../lib/tg.js'

const today = () => new Date().toISOString().slice(0, 10)

// workoutLog[date][exName] = { sets: [{ reps?, secs?, rpe?, auto }] } — legacy `true` / number still readable.
function setsOf(entry) {
  if (!entry) return []
  if (entry === true) return [{ done: true }]
  if (typeof entry === 'number') return [{ reps: entry }]
  return entry.sets || []
}

export default function WorkoutTab({ state, update }) {
  const { profile, workoutLog } = state
  const program = PROGRAMS[profile.goal] || PROGRAMS.maintain
  const [dayIdx, setDayIdx] = useState(0)
  const [session, setSession] = useState(null) // { startAt }
  const [toast, setToast] = useState(null)
  const d = today()
  const todayLog = workoutLog[d] || {}
  const day = program.days[dayIdx]

  const logSet = ({ name, si, reps, secs, rpe, auto }) => {
    update(prev => {
      const wl = prev.workoutLog || {}
      const dayLog = wl[d] || {}
      const sets = setsOf(dayLog[name]).slice()
      sets[si] = { ...(sets[si] || {}), ...(reps != null && { reps }), ...(secs != null && { secs }), ...(rpe != null && { rpe }), auto: !!auto }
      return { workoutLog: { ...wl, [d]: { ...dayLog, [name]: { sets } } } }
    })
  }

  const markDone = ex => {
    haptic()
    const t = parseTarget(ex.reps)
    update(prev => {
      const wl = prev.workoutLog || {}
      const dayLog = wl[d] || {}
      const sets = Array.from({ length: ex.sets }, () => (t.kind === 'hold' ? { secs: t.value } : { reps: t.value }))
      return { workoutLog: { ...wl, [d]: { ...dayLog, [ex.name]: { sets } } } }
    })
  }

  if (session) {
    return (
      <RepTracker
        exercises={day.exercises}
        startAt={session.startAt}
        onLog={logSet}
        onClose={sum => {
          setSession(null)
          if (sum?.sets) { setToast(`${sum.sets} set${sum.sets === 1 ? '' : 's'} logged`); setTimeout(() => setToast(null), 2000) }
        }}
      />
    )
  }

  const doneCount = day.exercises.filter(ex => setsOf(todayLog[ex.name]).length >= ex.sets).length
  const firstOpen = Math.max(0, day.exercises.findIndex(ex => setsOf(todayLog[ex.name]).length < ex.sets))
  const camCount = day.exercises.filter(ex => trackerFor(ex)).length

  return (
    <div className="page">
      <div className="hero">
        <span className="glow" />
        <h1>Workout</h1>
      </div>
      <p className="hint">{program.name}</p>

      <div className="chips" role="tablist">
        {program.days.map((dd, i) => (
          <button key={i} className={'chip' + (i === dayIdx ? ' on' : '')} onClick={() => { haptic(); setDayIdx(i) }}>
            {dd.name.split('—')[0].trim()}
          </button>
        ))}
      </div>

      <div className="card stk" key={dayIdx}>
        <div className="row">
          <h3>{day.name.split('—')[1]?.trim() || day.name}</h3>
          <span className="label num">{doneCount}/{day.exercises.length}</span>
        </div>
        <div className="progressbar"><div style={{ width: `${(doneCount / day.exercises.length) * 100}%` }} /></div>
        {day.exercises.map((ex, i) => {
          const sets = setsOf(todayLog[ex.name])
          const done = sets.length >= ex.sets
          const tid = trackerFor(ex)
          const summary = sets.length
            ? sets.map(s => (s.secs != null ? `${s.secs}s` : s.reps ?? '✓') + (s.rpe ? `@${s.rpe}` : '')).join(' · ')
            : null
          return (
            <div className="ex-row" key={ex.name}>
              <button className={'ex-mark' + (done ? ' on' : '')} onClick={() => !done && markDone(ex)} aria-label={`Mark ${ex.name} done`}>
                {done && <svg viewBox="0 0 24 24"><polyline points="5 12.5 10 17 19 7" /></svg>}
              </button>
              <div className="ex-main">
                <div className="ex-name">{ex.name}{tid && <span className="ex-cam">▣ cam</span>}</div>
                <div className="ex-meta">
                  <span className="num">{ex.sets} × {ex.reps}</span>
                  {summary && <> · <span className="num">{summary}</span></>}
                </div>
              </div>
              <button className="btn small secondary" onClick={() => { haptic(); setSession({ startAt: i }) }}>
                {tid ? 'Track' : 'Start'}
              </button>
            </div>
          )
        })}
      </div>

      <button className="btn" onClick={() => { haptic(); setSession({ startAt: firstOpen }) }}>
        {doneCount ? 'Continue session' : 'Start session'}
      </button>

      <div className="card">
        <span className="label">Camera coach</span>
        <p className="hint">
          {camCount} of {day.exercises.length} exercises today are counted by the camera
          ({[...new Set(day.exercises.map(trackerFor).filter(Boolean))].map(t => EXERCISES[t].name).join(', ')}).
          Pose detection runs on your phone — no video leaves the device.
        </p>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
