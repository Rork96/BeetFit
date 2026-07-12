import React from 'react'
import { generateDayPlan, swapMeal } from '../data/meals.js'
import { targetCalories } from '../lib/calories.js'

export default function MealsTab({ state, update }) {
  const { profile, mealPlan } = state
  const daily = targetCalories(profile)
  const today = new Date().toISOString().slice(0, 10)

  const plan = mealPlan?.date === today ? mealPlan.items : null

  const regenerate = () => update({ mealPlan: { date: today, items: generateDayPlan(daily) } })
  const swap = i => update({ mealPlan: { date: today, items: swapMeal(plan, i, daily) } })

  const totals = plan?.reduce(
    (a, m) => ({ kcal: a.kcal + m.kcal, p: a.p + m.p, f: a.f + m.f_, c: a.c + m.c }),
    { kcal: 0, p: 0, f: 0, c: 0 }
  )

  return (
    <div className="page">
      <div className="row">
        <h1>Meals</h1>
        {plan && <button className="btn small secondary" onClick={regenerate}>↻ New day plan</button>}
      </div>
      <p className="hint">Target: {daily} kcal/day. Swap any meal you don't like.</p>

      {!plan && <button className="btn" onClick={regenerate}>Generate today's plan</button>}

      {plan && plan.map((m, i) => (
        <div className="card" key={i}>
          <span className="slot-tag">{m.slot}</span>
          <div className="meal">
            <div>
              <h3>{m.name}</h3>
              <div className="macros">
                {m.kcal} kcal · P {m.p}g · F {m.f_}g · C {m.c}g
                {m.factor !== 1 && ` · portion ×${m.factor}`}
              </div>
            </div>
            <button className="btn small secondary" onClick={() => swap(i)}>Swap</button>
          </div>
        </div>
      ))}

      {totals && (
        <div className="card">
          <h3>Day total</h3>
          <div className="grid4">
            <div className="stat"><div className="v">{totals.kcal}</div><div className="l">kcal</div></div>
            <div className="stat"><div className="v">{totals.p}g</div><div className="l">protein</div></div>
            <div className="stat"><div className="v">{totals.f}g</div><div className="l">fat</div></div>
            <div className="stat"><div className="v">{totals.c}g</div><div className="l">carbs</div></div>
          </div>
          <div className="progressbar">
            <div style={{ width: `${Math.min(100, Math.round((totals.kcal / daily) * 100))}%` }} />
          </div>
          <p className="hint">{Math.round((totals.kcal / daily) * 100)}% of daily target</p>
        </div>
      )}
    </div>
  )
}
