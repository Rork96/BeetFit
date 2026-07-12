import React, { useState } from 'react'
import Avatar from './Avatar.jsx'
import { bmi, bmiCategory, bmr, tdee, macros } from '../lib/calories.js'

function WeightChart({ log, targetKg }) {
  if (log.length < 2) return <p className="hint">Log more weigh-ins to see the chart.</p>
  const w = 320, h = 110, pad = 6
  const kgs = log.map(e => e.kg).concat(targetKg)
  const min = Math.min(...kgs) - 1, max = Math.max(...kgs) + 1
  const x = i => pad + (i / (log.length - 1)) * (w - pad * 2)
  const y = kg => h - pad - ((kg - min) / (max - min)) * (h - pad * 2)
  const points = log.map((e, i) => `${x(i)},${y(e.kg)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="weight-chart">
      <line x1={pad} x2={w - pad} y1={y(targetKg)} y2={y(targetKg)}
        stroke="var(--ok)" strokeDasharray="4 4" strokeWidth="1" />
      <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="2" />
      {log.map((e, i) => <circle key={i} cx={x(i)} cy={y(e.kg)} r="3" fill="var(--accent)" />)}
    </svg>
  )
}

export default function ProfileTab({ state, update }) {
  const { profile, weightLog } = state
  const [newKg, setNewKg] = useState('')
  const current = weightLog[weightLog.length - 1].kg
  const currentBmi = bmi({ heightCm: profile.heightCm, weightKg: current })
  const targetBmi = bmi({ heightCm: profile.heightCm, weightKg: profile.targetKg })
  const m = macros({ ...profile, weightKg: current })
  const start = weightLog[0].kg
  const total = Math.abs(profile.targetKg - start)
  const done = Math.abs(current - start)
  const pct = total === 0 ? 100 : Math.min(100, Math.round((done / total) * 100))

  const logWeight = () => {
    const kg = +newKg
    if (!kg || kg < 35 || kg > 250) return
    const today = new Date().toISOString().slice(0, 10)
    const log = weightLog.filter(e => e.date !== today).concat({ date: today, kg })
    update({ weightLog: log, profile: { ...profile, weightKg: kg } })
    setNewKg('')
  }

  return (
    <div className="page">
      <h1>Profile</h1>

      <div className="card">
        <Avatar bmiValue={currentBmi} ghostBmi={targetBmi} />
        <p className="hint" style={{ textAlign: 'center' }}>
          Blue — you now ({current} kg, BMI {currentBmi} · {bmiCategory(currentBmi)}).
          Green outline — target ({profile.targetKg} kg).
        </p>
        <div className="progressbar"><div style={{ width: `${pct}%` }} /></div>
        <p className="hint" style={{ textAlign: 'center' }}>{pct}% to target</p>
      </div>

      <div className="card">
        <h3>Log today's weight</h3>
        <div className="row">
          <input type="number" placeholder="kg" value={newKg} onChange={e => setNewKg(e.target.value)} />
          <button className="btn small" onClick={logWeight}>Save</button>
        </div>
        <WeightChart log={weightLog} targetKg={profile.targetKg} />
      </div>

      <div className="card">
        <h3>Daily targets</h3>
        <div className="grid4">
          <div className="stat"><div className="v">{m.kcal}</div><div className="l">kcal</div></div>
          <div className="stat"><div className="v">{m.protein}g</div><div className="l">protein</div></div>
          <div className="stat"><div className="v">{m.fat}g</div><div className="l">fat</div></div>
          <div className="stat"><div className="v">{m.carbs}g</div><div className="l">carbs</div></div>
        </div>
        <p className="hint">BMR {bmr({ ...profile, weightKg: current })} kcal · TDEE {tdee({ ...profile, weightKg: current })} kcal</p>
      </div>

      <button className="btn danger" onClick={() => {
        if (confirm('Reset profile and all data?')) {
          localStorage.clear()
          location.reload()
        }
      }}>Reset profile</button>
    </div>
  )
}
