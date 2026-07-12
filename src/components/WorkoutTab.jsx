import React, { useState } from 'react'
import { PROGRAMS } from '../data/workouts.js'
import PoseTracker from './PoseTracker.jsx'

export default function WorkoutTab({ state, update }) {
  const { profile, workoutLog } = state
  const program = PROGRAMS[profile.goal] || PROGRAMS.maintain
  const [dayIdx, setDayIdx] = useState(0)
  const [tracker, setTracker] = useState(null) // { trackerId, exName }
  const today = new Date().toISOString().slice(0, 10)
  const todayLog = workoutLog[today] || {}

  const markDone = (exName, reps) => {
    update({
      workoutLog: {
        ...workoutLog,
        [today]: { ...todayLog, [exName]: reps ?? true }
      }
    })
  }

  if (tracker) {
    return (
      <PoseTracker
        trackerId={tracker.trackerId}
        onClose={() => setTracker(null)}
        onFinish={reps => {
          markDone(tracker.exName, reps)
          setTracker(null)
        }}
      />
    )
  }

  const day = program.days[dayIdx]

  return (
    <div className="page">
      <h1>Workout</h1>
      <p className="hint">{program.name}</p>

      <div className="card">
        <label>Training day</label>
        <select value={dayIdx} onChange={e => setDayIdx(+e.target.value)}>
          {program.days.map((d, i) => <option key={i} value={i}>{d.name}</option>)}
        </select>
      </div>

      <div className="card">
        <h3>{day.name}</h3>
        {day.exercises.map(ex => {
          const done = todayLog[ex.name]
          return (
            <div className="exercise-row" key={ex.name}>
              <div>
                <div>{done ? '✅ ' : ''}{ex.name}</div>
                <div className="hint">
                  {ex.sets} × {ex.reps}
                  {typeof done === 'number' && ` · tracked: ${done} reps`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {ex.trackerId && (
                  <button className="btn small" onClick={() => setTracker({ trackerId: ex.trackerId, exName: ex.name })}>
                    📷 Track
                  </button>
                )}
                {!done && (
                  <button className="btn small secondary" onClick={() => markDone(ex.name)}>Done</button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="card">
        <h3>Camera rep tracking</h3>
        <p className="hint">
          Exercises marked 📷 support automatic rep counting via your camera.
          Pose detection runs on-device (MediaPipe) — no video leaves your phone.
        </p>
      </div>
    </div>
  )
}
