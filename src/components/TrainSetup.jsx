// Where and when you train: shared by onboarding and Settings → Training.
import React, { useState } from 'react'
import Ic from './Icons.jsx'
import { EQLABEL } from '../data/library.js'
import { DEFAULT_INTAKE } from '../lib/program.js'
import { DOW, weekPlanOf, setWeekPlan } from '../lib/plans.js'
import { rebuildKeep, defaultWeekdays } from '../lib/myex.js'
import { haptic, hapticSuccess } from '../lib/platform.js'
import { dayKey } from '../lib/day.js'
import './myex.css'

export const PLACES = [['home, no equipment', 'Home', 'no kit', 'today'], ['home, basic', 'Home', 'some kit', 'weight'], ['gym', 'Gym', 'full kit', 'train']]
export const KIT = ['dumbbell', 'kettlebell', 'bands', 'pullup_bar', 'bench']
export const placeName = loc => (loc === 'gym' ? 'the gym' : loc === 'home, basic' ? 'home with your kit' : 'home, no equipment')

export function PlacePick({ loc, ownEq = [], onLoc, onEq }) {
  return (
    <>
      <div className="ob-tiles">
        {PLACES.map(([v, t, s, ic]) => (
          <button key={v} className={'ob-tile' + (loc === v ? ' on' : '')} onClick={() => { haptic(); onLoc(v) }} aria-pressed={loc === v}>
            <Ic n={ic} className="solid" /><b>{t}</b><small>{s}</small>
          </button>
        ))}
      </div>
      {loc === 'home, basic' && (
        <div className="chips wrap" aria-label="Your kit">
          {KIT.map(e => {
            const on = ownEq.includes(e)
            return <button key={e} className={'chip' + (on ? ' on' : '')} aria-pressed={on} onClick={() => { haptic(); onEq(on ? ownEq.filter(x => x !== e) : [...ownEq, e]) }}>{EQLABEL[e]}</button>
          })}
        </div>
      )}
    </>
  )
}

// Weekdays, 0 = Mon. The count is the sessions per week (the plan builds 2–5 lifting days).
export function WeekdayPick({ days, onChange, min = 1, max = 6 }) {
  const flip = i => {
    haptic()
    if (days.includes(i)) { if (days.length > min) onChange(days.filter(x => x !== i)) }
    else if (days.length < max) onChange([...days, i].sort())
  }
  return (
    <div className="ob-days tw-days" role="group" aria-label="Training days">
      {DOW.map((d, i) => {
        const on = days.includes(i)
        return <button key={d} aria-pressed={on} className={on ? 'cur' : ''} disabled={!on && days.length >= max} onClick={() => flip(i)}><b>{d.slice(0, 2)}</b></button>
      })}
    </div>
  )
}

export const daysLine = days => {
  if (!days.length) return 'No set days: the plan suggests when to train'
  const gaps = days.some((d, k) => k && d - days[k - 1] === 1)
  return `${days.length} ${days.length === 1 ? 'day' : 'days'} a week · ${days.map(d => DOW[d]).join(', ')}${gaps && days.length < 5 ? ' · back-to-back days are fine for upper/lower splits' : ''}`
}

// Settings → Training. Changing place or the number of days rebuilds the plan; exercises put in by hand stay.
export function TrainingCard({ state, update }) {
  const it = state.intake || DEFAULT_INTAKE
  const wp = weekPlanOf(state)
  const [loc, setLoc] = useState(it.loc)
  const [eq, setEq] = useState(it.ownEq || [])
  const [days, setDays] = useState(() => (wp.days.length ? [...wp.days].sort() : defaultWeekdays(it.daysWk)))
  const [inj, setInj] = useState(it.injuries || '')
  const [done, setDone] = useState(null)

  const n = Math.max(2, Math.min(5, days.length || it.daysWk))
  const kitChanged = loc !== it.loc || (loc === 'home, basic' && [...eq].sort().join() !== [...(it.ownEq || [])].sort().join())
  const progChanged = kitChanged || n !== it.daysWk || inj.trim() !== (it.injuries || '').trim()
  const daysChanged = [...days].sort().join() !== [...wp.days].sort().join()
  const changed = progChanged || daysChanged
  const kept = (state.program || []).flatMap(d => d.exercises).filter(e => e.custom || e.added).length

  const save = (rebuild = progChanged) => {
    hapticSuccess()
    update(prev => {
      const intake = { ...(prev.intake || DEFAULT_INTAKE), loc, ownEq: loc === 'home, basic' ? eq : [], daysWk: n, injuries: inj.trim().slice(0, 80), weekdays: days }
      return {
        intake,
        ...(daysChanged ? { plans: setWeekPlan(prev.plans, days, wp.time, wp.days.length ? wp.remind : false, dayKey()) } : {}),
        ...(rebuild ? { program: rebuildKeep(prev.profile.goal, intake, prev.program, prev.myEx) } : {})
      }
    })
    setDone(rebuild ? `Plan rebuilt for ${placeName(loc)}, ${n} days a week${kept ? `. Your ${kept} added exercise${kept === 1 ? '' : 's'} stayed` : ''}.` : 'Training days saved.')
    setTimeout(() => setDone(null), 3500)
  }

  return (
    <section className="card tw-card" id="training">
      <span className="label">Training</span>
      <div className="tw-f"><b>Where you train</b>
        <PlacePick loc={loc} ownEq={eq} onLoc={setLoc} onEq={setEq} />
      </div>
      <div className="tw-f"><b>Training days</b>
        <WeekdayPick days={days} onChange={setDays} min={0} />
        <span className="hint num">{daysLine(days)}{days.length > 5 ? ' · the plan has 5 sessions, the extra day is for a walk or mobility' : ''}</span>
        {!wp.days.length && days.length > 0 && <span className="hint tw-sug">Suggested. Save them so rest days, reminders and your coach’s check-ins line up.</span>}
      </div>
      <label>Injuries or pain (plan leaves these out)
        <input value={inj} placeholder="e.g. left knee" maxLength={80} onChange={e => setInj(e.target.value)} />
      </label>
      {done ? <p className="tw-done" role="status"><Ic n="check" />{done}</p> : changed ? (
        <>
          <button className="btn" onClick={() => save()}>{progChanged ? 'Save and rebuild my plan' : 'Save training days'}</button>
          {progChanged && <p className="hint" style={{ margin: 0 }}>New exercises for {placeName(loc)}. {kept ? 'Exercises you added by hand stay. ' : ''}Your history stays.</p>}
        </>
      ) : (
        <button className="btn secondary" onClick={() => { haptic('medium'); save(true) }}>Rebuild my plan</button>
      )}
    </section>
  )
}
