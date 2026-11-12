import React, { useState } from 'react'
import Ic from './Icons.jsx'
import { BeetEmpty } from './BeetMascot.jsx'
import { historyDays, reloggable } from '../lib/foods.js'
import { addDays } from '../lib/day.js'
import { haptic, hapticSuccess } from '../lib/platform.js'
import './foodhistory.css'

const label = (key, today) => {
  if (key === addDays(today, -1)) return 'Yesterday'
  return new Date(key + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
const qty = x => (x.source === 'plan' ? '1 serving' : x.source === 'quick' ? 'quick add' : `${x.grams} g`)

// Everything you logged on earlier days, newest first. Tap a day to see it, re-log a meal or a whole day to today.
export default function FoodHistory({ state, today, onClose, onAdd }) {
  const days = historyDays(state, today, 30)
  const [open, setOpen] = useState(days[0]?.key || null)
  const [done, setDone] = useState({}) // 'date|slot' → true

  const relog = (d, slot) => {
    hapticSuccess()
    const items = (slot ? d.items.filter(x => x.slot === slot) : d.items)
    // keep each item in the slot it was eaten in
    const bySlot = new Map()
    for (const x of items) bySlot.set(x.slot, [...(bySlot.get(x.slot) || []), reloggable(x)])
    for (const [sl, its] of bySlot) onAdd(its, { slot: sl, quiet: true })
    setDone(s => ({ ...s, [d.key + '|' + (slot || '*')]: true }))
  }

  return (
    <div className="page fh">
      <div className="row">
        <div className="hero"><span className="glow" /><h1>Food history</h1></div>
        <button className="btn small secondary" onClick={() => { haptic(); onClose() }}>Back</button>
      </div>

      {days.length === 0 ? (
        <div className="card"><BeetEmpty mood="think" title="No past days yet" hint="Log a meal today. Tomorrow it shows up here." /></div>
      ) : (
        days.map(d => {
          const isOpen = open === d.key
          return (
            <div className="card fh-day" key={d.key}>
              <button className="fh-head" onClick={() => { haptic(); setOpen(isOpen ? null : d.key) }} aria-expanded={isOpen}>
                <span><b>{label(d.key, today)}</b><span className="td-small"> · {d.items.length} item{d.items.length === 1 ? '' : 's'}</span></span>
                <span className="num fh-k">{d.kcal}<small>kcal</small></span>
              </button>
              <div className="fh-m num" aria-label={`Protein ${d.p} g, carbs ${d.c} g, fat ${d.f} g`}>
                <span className="fh-split" aria-hidden="true">{(() => { const k = d.p * 4 + d.c * 4 + d.f * 9 || 1; return <><i style={{ flexGrow: d.p * 4 / k, background: 'var(--accent)' }} /><i style={{ flexGrow: d.c * 4 / k, background: 'var(--data-2)' }} /><i style={{ flexGrow: d.f * 9 / k, background: 'var(--water)' }} /></> })()}</span>
                <span style={{ color: 'var(--accent)' }}><Ic n="protein" className="solid" />{d.p}</span><span style={{ color: 'var(--data-2)' }}><Ic n="carbs" className="solid" />{d.c}</span><span style={{ color: 'var(--water)' }}><Ic n="fat" className="solid" />{d.f}</span>
              </div>
              {isOpen && (
                <div className="fh-body">
                  {d.slots.map(s => (
                    <div className="fh-slot" key={s.slot}>
                      <div className="ml-h"><span>{s.slot}</span><span className="num">{s.kcal} kcal</span></div>
                      {s.items.map((x, i) => (
                        <div className="fh-item" key={x.at || i}>
                          <span className="fh-n">{x.name.split(' · ')[0]}</span>
                          <span className="td-small num">{qty(x)} · {x.kcal}</span>
                        </div>
                      ))}
                      <button className="btn small secondary" disabled={done[d.key + '|' + s.slot] || done[d.key + '|*']} onClick={() => relog(d, s.slot)}>
                        {done[d.key + '|' + s.slot] || done[d.key + '|*'] ? 'Added to today ✓' : `Log this ${s.slot} today`}
                      </button>
                    </div>
                  ))}
                  <button className="btn small" disabled={done[d.key + '|*']} onClick={() => relog(d, null)}>
                    {done[d.key + '|*'] ? 'Added to today ✓' : 'Log the whole day today'}
                  </button>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
