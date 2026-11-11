import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import BeetMascot from './BeetMascot.jsx'
import Ic from './Icons.jsx'
import { dayKey, dayTasks, eaten, targets, waterOf, week, streakInfo, program, nextDayIndex, setsLogged } from '../lib/day.js'
import { planStatus } from '../lib/train.js'
import { hapticSuccess, haptic } from '../lib/platform.js'
import { useBackClose } from '../lib/hooks.js'
import './dayDone.css'

const SEEN = 'beetfit_daydone'

// Opens once, the moment the third task of the day is ticked. Not on app start, so reopening the app never replays it.
export function useDayDone(state) {
  const key = dayKey()
  const done = dayTasks(state, key).every(t => t.done)
  const prev = useRef(done)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (done && !prev.current) {
      let seen = null
      try { seen = localStorage.getItem(SEEN) } catch { /* ignore */ }
      if (seen !== key) {
        try { localStorage.setItem(SEEN, key) } catch { /* ignore */ }
        hapticSuccess(); setOpen(true)
      }
    }
    prev.current = done
  }, [done, key])
  return [open, () => setOpen(false), () => { haptic(); setOpen(true) }, done]
}

// What was done today, as numbers with no verdicts (no "you ate too little/much"), and what comes next.
export function DayDone({ state, coach, onClose }) {
  useBackClose(true, onClose)
  const key = dayKey()
  const t = targets(state, key), e = eaten(state, key)
  const water = waterOf(state, key)
  const si = streakInfo(state, key)
  const wk = week(state, key)
  const trained = setsLogged(state, key) > 0
  const rest = !trained && dayTasks(state, key).some(x => x.rest)
  const log = state.workoutLog?.[key] || {}
  const sets = Object.entries(log).filter(([n]) => !n.startsWith('__')).flatMap(([, v]) => (v?.sets || []).filter(s => s && (s.reps != null || s.secs != null)))
  const cam = sets.filter(s => s.auto).length
  const kg = Math.round(sets.reduce((a, s) => a + (s.w || 0) * (s.reps || 0), 0))
  const prog = program(state)
  const ts = planStatus(state, key)
  const next = prog.days[trained && ts.nextIdx != null ? ts.nextIdx : nextDayIndex(state, key)]
  const nextName = next?.name?.split('—')[1]?.trim() || next?.name
  const days = wk.filter(d => d.score >= 2).length

  const tiles = [
    { i: 'flame', v: e.kcal.toLocaleString('en-US'), l: 'kcal', s: `of ${t.kcal.toLocaleString('en-US')}` },
    { i: 'protein', v: `${e.p}g`, l: 'protein', s: `of ${t.protein}g` },
    { i: 'water', v: water, l: 'glasses', s: `of ${t.water}` },
    rest ? { i: 'moon', v: 'Rest', l: 'recovery', s: 'planned' } : { i: 'train', v: sets.length, l: 'sets', s: kg > 0 ? `${kg.toLocaleString('en-US')} kg` : cam ? `${cam} by camera` : '' }
  ]

  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = '' } }, [])
  return createPortal(
    <div className="dd" role="dialog" aria-label="Day complete">
      <div className="dd-in">
        <div className="dd-stage">
          <div className="dd-burst" aria-hidden="true">{Array.from({ length: 12 }).map((_, i) => <i key={i} style={{ '--a': `${i * 30}deg` }} />)}</div>
          <BeetMascot mood="cheer" size={132} title="Beet celebrates" />
        </div>
        <h1 className="dd-h">Day complete</h1>
        <p className="dd-sub">{rest ? 'Food, water and a proper rest day.' : 'Food, water and training. All three.'}</p>

        <div className="dd-tiles">
          {tiles.map((x, i) => (
            <div key={x.l} style={{ animationDelay: `${140 + i * 70}ms` }} aria-label={`${x.v} ${x.l}${x.s ? ', ' + x.s : ''}`}>
              <Ic n={x.i} className="solid dd-ic" />
              <b className="num">{x.v}</b>
              <span>{x.l}</span>
              {x.s && <small className="num">{x.s}</small>}
            </div>
          ))}
        </div>

        <div className="dd-card" style={{ animationDelay: '460ms' }}>
          <div className="row"><span className="label">This week</span><span className="num dd-wk">{days}/7 days{si.days > 0 ? ` · ${si.days}-day streak` : ''}</span></div>
          <div className="dd-days">
            {wk.map(d => <span key={d.key} className={d.today ? 'today' : ''}><i className={d.score == null ? 'future' : d.paused && !(d.score >= 2) ? 'pz' : `s${d.score}`} />{d.label}</span>)}
          </div>
        </div>

        {coach && trained && (
          <p className="dd-coach" style={{ animationDelay: '520ms' }}><Ic n="people" className="solid" /><span><b>{coach}</b> got your session{cam ? <>: <b className="num">{cam} of {sets.length}</b> sets verified by camera</> : ''}.</span></p>
        )}
        {next && <p className="dd-next" style={{ animationDelay: '580ms' }}>Tomorrow: <b>{nextName}</b> · {next.exercises.length} {next.exercises.length === 1 ? 'exercise' : 'exercises'}</p>}

        <button className="btn dd-btn" onClick={() => history.back()}>Done</button>
      </div>
    </div>,
    document.body
  )
}
