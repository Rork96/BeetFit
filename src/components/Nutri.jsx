import React from 'react'
import Ic from './Icons.jsx'
import './nutri.css'

// Nutrition visuals shared by the scanner, search and the food log.
// Colours match the Today bars: protein lime, carbs violet, fat water-blue.
export const MACRO = [
  { k: 'p', icon: 'protein', label: 'Protein', color: 'var(--accent)', kcal: 4 },
  { k: 'c', icon: 'carbs', label: 'Carbs', color: 'var(--data-2)', kcal: 4 },
  { k: 'f', icon: 'fat', label: 'Fat', color: 'var(--water)', kcal: 9 },
]
const r1 = n => Math.round((+n || 0) * 10) / 10

// Donut: each arc is that macro's share of the calories; total kcal in the middle.
export function MacroRing({ kcal, p, c, f, size = 96, label = 'kcal' }) {
  const v = { p: +p || 0, c: +c || 0, f: +f || 0 }
  const parts = MACRO.map(m => ({ ...m, e: v[m.k] * m.kcal }))
  const sum = parts.reduce((a, x) => a + x.e, 0)
  const R = 40, C = 2 * Math.PI * R, gap = sum ? 2.2 : 0
  let at = 0
  return (
    <div className="nu-ring" style={{ width: size, height: size }} role="img"
      aria-label={`${kcal} kcal: protein ${r1(v.p)} g, carbs ${r1(v.c)} g, fat ${r1(v.f)} g`}>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <circle cx="50" cy="50" r={R} className="nu-track" />
        {sum > 0 && parts.map(x => {
          const len = Math.max(0, (x.e / sum) * C - gap)
          const el = <circle key={x.k} cx="50" cy="50" r={R} className="nu-arc" stroke={x.color}
            strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-at} />
          at += (x.e / sum) * C
          return el
        })}
      </svg>
      <div className="nu-mid"><b className="num">{kcal}</b><span>{label}</span></div>
    </div>
  )
}

// Thin split bar of the same three shares.
export function MacroBar({ p, c, f, w = 64 }) {
  const e = MACRO.map(m => ({ ...m, e: (+({ p, c, f })[m.k] || 0) * m.kcal }))
  const sum = e.reduce((a, x) => a + x.e, 0) || 1
  return <span className="nu-bar" style={{ width: w }} aria-hidden="true">{e.map(x => <i key={x.k} style={{ flexGrow: x.e / sum, background: x.color }} />)}</span>
}

// Icon + grams for each macro, coloured. `size` sm for list rows.
export function MacroChips({ p, c, f, sm }) {
  const v = { p, c, f }
  return (
    <span className={'nu-chips' + (sm ? ' sm' : '')} aria-label={MACRO.map(m => `${m.label} ${r1(v[m.k])} g`).join(', ')}>
      {MACRO.map(m => <span key={m.k} style={{ color: m.color }}><Ic n={m.icon} className="solid" /><b className="num">{r1(v[m.k])}</b></span>)}
    </span>
  )
}

// Four tiles: kcal + the three macros, icon-led.
export function MacroTiles({ x }) {
  return (
    <div className="nu-tiles">
      <div aria-label={`${x.kcal} kcal`}><Ic n="flame" className="solid" /><b className="num">{x.kcal}</b><small>kcal</small></div>
      {MACRO.map(m => (
        <div key={m.k} aria-label={`${m.label} ${r1(x[m.k])} g`} style={{ '--c': m.color }}><Ic n={m.icon} className="solid" /><b className="num">{r1(x[m.k])}</b><small>g</small></div>
      ))}
    </div>
  )
}

// Likely range as a bar with the estimate marked.
export function KcalRange({ lo, hi, at }) {
  const pos = hi > lo ? Math.min(100, Math.max(0, ((at - lo) / (hi - lo)) * 100)) : 50
  return (
    <div className="nu-range" aria-label={`Likely ${lo} to ${hi} kcal`}>
      <div className="nu-range-t"><i style={{ left: `${pos}%` }} /></div>
      <div className="nu-range-l num"><span>{lo}</span><span>likely range</span><span>{hi}</span></div>
    </div>
  )
}
