import React, { useState } from 'react'
import { dayKey, eaten, targets, waterOf, dayTasks, streak, week, program, nextDayIndex, setsLogged, currentWeight, fmtWeight } from '../lib/day.js'
import { trackerFor } from '../camera/RepTracker.jsx'
import { useCountUp } from '../lib/hooks.js'
import BodyFigure from './BodyFigure.jsx'
import { haptic, hapticSuccess } from '../lib/platform.js'
import { CoachNote } from './Coach.jsx'
import { BeetCard } from './Beet.jsx'
import { ReadCard } from './Read.jsx'
import './today.css'

const greeting = () => { const h = new Date().getHours(); return h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening' }

export default function TodayTab({ state, update, go, openSettings, coach, openChat, askBeet, openRead }) {
  const key = dayKey()
  const t = targets(state)
  const e = eaten(state, key)
  const water = waterOf(state, key)
  const tasks = dayTasks(state, key)
  const st = streak(state, key)
  const wk = week(state, key)
  const units = state.settings?.units || 'kg'
  const name = state.settings?.name

  const remaining = Math.max(0, t.kcal - e.kcal)
  const shownRemaining = useCountUp(remaining)
  const kcalPct = Math.min(1, e.kcal / t.kcal)
  const [splash, setSplash] = useState(0)

  const prog = program(state)
  const dayIdx = nextDayIndex(state, key)
  const day = prog.days[dayIdx]
  const trainedToday = setsLogged(state, key) > 0
  const camCount = day.exercises.filter(ex => trackerFor(ex)).length

  const wNow = currentWeight(state)
  const wStart = state.weightLog?.[0]?.kg ?? wNow
  const toGo = +(wNow - state.profile.targetKg).toFixed(1)

  const addGlass = delta => {
    haptic(delta > 0 ? 'light' : 'medium')
    const next = Math.max(0, water + delta)
    if (delta > 0) setSplash(s => s + 1)
    if (next === t.water && delta > 0) hapticSuccess()
    update(prev => ({ water: { ...(prev.water || {}), [key]: next } }))
  }

  const R = 64, C = 2 * Math.PI * R

  return (
    <div className="page today">
      <div className="row td-top">
        <div>
          <div className="label">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</div>
          <div className="hero"><span className="glow" /><h1>{greeting()}{name ? `, ${name}` : ''}</h1></div>
        </div>
        <button className="td-icon" onClick={() => { haptic(); openSettings() }} aria-label="Settings">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="6" height="6" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.5 2.5M16.5 16.5L19 19M5 19l2.5-2.5M16.5 7.5L19 5" /></svg>
        </button>
      </div>

      <div className="stk td-stack">
        {coach && <CoachNote coach={coach} onOpen={openChat} />}
        <button className={'td-streak' + (st >= 7 ? ' hot' : '')} onClick={() => go('progress')}>
          <span className="td-mark" /><span className="num">{st > 0 ? `${st}-day streak` : 'Start your streak today'}</span>
        </button>

        {/* Calories */}
        <div className="card td-kcal">
          <div className="td-ring">
            <svg viewBox="0 0 160 160">
              <circle cx="80" cy="80" r={R} className="trk" />
              <circle cx="80" cy="80" r={R} className={'val' + (e.kcal > t.kcal * 1.1 ? ' over' : '')}
                style={{ strokeDasharray: C, strokeDashoffset: C * (1 - kcalPct) }} />
            </svg>
            <div className="td-ring-in">
              <b className="num">{shownRemaining}</b>
              <span>kcal left</span>
            </div>
          </div>
          <div className="td-kcal-side">
            <div><span className="label">Eaten</span><b className="num">{e.kcal}</b></div>
            <div><span className="label">{t.coach ? <span className="ch-tag">Coach target</span> : 'Target'}</span><b className="num">{t.kcal}</b></div>
            <Macro label="Protein" v={e.p} max={t.protein} color="var(--accent)" />
            <Macro label="Carbs" v={e.c} max={t.carbs} color="var(--data-2)" />
            <Macro label="Fat" v={e.f} max={t.fat} color="var(--water)" />
          </div>
          <button className="td-link" onClick={() => go('meals')}>Log food →</button>
        </div>

        {/* Water + Body */}
        <div className="grid2">
          <div className="card td-water">
            <div className="row"><span className="label">Water</span><span className="num td-small">{water}/{t.water}</span></div>
            <div className="td-glasses">
              {Array.from({ length: t.water }, (_, i) => <i key={i} className={i < water ? 'on' : ''} style={{ transitionDelay: `${i * 29}ms` }} />)}
            </div>
            <div className="td-water-btns">
              <button onClick={() => addGlass(-1)} disabled={!water} aria-label="Remove a glass">−</button>
              <button className="add" onClick={() => addGlass(1)} aria-label="Add a glass">+ glass{splash > 0 && <span className="td-splash" key={splash} />}</button>
            </div>
          </div>
          <button className="card td-body" onClick={() => go('progress')}>
            <span className="td-fig"><BodyFigure sex={state.profile.sex} heightCm={state.profile.heightCm} startKg={wStart} currentKg={wNow} targetKg={state.profile.targetKg} goal={state.profile.goal} show="target" height={118} /></span>
            <span className="label">Body</span>
            <b className="num">{fmtWeight(wNow, units)}</b>
            <span className="td-small">{toGo === 0 ? 'At target' : `${fmtWeight(Math.abs(toGo), units)} to go`}</span>
            <span className={'td-delta ' + ((wNow - wStart) * (wStart - state.profile.targetKg) > 0 ? 'good' : 'flat')}>
              {wNow - wStart === 0 ? 'since start: —' : `since start: ${wNow - wStart > 0 ? '+' : '−'}${fmtWeight(Math.abs(wNow - wStart), units)}`}
            </span>
          </button>
        </div>

        {/* Workout */}
        <div className="card td-work">
          <div className="row">
            <span className="label">{trainedToday ? 'Trained today' : "Today's session"}</span>
            {camCount > 0 && <span className="ex-cam">▣ {camCount} camera-tracked</span>}
          </div>
          <h2>{day.name.split('—')[1]?.trim() || day.name}</h2>
          <p className="hint num">{day.exercises.length} exercises · {day.exercises.map(x => x.name.split(' (')[0]).slice(0, 3).join(', ')}…</p>
          <button className={'btn' + (trainedToday ? ' secondary' : '')} onClick={() => { haptic(); go('workout', { start: true, dayIdx }) }}>
            {trainedToday ? 'Open workout' : 'Start session'}
          </button>
        </div>

        {askBeet && <BeetCard state={state} onAsk={askBeet} />}

        {/* Week */}
        <div className="card">
          <div className="row"><span className="label">This week</span><span className="td-small num">{wk.filter(d => d.score >= 2).length}/7 days</span></div>
          <div className="td-week">
            {wk.map(d => (
              <div key={d.key} className={'td-day' + (d.today ? ' today' : '')}>
                <i className={d.score == null ? 'future' : `s${d.score}`} />
                <span>{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tasks */}
        <div className="card">
          <span className="label">Daily tasks · 2 of 3 keeps the streak</span>
          {tasks.map(tk => (
            <div className="ex-row" key={tk.id}>
              <span className={'ex-mark' + (tk.done ? ' on' : '')}>{tk.done && <svg viewBox="0 0 24 24"><polyline points="5 12.5 10 17 19 7" /></svg>}</span>
              <div className="ex-main"><div className="ex-name" style={{ fontWeight: 500, opacity: tk.done ? 0.6 : 1 }}>{tk.label}</div></div>
            </div>
          ))}
        </div>

        {openRead && <ReadCard state={state} onOpen={openRead} />}
      </div>
    </div>
  )
}

function Macro({ label, v, max, color }) {
  return (
    <div className="td-macro">
      <div className="row"><span>{label}</span><span className="num">{v}<small>/{max}g</small></span></div>
      <div className="td-bar"><i style={{ transform: `scaleX(${Math.min(1, v / max)})`, background: color }} /></div>
    </div>
  )
}
