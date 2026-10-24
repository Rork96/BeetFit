import React, { useEffect, useMemo, useRef, useState } from 'react'
import RepTracker, { trackerFor, parseTarget } from '../camera/RepTracker.jsx'
import { alternativesFor, DEFAULT_INTAKE } from '../lib/program.js'
import { dayKey } from '../lib/day.js'
import { haptic, hapticSuccess, hapticError } from '../lib/platform.js'
import { useBackClose } from '../lib/hooks.js'
import { speak } from '../lib/voice.js'
import Warmup from './Warmup.jsx'
import './session.css'

const RPE = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]
const PAIN_AREAS = ['knee', 'lower back', 'shoulder', 'elbow / wrist', 'ankle', 'other']
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export function setsOf(entry) {
  if (!entry) return []
  if (entry === true) return [{ done: true }]
  if (typeof entry === 'number') return [{ reps: entry }]
  return entry.sets || []
}

// Best set from the most recent earlier session with this exercise.
export function lastTime(workoutLog, name, before = dayKey()) {
  const dates = Object.keys(workoutLog || {}).filter(d => d < before).sort().reverse()
  for (const d of dates) {
    const sets = setsOf(workoutLog[d][name]).filter(s => s && (s.reps || s.secs))
    if (sets.length) {
      const best = sets.reduce((a, b) => ((b.w || 0) * (b.reps || 1) > (a.w || 0) * (a.reps || 1) ? b : a))
      return { date: d, sets: sets.length, best }
    }
  }
  return null
}

export default function Session({ state, update, day, dayIdx, startCamAt, onClose }) {
  const today = dayKey()
  const log = state.workoutLog?.[today] || {}
  const intake = state.intake || DEFAULT_INTAKE
  const [warm, setWarm] = useState(() => state.workoutLog?.[today]?.__warmup || 'todo')
  const [rest, setRest] = useState(null) // { left, total, label }
  const [cam, setCam] = useState(startCamAt ?? null) // { ei, si } | null
  const [sheet, setSheet] = useState(null) // { kind: 'swap'|'pain', ei }
  const [recap, setRecap] = useState(false)
  const t0 = useRef(Date.now())
  const [, tick] = useState(0)
  useEffect(() => { const id = setInterval(() => tick(x => x + 1), 1000); return () => clearInterval(id) }, [])
  useBackClose(!!cam, () => setCam(null))
  useBackClose(!!sheet, () => setSheet(null))

  // Rest timer
  useEffect(() => {
    if (!rest) return
    if (rest.left <= 0) { hapticSuccess(); speak('Rest over'); setRest(null); return }
    if (rest.left <= 3) haptic('light')
    const id = setTimeout(() => setRest(r => r && { ...r, left: r.left - 1 }), 1000)
    return () => clearTimeout(id)
  }, [rest])

  const writeSet = (name, si, patch) => update(prev => {
    const wl = prev.workoutLog || {}
    const dayLog = wl[today] || {}
    const entry = dayLog[name] && typeof dayLog[name] === 'object' ? dayLog[name] : { sets: setsOf(dayLog[name]) }
    const sets = (entry.sets || []).slice()
    sets[si] = { ...(sets[si] || {}), ...patch }
    return { workoutLog: { ...wl, [today]: { ...dayLog, [name]: { ...entry, sets } } } }
  })

  const markWarm = how => {
    haptic()
    setWarm(how)
    update(prev => ({ workoutLog: { ...(prev.workoutLog || {}), [today]: { ...(prev.workoutLog?.[today] || {}), __warmup: how } } }))
  }

  const swap = (ei, next) => {
    hapticSuccess()
    update(prev => {
      const prog = (prev.program || []).map((d, i) => (i === dayIdx ? { ...d, exercises: d.exercises.map((e, j) => (j === ei ? next : e)) } : d))
      return { program: prog }
    })
    history.back()
  }

  const reportPain = (ei, area, note) => {
    hapticError()
    const ex = day.exercises[ei]
    update(prev => {
      const it = prev.intake || DEFAULT_INTAKE
      const already = (it.injuries || '').toLowerCase().includes(area.split(' ')[0])
      return {
        painFlags: [...(prev.painFlags || []), { date: today, exercise: ex.name, area, note }],
        intake: area === 'other' || already ? it : { ...it, injuries: [it.injuries, area].filter(Boolean).join(', ') },
        workoutLog: { ...(prev.workoutLog || {}), [today]: { ...(prev.workoutLog?.[today] || {}), [ex.name]: { sets: setsOf(prev.workoutLog?.[today]?.[ex.name]), skipped: true, pain: area } } }
      }
    })
    history.back()
  }

  const allSets = day.exercises.reduce((n, e) => n + (e.sets || 1), 0)
  const doneSets = day.exercises.reduce((n, e) => n + setsOf(log[e.name]).filter(s => s && (s.reps != null || s.secs != null)).length, 0)
  const volume = day.exercises.reduce((v, e) => v + setsOf(log[e.name]).reduce((a, s) => a + (s?.w || 0) * (s?.reps || 0), 0), 0)
  const elapsed = Math.floor((Date.now() - t0.current) / 1000)

  if (cam) {
    return (
      <RepTracker exercises={day.exercises} startAt={cam.ei} startSet={cam.si}
        onLog={({ name, si, reps, secs, rpe, auto }) => writeSet(name, si, { ...(reps != null && { reps }), ...(secs != null && { secs }), ...(rpe != null && { rpe }), auto: !!auto })}
        onClose={() => history.back()} />
    )
  }

  return (
    <div className="screen ss">
      <header className="screen-top">
        <button className="td-icon" onClick={onClose} aria-label="Close session">←</button>
        <div className="ss-head">
          <h2>{day.name}</h2>
          <span className="num td-small">{fmt(elapsed)} · {doneSets}/{allSets} sets</span>
        </div>
        <button className="btn small" onClick={() => { haptic(); setRecap(true) }}>Finish</button>
      </header>
      <div className="ss-progress"><i style={{ transform: `scaleX(${allSets ? doneSets / allSets : 0})` }} /></div>

      <div className="page stk ss-list">
        <Warmup dayName={day.name} status={warm} onDone={id => markWarm(id)} onSkip={() => markWarm('skipped')} />

        {day.exercises.map((ex, ei) => (
          <ExerciseCard key={ex.name + ei} ex={ex} ei={ei} entry={log[ex.name]} locked={warm === 'todo'}
            last={lastTime(state.workoutLog, ex.name)}
            onSet={(si, patch, rested) => { writeSet(ex.name, si, patch); if (rested) setRest({ left: ex.rest || 75, total: ex.rest || 75, label: ex.name }) }}
            onCamera={si => { haptic(); setCam({ ei, si }) }}
            onSwap={() => setSheet({ kind: 'swap', ei })}
            onPain={() => setSheet({ kind: 'pain', ei })} />
        ))}
        <button className="btn" onClick={() => { haptic(); setRecap(true) }}>Finish session</button>
      </div>

      {rest && (
        <div className="ss-rest" role="timer">
          <svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" className="trk" /><circle cx="20" cy="20" r="16" className="val" style={{ strokeDasharray: 100.5, strokeDashoffset: 100.5 * (1 - rest.left / rest.total) }} /></svg>
          <div><span className="label">Rest</span><b className="num">{fmt(rest.left)}</b></div>
          <button onClick={() => setRest(r => ({ ...r, left: r.left + 15, total: r.total + 15 }))}>+15</button>
          <button onClick={() => setRest(null)}>Skip</button>
        </div>
      )}

      {sheet && (
        <>
          <div className="sheet-back" onClick={() => history.back()} />
          <div className="sheet">
            {sheet.kind === 'swap' && <SwapSheet ex={day.exercises[sheet.ei]} intake={intake} onPick={next => swap(sheet.ei, next)} />}
            {sheet.kind === 'pain' && <PainSheet ex={day.exercises[sheet.ei]} onReport={(a, n) => reportPain(sheet.ei, a, n)} />}
          </div>
        </>
      )}

      {recap && (
        <div className="ct-overlay solid ss-recap">
          <div className="ct-check"><svg viewBox="0 0 24 24"><polyline points="5 12.5 10 17 19 7" /></svg></div>
          <div className="ct-h">{doneSets ? 'Session done' : 'End without logging?'}</div>
          <div className="ct-stats stk">
            <div><b className="num">{doneSets}</b><span>sets</span></div>
            <div><b className="num">{Math.round(volume)}</b><span>kg moved</span></div>
            <div><b className="num">{Math.max(1, Math.round(elapsed / 60))}</b><span>min</span></div>
          </div>
          <button className="btn" onClick={() => { hapticSuccess(); onClose() }}>Done</button>
          {doneSets < allSets && <button className="ct-link" onClick={() => setRecap(false)}>Keep training</button>}
        </div>
      )}
    </div>
  )
}

function ExerciseCard({ ex, ei, entry, last, locked, onSet, onCamera, onSwap, onPain }) {
  const goal = parseTarget(ex.reps)
  const sets = setsOf(entry)
  const tid = trackerFor(ex)
  const skipped = entry?.skipped
  const nextSi = Array.from({ length: ex.sets || 1 }).findIndex((_, i) => !(sets[i] && (sets[i].reps != null || sets[i].secs != null)))
  const [open, setOpen] = useState(false)
  return (
    <div className={'card ss-ex' + (locked ? ' locked' : '') + (skipped ? ' skipped' : '') + (nextSi === -1 ? ' complete' : '')}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="ex-main">
          <div className="ex-name">{ex.name}{tid && <span className="ex-cam">▣ cam</span>}</div>
          <div className="ex-meta num">{ex.sets} × {ex.reps}{ex.weight ? ` · ${ex.weight} kg` : ''}{ex.rest ? ` · rest ${ex.rest}s` : ''}</div>
        </div>
        <button className="ss-more" onClick={() => setOpen(o => !o)} aria-label="More">⋯</button>
      </div>
      {ex.cue && <p className="ss-cue">{ex.cue}</p>}
      {last && <p className="td-small num">Last time: {last.sets} sets · best {last.best.w ? `${last.best.w} kg × ` : ''}{last.best.reps ?? `${last.best.secs}s`}{last.best.rpe ? ` @${last.best.rpe}` : ''}</p>}
      {ex.progression && <p className="td-small">Next step: {ex.progression}</p>}
      {open && (
        <div className="ss-actions">
          <button className="chip" onClick={() => { setOpen(false); onSwap() }}>⇄ Swap exercise</button>
          <button className="chip ss-pain" onClick={() => { setOpen(false); onPain() }}>⚑ Report pain</button>
        </div>
      )}
      {skipped ? <p className="hint" style={{ color: 'var(--danger)' }}>Skipped — pain reported ({entry.pain}).</p> : (
        <>
          <div className="ss-sets">
            {Array.from({ length: ex.sets || 1 }).map((_, si) => (
              <SetRow key={si} si={si} goal={goal} ex={ex} set={sets[si]} active={si === nextSi}
                onDone={patch => onSet(si, patch, si < (ex.sets || 1) - 1)} />
            ))}
          </div>
          {tid && nextSi !== -1 && (
            <button className="btn secondary" onClick={() => onCamera(nextSi)}>▣ Count set {nextSi + 1} with camera</button>
          )}
        </>
      )}
    </div>
  )
}

function SetRow({ si, goal, ex, set, active, onDone }) {
  const done = set && (set.reps != null || set.secs != null)
  const [w, setW] = useState(set?.w ?? ex.weight ?? 0)
  const [r, setR] = useState(set?.reps ?? set?.secs ?? goal.value)
  const [rpe, setRpe] = useState(set?.rpe ?? null)
  const hold = goal.kind === 'hold'
  if (done && !active) {
    return (
      <div className="ss-set done">
        <span className="ss-n num">{si + 1}</span>
        <span className="num">{set.w ? `${set.w} kg × ` : ''}{set.reps != null ? `${set.reps} reps` : `${set.secs} s`}{set.rpe ? ` @ RPE ${set.rpe}` : ''}{set.auto ? ' · camera' : ''}</span>
        <span className="ss-tick">✓</span>
      </div>
    )
  }
  return (
    <div className={'ss-set' + (active ? ' active' : '')}>
      <span className="ss-n num">{si + 1}</span>
      <div className="ss-entry">
        {ex.weight > 0 && <Mini value={w} step={2.5} unit="kg" onChange={setW} />}
        <Mini value={r} step={hold ? 5 : 1} unit={hold ? 's' : 'reps'} onChange={setR} />
        <select className="ss-rpe" value={rpe ?? ''} onChange={e => setRpe(e.target.value ? +e.target.value : null)} aria-label="RPE">
          <option value="">RPE</option>
          {RPE.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <button className="btn small ss-done" onClick={() => { hapticSuccess(); onDone({ ...(ex.weight > 0 && { w }), ...(hold ? { secs: r } : { reps: r }), ...(rpe && { rpe }) }) }}>Done</button>
      </div>
    </div>
  )
}

function Mini({ value, step, unit, onChange }) {
  return (
    <div className="ss-mini">
      <button onClick={() => { haptic(); onChange(Math.max(0, +(value - step).toFixed(1))) }} aria-label={`Less ${unit}`}>−</button>
      <span className="num">{value}<small>{unit}</small></span>
      <button onClick={() => { haptic(); onChange(+(value + step).toFixed(1)) }} aria-label={`More ${unit}`}>+</button>
    </div>
  )
}

function SwapSheet({ ex, intake, onPick }) {
  const alts = useMemo(() => alternativesFor(ex, intake), [ex, intake])
  return (
    <>
      <span className="label">Swap {ex.name}</span>
      {alts.length === 0 && <p className="hint">No other exercise for this movement fits your setup.</p>}
      {alts.map(a => (
        <button key={a.id} className="fs-item" onClick={() => onPick(a)}>
          <span className="ss-alt-mark" />
          <div><b>{a.name}{a.trackerId && <span className="ex-cam">▣ cam</span>}</b><span className="num">{a.sets} × {a.reps}{a.weight ? ` · ${a.weight} kg` : ''}</span></div>
        </button>
      ))}
      <button className="ct-link" style={{ color: 'var(--hint)' }} onClick={() => history.back()}>Cancel</button>
    </>
  )
}

function PainSheet({ ex, onReport }) {
  const [area, setArea] = useState(null)
  const [note, setNote] = useState('')
  return (
    <>
      <span className="label">Report pain · {ex.name}</span>
      <p className="hint">The exercise is skipped today, and movements that load this area are left out when your plan is rebuilt. Sharp or lasting pain → see a professional.</p>
      <div className="chips wrap">
        {PAIN_AREAS.map(a => <button key={a} className={'chip' + (area === a ? ' on' : '')} onClick={() => { haptic(); setArea(a) }}>{a}</button>)}
      </div>
      <input placeholder="What did it feel like? (optional)" value={note} onChange={e => setNote(e.target.value.slice(0, 140))} />
      <button className="btn danger" disabled={!area} onClick={() => onReport(area, note)}>Skip exercise & save</button>
    </>
  )
}
