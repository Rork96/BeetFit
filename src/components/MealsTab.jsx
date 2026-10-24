import React, { useEffect, useRef, useState } from 'react'
import { generateDayPlan, swapMeal } from '../data/meals.js'
import FoodCamera, { PortionCard, portion } from '../camera/FoodCamera.jsx'
import { searchFood } from '../lib/api.js'
import { dayKey, eaten, targets } from '../lib/day.js'
import { useBackClose } from '../lib/hooks.js'
import { haptic } from '../lib/platform.js'

const slotByHour = () => { const h = new Date().getHours(); return h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 20 ? 'dinner' : 'snack' }

export default function MealsTab({ state, update }) {
  const { mealPlan } = state
  const t = targets(state)
  const today = dayKey()
  const [cam, setCam] = useState(null) // 'barcode' | 'snap'
  const [toast, setToast] = useState(null)
  useBackClose(!!cam, () => setCam(null))

  const plan = mealPlan?.date === today ? mealPlan.items : null
  const logged = state.foodLog?.[today] || []
  const totals = eaten(state, today)
  const pct = Math.round((totals.kcal / t.kcal) * 100)

  const regenerate = () => { haptic(); update({ mealPlan: { date: today, items: generateDayPlan(t.kcal) } }) }
  const swap = i => { haptic(); update({ mealPlan: { date: today, items: swapMeal(plan, i, t.kcal) } }) }

  const addFoods = items => {
    const slot = slotByHour()
    update(prev => {
      const fl = prev.foodLog || {}
      const day = fl[today] || []
      return { foodLog: { ...fl, [today]: [...day, ...items.map((x, i) => ({ ...x, slot, at: Date.now() + i }))] } }
    })
    if (cam) history.back()
    setToast(`${items.length === 1 ? items[0].name.split(' · ')[0] : items.length + ' items'} added to ${slot}`)
    setTimeout(() => setToast(null), 2200)
  }
  const removeFood = at => { haptic(); update(prev => ({ foodLog: { ...prev.foodLog, [today]: (prev.foodLog?.[today] || []).filter(x => x.at !== at) } })) }

  if (cam) return <FoodCamera initialMode={cam} slotLabel={slotByHour()} onAdd={addFoods} onClose={() => history.back()} />

  return (
    <div className="page">
      <div className="row">
        <div className="hero"><span className="glow" /><h1>Food</h1></div>
        {plan && <button className="btn small secondary" onClick={regenerate}>↻ New plan</button>}
      </div>

      <div className="card">
        <div className="row"><span className="label">Today</span><span className="num td-small">{totals.kcal} / {t.kcal} kcal</span></div>
        <div className="progressbar"><div style={{ width: `${Math.min(100, pct)}%`, background: pct > 110 ? 'var(--warn)' : undefined }} /></div>
        <div className="grid4">
          <div className="stat"><div className="v">{Math.max(0, t.kcal - totals.kcal)}</div><div className="l">kcal left</div></div>
          <div className="stat"><div className="v">{totals.p}g</div><div className="l">protein</div></div>
          <div className="stat"><div className="v">{totals.c}g</div><div className="l">carbs</div></div>
          <div className="stat"><div className="v">{totals.f}g</div><div className="l">fat</div></div>
        </div>
      </div>

      <FoodSearch slotLabel={slotByHour()} onAdd={(item, g) => addFoods([portion(item, g)])} />

      <div className="grid2">
        <button className="btn secondary" onClick={() => { haptic(); setCam('barcode') }}>▥ Barcode</button>
        <button className="btn secondary" onClick={() => { haptic(); setCam('snap') }}>◰ Photo</button>
      </div>

      {logged.length > 0 && (
        <div className="card stk">
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

      {!plan && <button className="btn secondary" onClick={regenerate}>Suggest a meal plan for today</button>}
      <div className="stk" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {plan && plan.map((m, i) => (
          <div className="card" key={m.name + i}>
            <span className="slot-tag">{m.slot}</span>
            <div className="meal">
              <div>
                <h3>{m.name}</h3>
                <div className="macros num">{m.kcal} kcal · P {m.p}g · F {m.f_}g · C {m.c}g{m.factor !== 1 && ` · ×${m.factor}`}</div>
              </div>
              <button className="btn small secondary" onClick={() => swap(i)}>Swap</button>
            </div>
          </div>
        ))}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function FoodSearch({ onAdd, slotLabel }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState({ items: [], busy: false, error: null })
  const seq = useRef(0)
  const [open, setOpen] = useState(null) // key of the expanded result
  const inputRef = useRef(null)

  useEffect(() => {
    const query = q.trim()
    if (query.length < 2) { setRes({ items: [], busy: false, error: null }); return }
    const n = ++seq.current
    setRes(r => ({ ...r, busy: true }))
    const id = setTimeout(async () => {
      const r = await searchFood(query)
      if (n !== seq.current) return
      setRes({ items: r.items || [], busy: false, error: r.status && r.status !== 200 ? 'offline' : r.error || null })
    }, 350)
    return () => clearTimeout(id)
  }, [q])

  return (
    <div className="card">
      <div className="fs-input">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="13" height="13" /><path d="M14 14l7 7" /></svg>
        <input ref={inputRef} type="search" placeholder="Search food — e.g. greek yogurt" value={q} onChange={e => setQ(e.target.value)} enterKeyHint="search" />
      </div>
      {res.busy && <div className="fc-skel"><i /><i /></div>}
      {!res.busy && res.error && <p className="hint">Search needs the BeetFit server — it's offline right now. Scanning a barcode still works.</p>}
      {!res.busy && !res.error && q.trim().length >= 2 && res.items.length === 0 && <p className="hint">Nothing found. Try a simpler name, or scan the barcode.</p>}
      {res.items.length > 0 && (
        <div className="fs-results stk">
          {res.items.map(it => {
            const key = it.code + it.name
            return (
              <div key={key} className={'fs-row' + (open === key ? ' open' : '')}>
                <button className="fs-item" onClick={e => {
                  haptic()
                  inputRef.current?.blur() // drop the keyboard so the portion editor is visible
                  const row = e.currentTarget
                  setOpen(o => (o === key ? null : key))
                  setTimeout(() => row.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
                }}>
                  {it.image ? <img src={it.image} alt="" loading="lazy" /> : <span className="fc-ph" />}
                  <div><b>{it.name}</b><span className="num">{it.brand ? it.brand + ' · ' : ''}{it.per100.kcal} kcal / 100 g</span></div>
                  <span className="fs-src">{it.source === 'usda' ? 'USDA' : 'OFF'}</span>
                </button>
                {open === key && (
                  <div className="fs-inline">
                    <PortionCard item={it} slotLabel={slotLabel} onAdd={g => { onAdd(it, g); setOpen(null); setQ('') }} onRescan={() => setOpen(null)} backLabel="Cancel" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
