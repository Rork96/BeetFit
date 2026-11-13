import React, { useState } from 'react'
import { haptic } from '../lib/platform.js'
import Ic from './Icons.jsx'
import { dayKey } from '../lib/day.js'
import { HABIT_TEMPLATES, HABIT_OBJECTS, MAX_HABITS, habitsOf, habitDone, habitStreak, habitDays, scheduledOn, WEEKDAYS, habitIcon, habitWeek, habitByHand, habitAt, addHabitPatch, editHabitPatch, removeHabitPatch } from '../lib/habits.js'
import './habits.css'

const pad = n => String(n).padStart(2, '0')
const clock = h => `${pad(h.h)}:${pad(h.m)}`
const showTime = h => new Date(2000, 0, 1, h.h, h.m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

// Today: tap a habit, show the camera its object.
const WD1 = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const hhmm = ts => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

// First-time card: the pitch, plus one-tap starters so the first habit costs a single tap.
function HabitsInvite({ update, openSetup }) {
  const add = t => { haptic(); update(prev => addHabitPatch(prev, t)) }
  return (
    <section className="card hb-invite">
      <div className="hb-hero" aria-hidden="true">
        <div className="hb-finder"><i /><i /><i /><i /><span>🪥</span></div>
        <div className="hb-proof-chip"><b>✓</b> Proved 7:31</div>
      </div>
      <div className="hb-invite-t">
        <span className="label">New · Habits</span>
        <h3>Habits that need proof.</h3>
        <p className="hint">Pick a time. When it rings, show Beet the toothbrush, the glass, the vitamins. No camera, no tick.</p>
      </div>
      <div className="hb-starters">
        {HABIT_TEMPLATES.slice(0, 3).map(t => (
          <button key={t.id} className="hb-starter" onClick={() => add(t)}>
            <span className="hb-starter-i" aria-hidden="true">{habitIcon(t)}</span>
            <b>{t.n}</b><small className="num">{showTime(t)}</small>
          </button>
        ))}
      </div>
      <div className="hb-invite-a">
        <button className="btn ghost" onClick={() => { haptic(); update(prev => ({ settings: { ...(prev.settings || {}), habitsHint: false } })) }}>Not now</button>
        <button className="btn secondary" onClick={() => { haptic(); openSetup() }}>Make my own</button>
      </div>
      <p className="hb-private">🔒 Checked on your phone. Video never leaves it.</p>
    </section>
  )
}

export function HabitsToday({ state, update, onCheck, openSetup }) {
  const all = habitsOf(state)
  const key = dayKey()
  const list = all.filter(h => scheduledOn(h, key) || habitDone(state, h.id, key)) // not-today habits stay out of the way
  if (!all.length) return state.settings?.habitsHint === false ? null : <HabitsInvite update={update} openSetup={openSetup} />
  if (!list.length) return null
  const now = new Date(), mins = now.getHours() * 60 + now.getMinutes()
  const done = list.filter(h => habitDone(state, h.id, key)).length
  const allDone = done === list.length
  return (
    <section className={'card hb-card' + (allDone ? ' all' : '')}>
      <div className="hb-head">
        <div><span className="label">Habits</span><small className="hb-sub">{allDone ? 'All proved today' : 'Proof by camera'}</small></div>
        <div className="hb-meter" role="img" aria-label={`${done} of ${list.length} done`}>
          {list.map(h => <i key={h.id} className={habitDone(state, h.id, key) ? 'on' : ''} />)}
          <b className="num">{done}/{list.length}</b>
        </div>
      </div>
      {list.map(h => {
        const ok = habitDone(state, h.id, key), s = habitStreak(state, h.id, key, habitDays(h))
        const due = !ok && h.on && mins >= h.h * 60 + h.m
        const sub = ok ? (habitByHand(state, h.id, key) ? 'Ticked by hand' : `Proved on camera · ${hhmm(habitAt(state, h.id, key))}`)
          : due ? `Now · show ${h.ask || h.labels?.[0] || 'it'}` : `${h.on ? showTime(h) + ' · ' : ''}show ${h.ask || h.labels?.[0] || 'it'}`
        return (
          <button key={h.id} className={'hb-row' + (ok ? ' ok' : due ? ' due' : '')} disabled={ok} aria-label={ok ? `${h.n}, done` : `${h.n}. Prove it with the camera`} onClick={() => { haptic(); onCheck(h) }}>
            <span className="hb-ico" aria-hidden="true">{habitIcon(h)}{ok && <i className="hb-tick">✓</i>}</span>
            <span className="hb-main">
              <span className="hb-line"><b>{h.n}</b>{s > 1 && <span className="hb-s num" title={`${s} days in a row`}>🔥{s}</span>}</span>
              <small>{sub}</small>
              <span className="hb-week" aria-hidden="true">
                {habitWeek(state, h, key).map(c => <i key={c.d} className={c.st}><em>{WD1[c.wd]}</em></i>)}
              </span>
            </span>
            {!ok && <span className="hb-go"><Ic n="cam" size={16} /><span className="hb-go-t">Prove</span></span>}
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
          <div className="rm-t"><b><span className="hb-setup-i" aria-hidden="true">{habitIcon(h)}</span>{h.n}</b><span className="hint">Camera looks for: {h.labels.join(', ')}</span></div>
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
          {free.map(t => <button key={t.id} className="chip" onClick={() => { haptic(); update(prev => addHabitPatch(prev, t)) }}>{habitIcon(t)} {t.n}</button>)}
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
