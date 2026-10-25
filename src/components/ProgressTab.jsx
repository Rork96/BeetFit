import React, { useMemo, useState } from 'react'
import BodyFigure from './BodyFigure.jsx'
import { bmi, bmiCategory, macros, bmr, tdee } from '../lib/calories.js'
import { dayKey, weightSeries, weeklyRate, monthGrid, KG_TO_LB, currentWeight } from '../lib/day.js'
import { haptic, hapticSuccess } from '../lib/platform.js'
import './progress.css'

const RANGES = [['2W', 14], ['1M', 30], ['3M', 90], ['6M', 180]]
const MEAS = [['waist', 'Waist'], ['chest', 'Chest'], ['hips', 'Hips'], ['arm', 'Arm']]
const MOODS = ['awful', 'low', 'ok', 'good', 'great']

export default function ProgressTab({ state, update, openCalendar }) {
  const { profile } = state
  const units = state.settings?.units || 'kg'
  const lb = units === 'lb'
  const toU = kg => (lb ? kg * KG_TO_LB : kg)
  const today = dayKey()
  const log = state.weightLog || []
  const start = log[0]?.kg ?? profile.weightKg
  const now = currentWeight(state)
  const [entry, setEntry] = useState(+toU(now).toFixed(1))
  const [range, setRange] = useState(30)
  const [meas, setMeas] = useState('waist')
  const [cal, setCal] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })

  const total = Math.abs(profile.targetKg - start)
  const pct = total === 0 ? 100 : Math.max(0, Math.min(100, Math.round((Math.abs(now - start) / total) * 100) * Math.sign((start - now) * (start - profile.targetKg) || 1)))
  const rate = weeklyRate(state, 21)
  const curBmi = bmi({ heightCm: profile.heightCm, weightKg: now })
  const m = macros({ ...profile, weightKg: now })

  const logWeight = () => {
    const kg = lb ? Math.round((entry / KG_TO_LB) * 10) / 10 : entry
    if (!kg || kg < 35 || kg > 250) return
    hapticSuccess()
    update(prev => {
      const wl = (prev.weightLog || []).filter(e => e.date !== today).concat({ date: today, kg })
      return { weightLog: wl, profile: { ...prev.profile, weightKg: kg } }
    })
  }

  const ci = state.checkins?.[today] || {}
  const setCi = patch => { haptic(); update(prev => ({ checkins: { ...(prev.checkins || {}), [today]: { ...(prev.checkins?.[today] || {}), ...patch } } })) }

  const mlog = (state.measurements || []).filter(x => x[meas] != null)
  const [mEntry, setMEntry] = useState('')
  const saveMeas = () => {
    const v = +mEntry
    if (!v || v < 10 || v > 250) return
    hapticSuccess()
    update(prev => {
      const rows = (prev.measurements || []).filter(r => r.date !== today)
      const cur = (prev.measurements || []).find(r => r.date === today) || { date: today }
      return { measurements: [...rows, { ...cur, [meas]: v }].sort((a, b) => a.date.localeCompare(b.date)) }
    })
    setMEntry('')
  }

  return (
    <div className="page">
      <div className="hero"><span className="glow" /><h1>Progress</h1></div>

      <div className="card pg-hero">
        <BodyFigure sex={profile.sex} heightCm={profile.heightCm} startKg={start} currentKg={now} targetKg={profile.targetKg} goal={profile.goal} height={280} />
        <div className="bf-legend"><span><i className="st" />start</span><span><i className="now" />now</span><span><i className="tgt" />target</span></div>
        <div className="pg-kpis">
          <div><b className="num">{toU(now).toFixed(1)}</b><span>{units} now</span></div>
          <div><b className="num">{toU(Math.abs(now - profile.targetKg)).toFixed(1)}</b><span>{units} to go</span></div>
          <div><b className="num">{rate == null ? '—' : `${rate > 0 ? '+' : '−'}${toU(Math.abs(rate)).toFixed(2)}`}</b><span>{units}/week</span></div>
        </div>
        <div className="progressbar"><div style={{ width: `${Math.max(0, pct)}%` }} /></div>
        <p className="hint num" style={{ textAlign: 'center' }}>{Math.max(0, pct)}% to target · BMI {curBmi} · {bmiCategory(curBmi)}</p>
      </div>

      {/* Weight */}
      <div className="card">
        <div className="row"><span className="label">Weight</span>
          <div className="seg">{RANGES.map(([l, d]) => <button key={l} className={range === d ? 'on' : ''} onClick={() => { haptic(); setRange(d) }}>{l}</button>)}</div>
        </div>
        <WeightChart series={weightSeries(state, range)} target={profile.targetKg} toU={toU} key={range} />
        <div className="pg-log">
          <div className="ss-mini">
            <button onClick={() => { haptic(); setEntry(v => +(v - 0.1).toFixed(1)) }} aria-label="Less">−</button>
            <span className="num">{entry.toFixed(1)}<small>{units}</small></span>
            <button onClick={() => { haptic(); setEntry(v => +(v + 0.1).toFixed(1)) }} aria-label="More">+</button>
          </div>
          <button className="btn small" onClick={logWeight}>{log.some(e => e.date === today) ? 'Update today' : 'Log today'}</button>
        </div>
        <p className="td-small">The thick line is your 7-day average — trust it over any single morning.</p>
      </div>

      {/* Check-in */}
      <div className="card">
        <div className="row"><span className="label">Today's check-in</span>{ci.sleep != null && ci.mood != null && <span className="ex-cam">✓ saved</span>}</div>
        <div className="set-row">
          <span className="set-l">Sleep</span>
          <div className="ss-mini">
            <button onClick={() => setCi({ sleep: Math.max(0, (ci.sleep ?? state.intake?.sleepBase ?? 7) - 0.5) })} aria-label="Less sleep">−</button>
            <span className="num">{(ci.sleep ?? state.intake?.sleepBase ?? 7).toFixed(1)}<small>h</small></span>
            <button onClick={() => setCi({ sleep: Math.min(14, (ci.sleep ?? state.intake?.sleepBase ?? 7) + 0.5) })} aria-label="More sleep">+</button>
          </div>
        </div>
        <Scale label="Mood" value={ci.mood} words={MOODS} onPick={v => setCi({ mood: v })} />
        <Scale label="Energy" value={ci.energy} words={['empty', 'low', 'ok', 'good', 'high']} onPick={v => setCi({ energy: v })} />
        <Scale label="Hunger" value={ci.hunger} words={['none', 'low', 'ok', 'high', 'starving']} onPick={v => setCi({ hunger: v })} />
      </div>

      {/* Measurements */}
      <div className="card">
        <div className="row"><span className="label">Measurements</span></div>
        <div className="chips">{MEAS.map(([k, l]) => <button key={k} className={'chip' + (meas === k ? ' on' : '')} onClick={() => { haptic(); setMeas(k) }}>{l}</button>)}</div>
        {mlog.length >= 2 ? <MiniTrend points={mlog.map(r => r[meas])} /> : <p className="hint">Log {MEAS.find(x => x[0] === meas)[1].toLowerCase()} weekly — it moves when the scale doesn't.</p>}
        {mlog.length > 0 && <p className="td-small num">Latest {mlog[mlog.length - 1][meas]} cm{mlog.length > 1 ? ` · ${(mlog[mlog.length - 1][meas] - mlog[0][meas]).toFixed(1)} cm since ${mlog[0].date.slice(5)}` : ''}</p>}
        <div className="pg-log">
          <input type="number" inputMode="decimal" placeholder={`${MEAS.find(x => x[0] === meas)[1]}, cm`} value={mEntry} onChange={e => setMEntry(e.target.value)} />
          <button className="btn small" onClick={saveMeas}>Save</button>
        </div>
      </div>

      {/* Calendar */}
      <div className="card">
        <div className="row">
          <button className="ss-more" onClick={() => setCal(c => (c.m ? { y: c.y, m: c.m - 1 } : { y: c.y - 1, m: 11 }))} aria-label="Previous month">‹</button>
          <span className="label">{new Date(cal.y, cal.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
          <button className="ss-more" onClick={() => setCal(c => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }))} aria-label="Next month">›</button>
        </div>
        <div className="pg-cal" key={`${cal.y}-${cal.m}`}>
          {'MTWTFSS'.split('').map((d, i) => <span key={i} className="pg-dow">{d}</span>)}
          {monthGrid(state, cal.y, cal.m).map((c, i) => c
            ? <button key={c.key} className={`pg-d s${c.score ?? 'f'}${c.today ? ' today' : ''}`} onClick={() => { haptic(); openCalendar?.(c.key) }}><span className="num">{c.d}</span></button>
            : <span key={'e' + i} />)}
        </div>
        <div className="row">
          <p className="td-small" style={{ margin: 0 }}>Fill = daily tasks done. Tap a day for details.</p>
          <button className="btn small secondary" onClick={() => { haptic(); openCalendar?.(null) }}>Calendar</button>
        </div>
      </div>

      <div className="card">
        <span className="label">Daily targets</span>
        <div className="grid4">
          <div className="stat"><div className="v">{m.kcal}</div><div className="l">kcal</div></div>
          <div className="stat"><div className="v">{m.protein}g</div><div className="l">protein</div></div>
          <div className="stat"><div className="v">{m.fat}g</div><div className="l">fat</div></div>
          <div className="stat"><div className="v">{m.carbs}g</div><div className="l">carbs</div></div>
        </div>
        <p className="hint num">BMR {bmr({ ...profile, weightKg: now })} kcal · TDEE {tdee({ ...profile, weightKg: now })} kcal</p>
      </div>

    </div>
  )
}

function Scale({ label, value, words, onPick }) {
  return (
    <div className="set-row">
      <span className="set-l">{label}</span>
      <div className="pg-scale">
        {words.map((w, i) => <button key={w} className={value === i + 1 ? 'on' : ''} onClick={() => onPick(i + 1)} aria-label={`${label}: ${w}`} title={w}><i style={{ opacity: 0.25 + i * 0.18 }} /></button>)}
        <span className="td-small">{value ? words[value - 1] : ''}</span>
      </div>
    </div>
  )
}

function WeightChart({ series, target, toU }) {
  const pts = series.filter(p => p.kg != null || p.avg != null)
  if (pts.length < 2) return <p className="hint">Log your weight a few mornings in a row to see the trend.</p>
  const w = 340, h = 150, px = 8, py = 12
  const vals = series.flatMap(p => [p.kg, p.avg]).filter(v => v != null).concat(target)
  const min = Math.min(...vals) - 0.5, max = Math.max(...vals) + 0.5
  const x = i => px + (i / (series.length - 1)) * (w - px * 2)
  const y = v => h - py - ((v - min) / (max - min)) * (h - py * 2)
  const avgPath = series.map((p, i) => (p.avg == null ? null : `${x(i)},${y(p.avg)}`)).filter(Boolean)
  const last = [...series].reverse().find(p => p.avg != null)
  const li = series.indexOf(last)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="pg-chart" role="img" aria-label="Weight trend">
      <line x1={px} x2={w - px} y1={y(target)} y2={y(target)} stroke="var(--accent)" strokeDasharray="4 5" strokeWidth="1" opacity=".6" />
      <text x={w - px} y={y(target) - 5} textAnchor="end" className="pg-ax">target {toU(target).toFixed(1)}</text>
      {series.map((p, i) => p.kg != null && <rect key={i} x={x(i) - 2.5} y={y(p.kg) - 2.5} width="5" height="5" fill="rgba(255,255,255,.35)" />)}
      <polyline points={avgPath.join(' ')} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" className="pg-line" />
      {last && <>
        <rect x={x(li) - 4} y={y(last.avg) - 4} width="8" height="8" fill="var(--accent)" />
        <text x={x(li) - 8} y={y(last.avg) - 9} textAnchor="end" className="pg-ax strong">{toU(last.avg).toFixed(1)}</text>
      </>}
      <text x={px} y={h - 1} className="pg-ax">{series[0].key.slice(5)}</text>
      <text x={w - px} y={h - 1} textAnchor="end" className="pg-ax">today</text>
    </svg>
  )
}

function MiniTrend({ points }) {
  const w = 300, h = 60
  const min = Math.min(...points) - 1, max = Math.max(...points) + 1
  const d = points.map((v, i) => `${(i / (points.length - 1)) * w},${h - ((v - min) / (max - min)) * h}`).join(' ')
  return <svg viewBox={`0 -4 ${w} ${h + 8}`} className="pg-mini"><polyline points={d} fill="none" stroke="var(--data-2)" strokeWidth="2.5" className="pg-line" /></svg>
}
