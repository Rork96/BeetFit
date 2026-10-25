import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import RepTracker, { trackerFor, parseTarget } from '../camera/RepTracker.jsx'
import { alternativesFor, DEFAULT_INTAKE } from '../lib/program.js'
import { dayKey, addDays, week, program, nextDayIndex, setsLogged, streakInfo } from '../lib/day.js'
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
        <div className="ss-rest" role="timer" aria-live="polite">
          <i className="ss-rest-bar" style={{ transform: `scaleX(${rest.left / rest.total})` }} />
          <div className="ss-rest-in">
            <div className="ss-rest-t">
              <span className="label">Rest · {rest.label}</span>
              <b className="num">{fmt(rest.left)}</b>
            </div>
            <button onClick={() => { haptic(); setRest(r => ({ ...r, left: r.left + 15, total: r.total + 15 })) }}>+15 s</button>
            <button className="go" onClick={() => { haptic(); setRest(null) }}>Skip</button>
          </div>
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

      {recap && <Recap state={state} day={day} log={log} elapsed={elapsed} doneSets={doneSets} allSets={allSets}
        onDone={() => { hapticSuccess(); onClose() }} onBack={() => { haptic(); setRecap(false) }} />}
    </div>
  )
}

// Best set of an exercise: heaviest × reps, then reps, then seconds held.
const score = s => (s.w || 0) * 1000 + (s.reps || 0) + (s.secs || 0)
const bestOf = sets => sets.filter(s => s && (s.reps != null || s.secs != null)).reduce((a, b) => (!a || score(b) > score(a) ? b : a), null)

// What got better than the last session with the same exercise.
export function improvements(workoutLog, exercises, today = dayKey()) {
  const out = []
  let firsts = 0
  for (const ex of exercises) {
    const now = bestOf(setsOf(workoutLog?.[today]?.[ex.name]))
    if (!now) continue
    const last = lastTime(workoutLog, ex.name, today)?.best
    if (!last) { firsts++; continue }
    const lw = last.w || 0, w = now.w || 0
    let what = null
    if (w > lw) what = `${w} kg × ${now.reps} (+${+(w - lw).toFixed(1)} kg)`
    else if (w === lw && (now.reps || 0) > (last.reps || 0)) what = `${w ? `${w} kg × ` : ''}${now.reps} reps (+${now.reps - (last.reps || 0)})`
    else if ((now.secs || 0) > (last.secs || 0)) what = `${now.secs} s (+${now.secs - (last.secs || 0)} s)`
    if (what) out.push({ name: ex.name, what })
  }
  return { better: out, firsts }
}

function Recap({ state, day, log, elapsed, doneSets, allSets, onDone, onBack }) {
  const today = dayKey()
  const sets = day.exercises.flatMap(e => setsOf(log[e.name]).filter(s => s && (s.reps != null || s.secs != null)))
  const reps = sets.reduce((a, s) => a + (s.reps || 0), 0)
  const secs = sets.reduce((a, s) => a + (s.secs || 0), 0)
  const kg = Math.round(sets.reduce((a, s) => a + (s.w || 0) * (s.reps || 0), 0))
  const tiles = [
    { v: doneSets, l: doneSets === 1 ? 'set' : 'sets' },
    kg > 0 ? { v: kg.toLocaleString('en-US'), l: 'kg moved' } : { v: reps, l: 'reps' },
    ...(secs > 0 ? [{ v: fmt(secs), l: 'held' }] : []),
    { v: fmt(elapsed), l: 'time' }
  ]
  const { better, firsts } = improvements(state.workoutLog, day.exercises, today)
  const planned = program(state).days.length
  const wk = week(state, today)
  const sessions = wk.filter(d => d.score != null && setsLogged(state, d.key) > 0).length
  const st = streakInfo(state, today).days
  const nextDay = program(state).days[nextDayIndex(state, addDays(today, 1))]
  const empty = doneSets === 0

  return createPortal(
    <div className="rc" role="dialog" aria-modal="true" aria-label={empty ? 'End session' : 'Session done'}>
      <div className="rc-in">
        {empty ? (
          <>
            <div className="rc-mark idle" />
            <h1 className="rc-h">Nothing logged yet</h1>
            <p className="rc-sub">End now and this session won’t count. Your plan stays where it is.</p>
            <div className="rc-actions">
              <button className="btn" onClick={onBack}>Keep training</button>
              <button className="btn secondary" onClick={onDone}>End session</button>
            </div>
          </>
        ) : (
          <>
            <div className="ct-check rc-check"><svg viewBox="0 0 24 24"><polyline points="5 12.5 10 17 19 7" /></svg></div>
            <h1 className="rc-h">Session done</h1>
            <p className="rc-sub">{day.name} · {doneSets < allSets ? `${doneSets} of ${allSets} sets` : 'every set logged'}</p>

            <div className={'rc-tiles n' + tiles.length}>
              {tiles.map((t, i) => (
                <div key={t.l} style={{ animationDelay: `${120 + i * 60}ms` }}><b className="num">{t.v}</b><span>{t.l}</span></div>
              ))}
            </div>

            {(better.length > 0 || firsts > 0) && (
              <div className="rc-card" style={{ animationDelay: '360ms' }}>
                <span className="label">{better.length ? 'Better than last time' : 'Baseline set'}</span>
                {better.slice(0, 4).map(b => (
                  <div key={b.name} className="rc-pr"><span>{b.name}</span><b className="num">{b.what}</b></div>
                ))}
                {!better.length && <p className="hint">First time logging {firsts === 1 ? 'this exercise' : 'these exercises'}. Next session shows what to beat.</p>}
              </div>
            )}

            <div className="rc-card" style={{ animationDelay: '420ms' }}>
              <div className="row">
                <span className="label">This week</span>
                <span className="num rc-wk">{sessions} of {planned} sessions</span>
              </div>
              <div className="rc-dots">
                {Array.from({ length: Math.max(planned, sessions) }).map((_, i) => <i key={i} className={i < sessions ? 'on' : ''} style={{ animationDelay: `${480 + i * 70}ms` }} />)}
              </div>
              <p className="hint">
                {sessions >= planned ? 'Week goal hit.' : `${planned - sessions} more to hit the week.`}
                {st > 0 && ` ${st}-day streak.`}
              </p>
            </div>

            {nextDay && <p className="rc-next">Next: <b>{nextDay.name}</b> · {nextDay.exercises.length} exercises</p>}

            <div className="rc-actions">
              <button className="btn" onClick={onDone}>Done</button>
              {doneSets < allSets && <button className="btn secondary" onClick={onBack}>Keep training</button>}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
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
