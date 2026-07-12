import React, { useState } from 'react'
import { ACTIVITY_LEVELS, GOALS, macros, bmr, tdee } from '../lib/calories.js'

export default function Onboarding({ onDone }) {
  const [form, setForm] = useState({
    sex: 'male', age: 25, heightCm: 178, weightKg: 80, targetKg: 75,
    activity: 'moderate', goal: 'lose'
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const num = (k, v) => set(k, v === '' ? '' : +v)

  const valid = form.age >= 14 && form.age <= 100 &&
    form.heightCm >= 120 && form.heightCm <= 230 &&
    form.weightKg >= 35 && form.weightKg <= 250 &&
    form.targetKg >= 35 && form.targetKg <= 250

  const preview = valid ? macros(form) : null

  return (
    <div className="page">
      <h1>Set up your profile</h1>
      <p className="hint">Used to calculate calories, meals and your training program.</p>

      <div className="card">
        <div className="grid2">
          <div>
            <label>Sex</label>
            <select value={form.sex} onChange={e => set('sex', e.target.value)}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div>
            <label>Age</label>
            <input type="number" value={form.age} onChange={e => num('age', e.target.value)} />
          </div>
          <div>
            <label>Height, cm</label>
            <input type="number" value={form.heightCm} onChange={e => num('heightCm', e.target.value)} />
          </div>
          <div>
            <label>Weight, kg</label>
            <input type="number" value={form.weightKg} onChange={e => num('weightKg', e.target.value)} />
          </div>
          <div>
            <label>Target weight, kg</label>
            <input type="number" value={form.targetKg} onChange={e => num('targetKg', e.target.value)} />
          </div>
          <div>
            <label>Goal</label>
            <select value={form.goal} onChange={e => set('goal', e.target.value)}>
              {GOALS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label>Activity level</label>
          <select value={form.activity} onChange={e => set('activity', e.target.value)}>
            {ACTIVITY_LEVELS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </div>
      </div>

      {preview && (
        <div className="card">
          <h3>Your numbers</h3>
          <div className="grid4">
            <div className="stat"><div className="v">{bmr(form)}</div><div className="l">BMR</div></div>
            <div className="stat"><div className="v">{tdee(form)}</div><div className="l">TDEE</div></div>
            <div className="stat"><div className="v">{preview.kcal}</div><div className="l">kcal/day</div></div>
            <div className="stat"><div className="v">{preview.protein}g</div><div className="l">protein</div></div>
          </div>
        </div>
      )}

      <button className="btn" disabled={!valid} onClick={() => onDone(form)}>Start</button>
    </div>
  )
}
