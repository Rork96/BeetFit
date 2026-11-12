import React, { useState } from 'react'
import { haptic } from '../lib/platform.js'
import { dayKey } from '../lib/day.js'
import { HABIT_TEMPLATES, HABIT_OBJECTS, MAX_HABITS, habitsOf, habitDone, habitStreak, habitDays, scheduledOn, WEEKDAYS, addHabitPatch, editHabitPatch, removeHabitPatch } from '../lib/habits.js'
import './habits.css'

const pad = n => String(n).padStart(2, '0')
const clock = h => `${pad(h.h)}:${pad(h.m)}`

// Today: tap a habit, show the camera its object.
export function HabitsToday({ state, update, onCheck, openSetup }) {
  const all = habitsOf(state)
  const key = dayKey()
  const list = all.filter(h => scheduledOn(h, key) || habitDone(state, h.id, key)) // not-today habits stay out of the way
  if (!all.length) {
    if (state.settings?.habitsHint === false) return null
    return (
      <section className="card hb-invite">
        <div className="hb-invite-t"><b>Habits</b><span className="hint">A reminder, then show the camera the toothbrush or the glass. It ticks itself off.</span></div>
        <div className="hb-invite-a">
          <button className="btn secondary" onClick={() => { haptic(); update(prev => ({ settings: { ...(prev.settings || {}), habitsHint: false } })) }}>Not now</button>
          <button className="btn" onClick={() => { haptic(); openSetup() }}>Set up</button>
        </div>
      </section>
    )
  }
  if (!list.length) return null
  const done = list.filter(h => habitDone(state, h.id, key)).length
  return (
    <section className="card hb-card">
      <div className="hb-head"><span className="label">Habits</span><span className="num hb-count">{done}/{list.length}</span></div>
      {list.map(h => {
        const ok = habitDone(state, h.id, key), s = habitStreak(state, h.id, key, habitDays(h))
        return (
          <button key={h.id} className={'hb-row' + (ok ? ' ok' : '')} disabled={ok} aria-label={ok ? `${h.n}, done` : `${h.n}. Check with camera`} onClick={() => { haptic(); onCheck(h) }}>
            <i className="hb-dot" aria-hidden="true">{ok ? '✓' : ''}</i>
            <span className="hb-n"><b>{h.n}</b><small>{ok ? 'Done today' : `Show ${h.ask || h.labels?.[0] || 'it'}`}</small></span>
            {s > 0 && <span className="hb-s num" title="days in a row">{s}d</span>}
            {!ok && h.on && <span className="hb-t num">{clock(h)}</span>}
          </button>
        )
      })}
    </section>
  )
}

// Settings → Reminders: which habits, when, and what the camera looks for.
export function HabitsSetup({ state, update }) {
  const list = habitsOf(state)
  const [custom, setCustom] = useState(false)
  const [name, setName] = useState('')
  const [obj, setObj] = useState('bottle')
  const free = HABIT_TEMPLATES.filter(t => !list.some(h => h.id === t.id))
  const full = list.length >= MAX_HABITS
  return (
    <section className="card hb-setup">
      <span className="label">Habits</span>
      <p className="hint" style={{ margin: 0 }}>At the set time you get a reminder (turn on notifications above). Open it, show the camera the object, and the habit is done. Video never leaves your phone.</p>
      {list.map(h => (
        <div key={h.id} className={'rm-row' + (h.on ? '' : ' off')}>
          <button className={'rm-check' + (h.on ? ' on' : '')} aria-label={`${h.n} reminder`} onClick={() => { haptic(); update(prev => editHabitPatch(prev, h.id, { on: !h.on })) }} />
          <div className="rm-t"><b>{h.n}</b><span className="hint">Camera looks for: {h.labels.join(', ')}</span></div>
          <input type="time" className="rm-time num" aria-label={`${h.n} time`} value={clock(h)} disabled={!h.on}
            onChange={e => { const [hh, mm] = e.target.value.split(':').map(Number); if (Number.isFinite(hh)) update(prev => editHabitPatch(prev, h.id, { h: hh, m: mm || 0 })) }} />
          <div className="hb-days" role="group" aria-label={`${h.n} days`}>
            {WEEKDAYS.map((w, i) => {
              const on = !habitDays(h) || h.days.includes(i)
              return <button key={w} className={'hb-day' + (on ? ' on' : '')} aria-pressed={on} onClick={() => {
                haptic()
                const cur = habitDays(h) || [0, 1, 2, 3, 4, 5, 6]
                const next = cur.includes(i) ? cur.filter(x => x !== i) : [...cur, i].sort()
                if (next.length) update(prev => editHabitPatch(prev, h.id, { days: next.length === 7 ? [] : next }))
              }}>{w}</button>
            })}
            <button className={'hb-day loud' + (h.loud !== false ? ' on' : '')} aria-pressed={h.loud !== false} title="Loud alarm: stays on screen, vibrates, rings while the app is open" onClick={() => { haptic(); update(prev => editHabitPatch(prev, h.id, { loud: h.loud === false })) }}>🔔</button>
          </div>
          <button className="hb-x" aria-label={`Remove ${h.n}`} onClick={() => { haptic(); update(prev => removeHabitPatch(prev, h.id)) }}>✕</button>
        </div>
      ))}
      {!full && free.length > 0 && (
        <div className="chips wrap">
          {free.map(t => <button key={t.id} className="chip" onClick={() => { haptic(); update(prev => addHabitPatch(prev, t)) }}>+ {t.n}</button>)}
          <button className="chip" onClick={() => { haptic(); setCustom(c => !c) }}>+ Your own</button>
        </div>
      )}
      {!full && free.length === 0 && !custom && <button className="chip" onClick={() => setCustom(true)}>+ Your own</button>}
      {custom && !full && (
        <div className="hb-custom stk">
          <label>Name<input value={name} maxLength={24} placeholder="Read for 10 minutes" onChange={e => setName(e.target.value)} /></label>
          <label>The camera looks for
            <select value={obj} onChange={e => setObj(e.target.value)}>{HABIT_OBJECTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
          <button className="btn" disabled={!name.trim()} onClick={() => {
            haptic(); const label = HABIT_OBJECTS.find(([v]) => v === obj)?.[1]?.toLowerCase() || obj
            update(prev => addHabitPatch(prev, { n: name.trim(), labels: [obj], ask: `a ${label}`, h: 9, m: 0 })); setName(''); setCustom(false)
          }}>Add habit</button>
        </div>
      )}
      {full && <p className="hint" style={{ margin: 0 }}>Up to {MAX_HABITS} habits.</p>}
    </section>
  )
}
