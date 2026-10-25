import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { dayKey, addDays, mondayOf, dayScore, streakInfo, bestStreak, todayStanding, nextMilestone, prevMilestone, MILESTONES } from '../lib/day.js'
import { haptic, hapticSuccess } from '../lib/platform.js'
import { useBackClose } from '../lib/hooks.js'
import './streak.css'

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const TASK = { food: 'Log food', water: 'Finish water', train: 'Train' }

// The pill on Today. Evening + streak + today not counted yet = "at risk".
export function StreakPill({ state, onOpen }) {
  const today = dayKey()
  const { days } = streakInfo(state, today)
  const s = todayStanding(state, today)
  const risk = days > 0 && s.need > 0 && new Date().getHours() >= 17
  const text = days === 0 ? (s.need === 0 ? 'Today counts. Streak started' : 'Start your streak today')
    : risk ? `${days}-day streak · ${s.need} more task${s.need > 1 ? 's' : ''} tonight`
      : `${days}-day streak${s.need === 0 ? ' · today ✓' : ''}`
  return (
    <button className={'td-streak' + (days >= 7 ? ' hot' : '') + (risk ? ' risk' : '')} onClick={() => { haptic(); onOpen() }}>
      <span className="td-mark" /><span className="num">{text}</span>
    </button>
  )
}

export function StreakSheet({ state, onClose, onCalendar }) {
  const today = dayKey()
  const info = streakInfo(state, today)
  const best = Math.max(bestStreak(state, today), info.days)
  const s = todayStanding(state, today)
  const next = nextMilestone(info.days), prev = prevMilestone(info.days)
  const pct = Math.min(1, (info.days - prev) / (next - prev))
  const usedOn = info.frozen.find(f => mondayOf(f) === mondayOf(today))
  // 12 weeks, Monday-first columns, oldest left
  const start = addDays(mondayOf(today), -77)
  const frozen = new Set(info.frozen)
  const weeks = Array.from({ length: 12 }, (_, w) => Array.from({ length: 7 }, (_, d) => {
    const k = addDays(start, w * 7 + d)
    return { k, score: k > today ? null : dayScore(state, k), frz: frozen.has(k), today: k === today }
  }))
  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = '' } }, [])

  return createPortal(
    <>
      <div className="sheet-back" onClick={onClose} />
      <div className="sheet sk" role="dialog" aria-label="Streak">
        <div className="sk-top">
          <div className="sk-big"><span className="sk-mark" /><b className="num">{info.days}</b></div>
          <div>
            <div className="sk-h">{info.days === 1 ? 'day' : 'days'} in a row</div>
            <div className="hint num">Best {best} · next milestone {next}</div>
          </div>
        </div>

        <div className="sk-ms">
          <div className="sk-bar"><i style={{ transform: `scaleX(${pct})` }} /></div>
          <div className="sk-ms-l num">{MILESTONES.filter(m => m <= Math.max(next, 30)).slice(0, 6).map(m => <span key={m} className={info.days >= m ? 'on' : ''}>{m}</span>)}</div>
        </div>

        <div className="sk-card">
          <span className="label">Today</span>
          <div className="sk-tasks">
            {s.todo.length < 3 && ['food', 'water', 'train'].filter(id => !s.todo.some(t => t.id === id)).map(id => <span key={id} className="chip on">✓ {TASK[id]}</span>)}
            {s.todo.map(t => <span key={t.id} className="chip">{TASK[t.id]}</span>)}
          </div>
          <p className="hint">{s.need === 0 ? 'Today counts. Anything else is a bonus.' : `${s.need} more and today counts. Any ${s.need === 1 ? 'one' : 'two'} of the open tasks.`}</p>
        </div>

        <div className="sk-card">
          <span className="label">Freeze</span>
          <p className="sk-frz">{usedOn ? `Used on ${DOW[(new Date(usedOn + 'T12:00').getDay() + 6) % 7]}. A new one comes Monday.` : 'Ready. One missed day this week won’t break your streak.'}</p>
        </div>

        <div className="sk-card">
          <span className="label">Last 12 weeks</span>
          <div className="sk-grid" aria-hidden="true">
            {weeks.map((w, i) => (
              <div key={i} className="sk-col">
                {w.map(c => <i key={c.k} className={(c.score == null ? 'fut' : c.frz ? 'frz' : `s${c.score}`) + (c.today ? ' now' : '')} style={{ animationDelay: `${i * 25}ms` }} />)}
              </div>
            ))}
          </div>
          <p className="hint">A day counts at 2 of 3: food logged, water done, training. One miss a week is covered.</p>
        </div>

        <div className="grid2">
          <button className="btn secondary" onClick={onClose}>Close</button>
          <button className="btn" onClick={onCalendar}>Calendar</button>
        </div>
      </div>
    </>,
    document.body
  )
}

// Hitting 3, 7, 14, 30… shows once per run.
const SEEN = 'beetfit_milestones'
export function useMilestone(state) {
  const today = dayKey()
  const days = streakInfo(state, today).days
  const [show, setShow] = useState(null)
  useEffect(() => {
    if (!MILESTONES.includes(days)) return
    let seen = {}
    try { seen = JSON.parse(localStorage.getItem(SEEN)) || {} } catch { /* ignore */ }
    const last = seen[days]
    if (last && (Date.parse(today) - Date.parse(last)) / 864e5 <= days) return
    try { localStorage.setItem(SEEN, JSON.stringify({ ...seen, [days]: today })) } catch { /* ignore */ }
    hapticSuccess()
    setShow(days)
  }, [days, today])
  return [show, () => setShow(null)]
}

export function Milestone({ days, onClose }) {
  useBackClose(true, onClose)
  useEffect(() => { const t = setTimeout(() => history.back(), 4200); return () => clearTimeout(t) }, [])
  return createPortal(
    <div className="ms" onClick={() => history.back()} role="status">
      <div className="ms-in">
        <div className="ms-burst">{Array.from({ length: 8 }).map((_, i) => <i key={i} style={{ '--a': `${i * 45}deg` }} />)}</div>
        <b className="num ms-n">{days}</b>
        <div className="ms-h">day streak</div>
        <p className="hint">{days >= 30 ? 'This is a habit now.' : days >= 7 ? 'A full week. Keep the same rhythm.' : 'Good start. Next stop: ' + nextMilestone(days) + '.'}</p>
      </div>
    </div>,
    document.body
  )
}
