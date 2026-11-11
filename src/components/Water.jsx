import React from 'react'
import { dayKey, addDays, waterOf, targets, fmtWater, glassMl } from '../lib/day.js'
import { useBackClose } from '../lib/hooks.js'
import { haptic } from '../lib/platform.js'
import Ic from './Icons.jsx'

// Last 7 days of water, with today editable. Opens from the Water card on Today.
export function WaterSheet({ state, onSet, onClose }) {
  useBackClose(true, onClose)
  const today = dayKey()
  const goal = targets(state).water
  const days = Array.from({ length: 7 }, (_, i) => { const k = addDays(today, i - 6); return { k, n: waterOf(state, k) } })
  const top = Math.max(goal, ...days.map(d => d.n), 1)
  const avg = days.reduce((a, d) => a + d.n, 0) / 7
  const hit = days.filter(d => d.n >= goal).length
  const now = days[6].n
  const dow = k => new Date(k + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2)
  return (
    <>
      <div className="sheet-back" onClick={() => history.back()} />
      <div className="sheet wt-sheet">
        <span className="label">Water</span>
        <h2><span className="num">{fmtWater(now, state)}</span> <small>of {fmtWater(goal, state)}</small></h2>
        <div className="wt-step">
          <button onClick={() => { haptic(); onSet(Math.max(0, now - 1)) }} disabled={!now} aria-label="Remove a glass">−</button>
          <span className="num">{now}<small>/ {goal} glasses · {fmtWater(1, state)} each</small></span>
          <button className="add" onClick={() => { haptic(); onSet(now + 1) }} aria-label="Add a glass">+</button>
        </div>
        <div className="wt-quick">
          <button onClick={() => { haptic(); onSet(now + 2) }}>+2 glasses</button>
          <button onClick={() => { haptic(); onSet(Math.max(now, goal)) }} disabled={now >= goal}>Fill to goal</button>
        </div>
        <div className="wt-bars" role="img" aria-label="Glasses of water, last 7 days">
          {days.map((d, i) => (
            <div key={d.k} className={'wt-col' + (i === 6 ? ' today' : '') + (d.n >= goal ? ' hit' : '')}>
              <span className="num">{d.n || ''}</span>
              <i style={{ height: `${Math.max(d.n ? 6 : 2, (d.n / top) * 100)}%` }} />
              <em>{i === 6 ? 'Today' : dow(d.k)}</em>
            </div>
          ))}
        </div>
        <p className="td-small">Goal hit {hit} of 7 days · average {fmtWater(Math.round(avg * 10) / 10, state)} a day. Change goal or glass size in Settings → Food &amp; water.</p>
        <button className="btn secondary" onClick={() => history.back()}>Close</button>
      </div>
    </>
  )
}
