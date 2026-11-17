import React, { useMemo, useState } from 'react'
import { useBackClose } from '../lib/hooks.js'
import { haptic, hapticSuccess } from '../lib/platform.js'
import { LIB } from '../data/library.js'
import { exPool, DEFAULT_INTAKE } from '../lib/program.js'
import { toWire, blankEx, applyCoachProgram, progPending } from '../lib/coachProgram.js'
import { coachOverride } from '../lib/coach.js'
import './coachProgram.css'

// ---------------------------------------------------------------- coach side

// Card in the client view: send a program, see what was sent, withdraw it.
export function ProgramCard({ clientId, state, plan, override, onChanged, onError }) {
  const [edit, setEdit] = useState(false)
  const sent = override?.program
  const withdraw = async () => {
    haptic('medium')
    const r = await coachOverride(clientId, { kcal: override?.kcal ?? null, protein: override?.protein ?? null, note: override?.note ?? '', program: null })
    if (r.status !== 200) return onError(r.error || 'offline')
    onChanged(r.override)
  }
  return (
    <section className="card">
      <span className="label">Program for this client</span>
      {sent ? (
        <>
          <p className="hint">Sent {new Date(override.progAt || override.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. They apply it from Today, their old plan is kept.</p>
          {sent.map((d, i) => (
            <div key={i} className="ch-day"><b>{d.name}</b><span className="hint">{d.exercises.map(e => `${e.name} ${e.sets}×${e.reps}`).join(' · ')}</span></div>
          ))}
          <div className="grid2">
            <button className="btn secondary" onClick={withdraw}>Withdraw</button>
            <button className="btn" onClick={() => { haptic(); setEdit(true) }}>Edit & resend</button>
          </div>
        </>
      ) : (
        <>
          <p className="hint">Start from their current plan, change what you want, send it. They get a notification and choose when to apply.</p>
          <button className="btn" onClick={() => { haptic(); setEdit(true) }}>Build program</button>
        </>
      )}
      {edit && <ProgramEditor clientId={clientId} state={state} start={sent || toWire(plan.days)} override={override} onClose={() => setEdit(false)} onSent={o => { setEdit(false); onChanged(o) }} onError={onError} />}
    </section>
  )
}

function ProgramEditor({ clientId, state, start, override, onClose, onSent, onError }) {
  useBackClose(true, onClose)
  const [days, setDays] = useState(() => JSON.parse(JSON.stringify(start)))
  const [pick, setPick] = useState(null) // day index being added to
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const pool = useMemo(() => exPool({ ...DEFAULT_INTAKE, ...(state?.intake || {}) }), [state])
  const choices = useMemo(() => {
    const t = q.trim().toLowerCase()
    const list = t ? LIB.filter(L => L.n.toLowerCase().includes(t) || L.cat.toLowerCase().includes(t)) : pool
    return list.slice(0, 40)
  }, [q, pool])

  const setDay = (i, fn) => setDays(ds => ds.map((d, j) => (j === i ? fn(d) : d)))
  const setEx = (i, k, patch) => setDay(i, d => ({ ...d, exercises: d.exercises.map((e, j) => (j === k ? { ...e, ...patch } : e)) }))
  const move = (i, k, dir) => setDay(i, d => {
    const ex = [...d.exercises], n = k + dir
    if (n < 0 || n >= ex.length) return d
    ;[ex[k], ex[n]] = [ex[n], ex[k]]
    return { ...d, exercises: ex }
  })
  const total = days.reduce((n, d) => n + d.exercises.length, 0)

  const send = async () => {
    haptic('medium'); setBusy(true)
    const clean = days.map(d => ({ ...d, exercises: d.exercises.filter(e => e.name) })).filter(d => d.exercises.length)
    const r = await coachOverride(clientId, { kcal: override?.kcal ?? null, protein: override?.protein ?? null, note: override?.note ?? '', program: clean })
    setBusy(false)
    if (r.status !== 200) return onError(r.error || 'offline')
    hapticSuccess(); onSent(r.override)
  }

  return (
    <>
      <div className="sheet-back" onClick={() => history.back()} />
      <div className="sheet cp-sheet">
        <span className="label">Program</span>
        {days.map((d, i) => (
          <div key={i} className="cp-day">
            <div className="cp-day-h">
              <input value={d.name} maxLength={40} aria-label={`Day ${i + 1} name`} onChange={e => setDay(i, x => ({ ...x, name: e.target.value }))} />
              <button className="cp-x" aria-label={`Remove ${d.name || 'day'}`} onClick={() => { haptic(); setDays(ds => ds.filter((_, j) => j !== i)) }}>✕</button>
            </div>
            {d.exercises.map((e, k) => (
              <div key={k} className="cp-ex">
                <div className="cp-ex-n"><b>{e.name}</b>
                  <span>
                    <button aria-label={`Move ${e.name} up`} disabled={k === 0} onClick={() => move(i, k, -1)}>▲</button>
                    <button aria-label={`Move ${e.name} down`} disabled={k === d.exercises.length - 1} onClick={() => move(i, k, 1)}>▼</button>
                    <button className="cp-x" aria-label={`Remove ${e.name}`} onClick={() => { haptic(); setDay(i, x => ({ ...x, exercises: x.exercises.filter((_, j) => j !== k) })) }}>✕</button>
                  </span>
                </div>
                <div className="cp-ex-f">
                  <label>Sets<input type="number" inputMode="numeric" min="1" max="10" value={e.sets} onChange={ev => setEx(i, k, { sets: Math.max(1, Math.min(10, +ev.target.value || 1)) })} /></label>
                  <label>Reps<input value={e.reps} maxLength={16} onChange={ev => setEx(i, k, { reps: ev.target.value })} /></label>
                  <label>Rest, s<input type="number" inputMode="numeric" min="0" max="600" value={e.rest} onChange={ev => setEx(i, k, { rest: Math.max(0, Math.min(600, +ev.target.value || 0)) })} /></label>
                </div>
              </div>
            ))}
            {pick === i ? (
              <div className="cp-pick">
                <input type="search" autoFocus placeholder="Search exercises" aria-label="Search exercises" value={q} onChange={e => setQ(e.target.value)} />
                <div className="cp-list">
                  {choices.map(L => (
                    <button key={L.id} onClick={() => { haptic(); setDay(i, x => ({ ...x, exercises: [...x.exercises, blankEx(L)] })); setPick(null); setQ('') }}>
                      <b>{L.n}</b><span>{L.cat} · {L.lvl}</span>
                    </button>
                  ))}
                  {!choices.length && <p className="hint">Nothing matches.</p>}
                </div>
                <button className="btn secondary" onClick={() => { setPick(null); setQ('') }}>Cancel</button>
              </div>
            ) : (
              <button className="cp-add" onClick={() => { haptic(); setPick(i); setQ('') }}>+ Add exercise</button>
            )}
          </div>
        ))}
        <button className="cp-add" onClick={() => { haptic(); setDays(ds => [...ds, { name: `Day ${ds.length + 1}`, exercises: [] }]) }} disabled={days.length >= 7}>+ Add day</button>
        <div className="grid2">
          <button className="btn secondary" onClick={() => history.back()}>Cancel</button>
          <button className="btn" disabled={!total || busy} onClick={send}>{busy ? 'Sending…' : 'Send to client'}</button>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------- client side

// Today card: the coach sent a program.
export function ProgramOffer({ state, update }) {
  const ov = state.coach?.override
  const [open, setOpen] = useState(false)
  if (!progPending(state, ov)) return null
  const dismiss = () => { haptic(); update(prev => ({ settings: { ...prev.settings, coachProgAt: ov.progAt || ov.at } })) }
  const apply = () => { haptic('medium'); update(prev => applyCoachProgram(prev, ov)); hapticSuccess() }
  return (
    <div className="card ch-note">
      <div className="row"><span className="label">Coach · {state.coach.name}</span><span className="ch-badge">New program</span></div>
      <p className="ch-note-t">{state.coach.name} built you a new training program: {ov.program.length} {ov.program.length === 1 ? 'day' : 'days'}, {ov.program.reduce((n, d) => n + d.exercises.length, 0)} exercises.</p>
      {open && ov.program.map((d, i) => (
        <div key={i} className="ch-day"><b>{d.name}</b><span className="hint">{d.exercises.map(e => `${e.name} ${e.sets}×${e.reps}`).join(' · ')}</span></div>
      ))}
      <button className="cp-add" onClick={() => setOpen(o => !o)}>{open ? 'Hide' : 'See what’s in it'}</button>
      <p className="hint">Applying replaces your current plan. Your old one is kept.</p>
      <div className="ch-note-a">
        <button className="btn secondary" onClick={dismiss}>Not now</button>
        <button className="btn" onClick={apply}>Apply</button>
      </div>
    </div>
  )
}
