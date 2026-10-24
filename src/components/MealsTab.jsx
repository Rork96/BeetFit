import React, { useState } from 'react'
import { generateDayPlan, swapMeal } from '../data/meals.js'
import { targetCalories } from '../lib/calories.js'
import FoodCamera from '../camera/FoodCamera.jsx'
import { haptic } from '../lib/tg.js'

const slotByHour = () => { const h = new Date().getHours(); return h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 20 ? 'dinner' : 'snack' }

export default function MealsTab({ state, update }) {
  const { profile, mealPlan } = state
  const daily = targetCalories(profile)
  const today = new Date().toISOString().slice(0, 10)
  const [cam, setCam] = useState(null) // 'barcode' | 'snap'
  const [toast, setToast] = useState(null)

  const plan = mealPlan?.date === today ? mealPlan.items : null
  const logged = state.foodLog?.[today] || []

  const regenerate = () => { haptic(); update({ mealPlan: { date: today, items: generateDayPlan(daily) } }) }
  const swap = i => { haptic(); update({ mealPlan: { date: today, items: swapMeal(plan, i, daily) } }) }

  const addFoods = items => {
    const slot = slotByHour()
    update(prev => {
      const fl = prev.foodLog || {}
      const day = fl[today] || []
      return { foodLog: { ...fl, [today]: [...day, ...items.map(x => ({ ...x, slot, at: Date.now() }))] } }
    })
    setCam(null)
    setToast(`${items.length === 1 ? items[0].name.split(' · ')[0] : items.length + ' items'} added to ${slot}`)
    setTimeout(() => setToast(null), 2200)
  }
  const removeFood = at => { haptic(); update(prev => ({ foodLog: { ...prev.foodLog, [today]: (prev.foodLog?.[today] || []).filter(x => x.at !== at) } })) }

  const sum = (arr, fk) => arr.reduce((a, m) => ({ kcal: a.kcal + m.kcal, p: a.p + m.p, f: a.f + (m[fk] ?? 0), c: a.c + m.c }), { kcal: 0, p: 0, f: 0, c: 0 })
  const planT = plan ? sum(plan, 'f_') : { kcal: 0, p: 0, f: 0, c: 0 }
  const logT = sum(logged, 'f')
  const totals = { kcal: planT.kcal + logT.kcal, p: Math.round(planT.p + logT.p), f: Math.round(planT.f + logT.f), c: Math.round(planT.c + logT.c) }
  const pct = Math.round((totals.kcal / daily) * 100)

  if (cam) return <FoodCamera initialMode={cam} slotLabel={slotByHour()} onAdd={addFoods} onClose={() => setCam(null)} />

  return (
    <div className="page">
      <div className="row">
        <div className="hero"><span className="glow" /><h1>Meals</h1></div>
        {plan && <button className="btn small secondary" onClick={regenerate}>↻ New plan</button>}
      </div>
      <p className="hint">Target <span className="num">{daily}</span> kcal/day. Swap any meal you don't like.</p>

      <div className="grid2">
        <button className="btn secondary" onClick={() => { haptic(); setCam('barcode') }}>▥ Scan barcode</button>
        <button className="btn secondary" onClick={() => { haptic(); setCam('snap') }}>◰ Snap meal</button>
      </div>

      {!plan && <button className="btn" onClick={regenerate}>Generate today's plan</button>}

      <div className="stk" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {plan && plan.map((m, i) => (
          <div className="card" key={m.name + i}>
            <span className="slot-tag">{m.slot}</span>
            <div className="meal">
              <div>
                <h3>{m.name}</h3>
                <div className="macros num">
                  {m.kcal} kcal · P {m.p}g · F {m.f_}g · C {m.c}g
                  {m.factor !== 1 && ` · ×${m.factor}`}
                </div>
              </div>
              <button className="btn small secondary" onClick={() => swap(i)}>Swap</button>
            </div>
          </div>
        ))}
      </div>

      {logged.length > 0 && (
        <div className="card">
          <span className="label">Logged today</span>
          {logged.map(x => (
            <div className="meal" key={x.at}>
              <div>
                <div style={{ fontWeight: 600 }}>{x.name}</div>
                <div className="macros num">{x.grams} g · {x.kcal} kcal · P {x.p} · C {x.c} · F {x.f} · {x.slot}{x.source === 'snap' ? ' · photo' : ''}</div>
              </div>
              <button className="btn small secondary" onClick={() => removeFood(x.at)} aria-label={`Remove ${x.name}`}>×</button>
            </div>
          ))}
        </div>
      )}

      {(plan || logged.length > 0) && (
        <div className="card">
          <span className="label">Day total</span>
          <div className="grid4">
            <div className="stat"><div className="v">{totals.kcal}</div><div className="l">kcal</div></div>
            <div className="stat"><div className="v">{totals.p}g</div><div className="l">protein</div></div>
            <div className="stat"><div className="v">{totals.f}g</div><div className="l">fat</div></div>
            <div className="stat"><div className="v">{totals.c}g</div><div className="l">carbs</div></div>
          </div>
          <div className="progressbar"><div style={{ width: `${Math.min(100, pct)}%`, background: pct > 110 ? 'var(--warn)' : undefined }} /></div>
          <p className="hint"><span className="num">{pct}%</span> of daily target</p>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
