import React, { useEffect, useRef, useState } from 'react'
import { trainStatus, planStatus, overlapYesterday, suggestLoad } from '../lib/train.js'
import BeetMascot from './BeetMascot.jsx'
import { trackerFor } from '../camera/RepTracker.jsx'
import { dayKey, nextDayIndex, program as programOf } from '../lib/day.js'
import { useBackClose } from '../lib/hooks.js'
import { haptic } from '../lib/platform.js'
import Session, { setsOf } from './Session.jsx'
import Library from './Library.jsx'
import HowToSheet, { HowToThumb } from './HowTo.jsx'
import Ic from './Icons.jsx'
import PlanReview from './PlanReview.jsx'
import { liveSession, setLiveSession } from '../lib/store.js'

export default function WorkoutTab({ state, update, intent, clearIntent }) {
  const { workoutLog } = state
  const program = programOf(state)
  // A session still running from before a reload / screen lock reopens where it was.
  const live = useRef(liveSession()).current
  const resume = live?.date === dayKey() && !intent?.dayIdx ? live : null
  const [dayIdx, setDayIdx] = useState(() => { const t0 = trainStatus(state); return intent?.dayIdx ?? resume?.dayIdx ?? (t0.kind === 'done' && t0.todayIdx >= 0 ? t0.todayIdx : nextDayIndex(state)) })
  const [session, setSession] = useState(() => (resume && !intent?.start ? { cam: null } : null)) // { cam: {ei, si} | null }
  const [lib, setLib] = useState(false)
  const [how, setHow] = useState(null) // exercise id whose how-to sheet is open
  const [toast, setToast] = useState(null)
  const d = dayKey()
  const todayLog = workoutLog?.[d] || {}
  const day = program.days[Math.min(dayIdx, program.days.length - 1)]
  const before = useRef(countSets(workoutLog?.[dayKey()] || {}))
  useBackClose(!!session, () => setSession(null))
  useBackClose(lib, () => setLib(false))
  useBackClose(!!how, () => setHow(null))

  const done = ex => setsOf(todayLog[ex.name]).filter(s => s && (s.reps != null || s.secs != null)).length
  const doneCount = day.exercises.filter(ex => done(ex) >= ex.sets || todayLog[ex.name]?.skipped).length
  const camCount = day.exercises.filter(ex => trackerFor(ex)).length
  const ts = planStatus(state, d)
  const overlap = overlapYesterday(state, dayIdx, d)
  const fresher = overlap.length ? program.days.findIndex((_, i) => i !== dayIdx && !overlapYesterday(state, i, d).length) : -1

  const open = (cam = null) => {
    haptic(); before.current = countSets(todayLog)
    const cur = liveSession()
    if (!cur || cur.date !== d || cur.dayIdx !== dayIdx) setLiveSession({ date: d, dayIdx, startedAt: Date.now() })
    setSession({ cam })
  }
  const running = (() => { const l = liveSession(); return l && l.date === d && l.dayIdx === dayIdx ? l : null })()

  // Logged-set toast when coming back from a session.
  useEffect(() => {
    if (session) return
    const now = countSets(todayLog)
    if (now > before.current) {
      setToast(`${now - before.current} set${now - before.current === 1 ? '' : 's'} logged`)
      before.current = now
      const id = setTimeout(() => setToast(null), 2000)
      return () => clearTimeout(id)
    }
  }, [session]) // eslint-disable-line react-hooks/exhaustive-deps

  // "Start session" tapped on Today.
  useEffect(() => {
    if (intent?.start) { open(); clearIntent?.() }
  }, [intent]) // eslint-disable-line react-hooks/exhaustive-deps

  if (session) {
    return <Session state={state} update={update} day={day} dayIdx={dayIdx} startCamAt={session.cam} startedAt={liveSession()?.startedAt} onClose={() => history.back()} />
  }
  if (lib) return <Library state={state} onClose={() => history.back()} />

  return (
    <div className="page">
      <div className="row">
        <div className="hero"><span className="glow" /><h1>Train</h1></div>
        <button className="btn small secondary" onClick={() => { haptic(); setLib(true) }}>Library</button>
      </div>
      <p className="hint">{program.name}</p>

      <TrainState ts={ts} days={program.days} d={d} running={running} onPick={i => { haptic(); setDayIdx(i) }} />

      <div className="chips wk-days" role="tablist">
        {program.days.map((dd, i) => (
          <button key={i} role="tab" aria-selected={i === dayIdx} className={'chip' + (i === dayIdx ? ' on' : '') + (ts.doneIdx.has(i) ? ' did' : '')} onClick={() => { haptic(); setDayIdx(i) }}>
            {ts.doneIdx.has(i) && <Ic n="check" />}{dd.name.split('—')[0].trim()}{i === ts.nextIdx && ts.kind !== 'done' && !ts.doneIdx.has(i) && <i className="wk-next" aria-label="recommended" />}
          </button>
        ))}
      </div>
      {overlap.length > 0 && ts.kind !== 'done' && (
        <div className="wk-warn"><Ic n="timer" /><span><b>{overlap.join(' & ')}</b> trained yesterday. {fresher >= 0 ? <>Day {program.days[fresher].name.split('—')[0].replace(/^Day\s*/i, '').trim()} uses fresher muscles.</> : 'Go lighter today.'}</span>
          {fresher >= 0 && <button className="chip" onClick={() => { haptic(); setDayIdx(fresher) }}>Switch</button>}</div>
      )}

      <div className="card stk" key={dayIdx}>
        <div className="row">
          <h3>{day.name.split('—')[1]?.trim() || day.name}</h3>
          <span className="label num">{doneCount}/{day.exercises.length}</span>
        </div>
        <div className="progressbar"><div style={{ width: `${(doneCount / day.exercises.length) * 100}%` }} /></div>
        {day.exercises.map((ex, i) => {
          const n = done(ex)
          const finished = n >= ex.sets
          const tid = trackerFor(ex)
          const entry = todayLog[ex.name]
          return (
            <div className="ex-row" key={ex.name + i}>
              <span className={'ex-mark' + (finished ? ' on' : '')}>
                {finished && <svg viewBox="0 0 24 24"><polyline points="5 12.5 10 17 19 7" /></svg>}
              </span>
              <HowToThumb id={ex.id || ex.name} onOpen={setHow} />
              <div className="ex-main">
                <div className="ex-name">{ex.name}{tid && <span className="ex-cam i" title="Counted by the camera"><Ic n="cam" className="solid" label="Camera counts reps" /></span>}</div>
                <div className="ex-meta num">
                  {entry?.skipped ? <span style={{ color: 'var(--danger)' }}>skipped · {entry.pain}</span>
                    : <span className="ex-chips" aria-label={`${n} of ${ex.sets} sets, ${ex.reps} reps${ex.weight ? `, ${ex.weight} kg` : ''}`}>
                      <span className="ex-pips" aria-hidden="true">{Array.from({ length: ex.sets }, (_, k) => <i key={k} className={k < n ? 'on' : ''} />)}</span>
                      <span><Ic n="reps" />{ex.reps}</span>
                      {ex.weight ? (() => { const sg = suggestLoad(workoutLog, ex, d); const w = sg?.w ?? ex.weight; return <span className={sg?.up ? 'up' : ''} title={sg?.up ? `Up from ${sg.from} kg: every set hit ${sg.top}` : undefined}><Ic n={sg?.up ? 'trend' : 'weight'} />{w}<small>kg</small></span> })() : null}
                    </span>}
                </div>
              </div>
              {tid && !finished && !entry?.skipped && (
                <button className="btn small secondary" onClick={() => open({ ei: i, si: n })}>Track</button>
              )}
            </div>
          )
        })}
      </div>

      <button className={'btn' + (!running && (ts.kind === 'rest' || ts.kind === 'week' || (ts.kind === 'done' && dayIdx !== ts.todayIdx)) ? ' secondary' : '')} onClick={() => open()}>{running || doneCount ? (ts.kind === 'done' && !running ? 'Log more sets' : 'Continue session') : ts.kind === 'rest' || ts.kind === 'week' || ts.kind === 'done' ? 'Train anyway' : 'Start session'}{running && <span className="num wk-live"> · {Math.floor((Date.now() - running.startedAt) / 60000)} min</span>}</button>

      <div className="wk-cam" aria-label={`${camCount} of ${day.exercises.length} exercises counted by the camera. Pose detection runs on your phone, no video leaves the device.`}>
        <span><Ic n="cam" className="solid" /><b className="num">{camCount}/{day.exercises.length}</b></span>
        <span className="wk-cam-sep" />
        <span><Ic n="phone" /><Ic n="lock" className="solid" /><small>video stays on phone</small></span>
      </div>
      {state.intake && state.program?.length > 0 && !running && (
        <PlanReview profile={state.profile} intake={state.intake} program={state.program} onChange={p => update({ program: p })} />
      )}
      {toast && <div className="toast">{toast}</div>}
      {how && <HowToSheet id={how} onClose={() => history.back()} onOpen={setHow} />}
    </div>
  )
}

function countSets(dayLog = {}) {
  return Object.entries(dayLog).filter(([k]) => !k.startsWith('__'))
    .reduce((n, [, e]) => n + setsOf(e).filter(s => s && (s.reps != null || s.secs != null)).length, 0)
}

const fmtDay = (k, today) => {
  const n = Math.round((Date.parse(k + 'T12:00') - Date.parse(today + 'T12:00')) / 864e5)
  return n <= 0 ? 'today' : n === 1 ? 'tomorrow' : new Date(k + 'T12:00').toLocaleDateString('en-US', { weekday: 'long' })
}
const short = dd => dd.name.split('—')[0].trim()

// One line of "where am I in the plan": done today, rest, week done, or what's next. Never a lock.
function TrainState({ ts, days, d, running, onPick }) {
  if (running) return null
  const next = days[ts.nextIdx]
  const dots = <span className="wk-dots" aria-label={`${ts.sessions} of ${ts.planned} sessions this week`}>{Array.from({ length: Math.max(ts.planned, ts.sessions) }, (_, i) => <i key={i} className={i < ts.sessions ? 'on' : ''} />)}<small className="num">{ts.sessions}/{ts.planned} this week</small></span>
  const cfg = {
    done: { mood: 'cheer', h: `${ts.todayIdx >= 0 ? short(days[ts.todayIdx]) : 'Session'} done today`, p: <>Next: <b>{short(next)}</b> {fmtDay(ts.nextDate, d)}. Rest lets the work turn into strength.</> },
    rest: { mood: 'idle', h: 'Rest day', p: <>Muscles rebuild today. Next: <b>{short(next)}</b> {fmtDay(ts.nextDate, d)}. A 20–30 min walk still counts.</> },
    week: { mood: 'happy', h: 'Week done', p: <>All {ts.planned} sessions are in. Anything extra is a bonus; keep it light.</> },
    train: { mood: 'happy', h: `Today: ${short(next)}`, p: <>{ts.sessions ? 'Next in your rotation.' : 'Days go in order: A, then B, then C.'}</> },
  }[ts.kind]
  return (
    <div className={'card wk-state ' + ts.kind}>
      <BeetMascot size={52} mood={cfg.mood} bubble="right" />
      <div className="wk-state-t">
        <b>{cfg.h}</b>
        <p className="hint">{cfg.p}</p>
        {dots}
      </div>
      {ts.kind !== 'train' && ts.kind !== 'week' && <button className="chip" onClick={() => onPick(ts.nextIdx)}>See {short(next)}</button>}
    </div>
  )
}
