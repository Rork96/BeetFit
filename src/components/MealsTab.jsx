import React, { useEffect, useRef, useState } from 'react'
import { Stat } from './Icons.jsx'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { recentFoods, lastMeal, slotByHour, SLOTS, recentNames, historyDays } from '../lib/foods.js'
import { suggestMeals, suggestBudget } from '../data/meals.js'
import FoodHistory from './FoodHistory.jsx'
import FoodCamera, { PortionCard, portion } from '../camera/FoodCamera.jsx'
import { searchFood } from '../lib/api.js'
import { dayKey, eaten, targets, addDays, mondayOf } from '../lib/day.js'
import { useBackClose } from '../lib/hooks.js'
import { haptic, hapticSuccess } from '../lib/platform.js'


let atSeq = 0

export default function MealsTab({ state, update, onUpgrade }) {
  const { mealPlan } = state
  const t = targets(state)
  const today = dayKey()
  const [cam, setCam] = useState(null) // 'barcode' | 'snap'
  const [toast, setToast] = useState(null) // { text, undo? }
  const toastT = useRef(null)
  const say = (text, undo) => { clearTimeout(toastT.current); setToast({ text, undo }); toastT.current = setTimeout(() => setToast(null), undo ? 4000 : 2200) }
  const slot = slotByHour()
  const recent = recentFoods(state, today, 8)
  const again = lastMeal(state, today, slot)
  const loggedIn = it => (state.foodLog?.[today] || []).some(x => x.name === it.name && x.slot === slot)
  const [hist, setHist] = useState(false)
  const [sugSlot, setSugSlot] = useState(slot)
  useBackClose(!!cam, () => setCam(null))
  useBackClose(hist, () => setHist(false))

  // Suggestions are ideas, never counted as eaten until you tap "Log it".
  const ideas = mealPlan?.date === today && mealPlan.slot ? mealPlan : null
  const logged = state.foodLog?.[today] || []
  const totals = eaten(state, today)
  const pct = Math.round((totals.kcal / t.kcal) * 100)

  const budget = sl => suggestBudget(sl, t.kcal, totals.kcal)
  const suggest = (sl = sugSlot) => {
    haptic(); setSugSlot(sl)
    update({ mealPlan: { date: today, slot: sl, items: suggestMeals(sl, budget(sl), { exclude: [...recentNames(state, today), ...(ideas?.slot === sl ? ideas.items.map(x => x.name) : [])] }) } })
  }
  const swapIdea = i => {
    haptic()
    const [one] = suggestMeals(ideas.slot, budget(ideas.slot), { n: 1, exclude: [...recentNames(state, today), ...ideas.items.map(x => x.name)] })
    if (!one) return
    update({ mealPlan: { ...ideas, items: ideas.items.map((x, k) => (k === i ? one : x)) } })
  }
  const logIdea = m => {
    hapticSuccess()
    addFoods([{ name: m.name, grams: 0, kcal: m.kcal, p: m.p, c: m.c, f: m.f_, source: 'plan' }], { slot: m.slot })
    update(prev => (prev.mealPlan?.items ? { mealPlan: { ...prev.mealPlan, items: prev.mealPlan.items.filter(x => x.name !== m.name) } } : {}))
  }

  const addFoods = (items, { quiet, slot: forSlot } = {}) => {
    const sl = forSlot || slot
    const t0 = Math.max(Date.now(), atSeq + 1) // unique even when two logs land in the same millisecond
    atSeq = t0 + items.length
    const ats = items.map((_, i) => t0 + i)
    update(prev => {
      const fl = prev.foodLog || {}
      const day = fl[today] || []
      return { foodLog: { ...fl, [today]: [...day, ...items.map((x, i) => ({ ...x, slot: sl, at: ats[i] }))] } }
    })
    if (cam) history.back()
    if (!quiet) say(`${items.length === 1 ? items[0].name.split(' · ')[0] : items.length + ' items'} added to ${sl}`,
      () => update(prev => ({ foodLog: { ...prev.foodLog, [today]: (prev.foodLog?.[today] || []).filter(x => !ats.includes(x.at)) } })))
  }
  const removeFood = x => {
    haptic()
    update(prev => ({ foodLog: { ...prev.foodLog, [today]: (prev.foodLog?.[today] || []).filter(y => y.at !== x.at) } }))
    say(`Removed ${x.name.split(' · ')[0]}`, () => update(prev => ({ foodLog: { ...prev.foodLog, [today]: [...(prev.foodLog?.[today] || []), x].sort((a, b) => a.at - b.at) } })))
  }
  const quick = it => { hapticSuccess(); const { count, ...x } = it; addFoods([x]) }

  if (hist) return <FoodHistory state={state} today={today} onClose={() => history.back()} onAdd={(items, o) => { addFoods(items, o); }} />

  if (cam) return <FoodCamera initialMode={cam} slotLabel={slot} onAdd={addFoods} onClose={() => history.back()} onUpgrade={onUpgrade && (r => { history.back(); setTimeout(() => onUpgrade(r), 80) })} />

  return (
    <div className="page">
      <div className="row">
        <div className="hero"><span className="glow" /><h1>Food</h1></div>
        <button className="btn small secondary" onClick={() => { haptic(); setHist(true) }}>History</button>
      </div>

      <div className="card">
        <div className="row">
          <span className="label">Today{t.dayType && <span className={'td-dt ' + t.dayType}>{t.dayType === 'train' ? `Training day +${t.delta}` : `Rest day ${t.delta}`}</span>}</span>
          <span className="num td-small">{totals.kcal} / {t.kcal} kcal</span>
        </div>
        <div className="progressbar"><div style={{ width: `${Math.min(100, pct)}%`, background: pct > 110 ? 'var(--warn)' : undefined }} /></div>
        <div className="grid4">
          <Stat icon="flame" v={Math.max(0, t.kcal - totals.kcal)} label="kcal left" color="var(--text)" />
          <Stat icon="protein" v={totals.p} unit="g" label="Protein" color="var(--accent)" />
          <Stat icon="carbs" v={totals.c} unit="g" label="Carbs" color="var(--data-2)" />
          <Stat icon="fat" v={totals.f} unit="g" label="Fat" color="var(--water)" />
        </div>
        <WeekBars state={state} today={today} />
      </div>

      <Ideas slot={ideas?.slot || sugSlot} items={ideas?.items} budget={budget(ideas?.slot || sugSlot)} left={Math.max(0, t.kcal - totals.kcal)}
        onSlot={sl => (ideas ? suggest(sl) : setSugSlot(sl))} onSuggest={() => suggest()} onSwap={swapIdea} onLog={logIdea} />

      <Yesterday state={state} today={today} onOpen={() => { haptic(); setHist(true) }} />

      {(again || recent.length > 0) && (
        <div className="card mq">
          <div className="row"><span className="label">Quick add · {slot}</span>{recent.length > 0 && <span className="td-small">1 tap</span>}</div>
          {again && !again.items.every(loggedIn) && (
            <button className="mq-again" onClick={() => { hapticSuccess(); addFoods(again.items) }}>
              <span><b>Same {slot} as {again.date === addDays(today, -1) ? 'yesterday' : new Date(again.date + 'T12:00').toLocaleDateString('en-US', { weekday: 'short' })}</b>
                <span className="td-small">{again.items.map(x => x.name.split(' · ')[0]).join(', ')}</span></span>
              <span className="num mq-k">{again.kcal}<small>kcal</small></span>
            </button>
          )}
          {recent.length > 0 && (
            <div className="mq-chips">
              {recent.map(it => (
                <motion.button key={it.name} whileTap={{ scale: 0.94 }} className="mq-chip" onClick={() => quick(it)}>
                  <b>{it.name.split(' · ')[0]}</b><span className="num">{it.source === 'plan' ? '1 serving' : `${it.grams} g`} · {it.kcal}</span>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      )}

      <FoodSearch slotLabel={slot} onAdd={(item, g) => addFoods([portion(item, g)])} />

      <QuickKcal onAdd={x => { hapticSuccess(); addFoods([x]) }} />

      <div className="grid2">
        <button className="btn secondary" onClick={() => { haptic(); setCam('barcode') }}>▥ Barcode</button>
        <button className="btn secondary" onClick={() => { haptic(); setCam('snap') }}>◰ Photo</button>
      </div>

      {logged.length > 0 && (
        <div className="card ml">
          <span className="label">Logged today</span>
          {SLOTS.filter(sl => logged.some(x => x.slot === sl)).map(sl => {
            const items = logged.filter(x => x.slot === sl)
            return (
              <div key={sl} className="ml-slot">
                <div className="ml-h"><span>{sl}</span><span className="num">{Math.round(items.reduce((a, x) => a + x.kcal, 0))} kcal</span></div>
                <AnimatePresence initial={false}>
                  {items.map(x => (
                    <motion.div className="meal" key={x.at} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0, transition: { duration: 0.18 } }} transition={{ type: 'spring', stiffness: 420, damping: 34 }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{x.name}{x.est && <span className="ml-est">estimate</span>}</div>
                        <div className="macros num">{x.source === 'quick' ? `${x.kcal} kcal${x.p ? ` · P ${x.p}` : ''} · ballpark` : `${x.source === 'plan' ? '1 serving' : `${x.grams} g`} · ${x.kcal} kcal · P ${x.p} · C ${x.c} · F ${x.f}${x.source === 'snap' ? ' · photo' : ''}`}</div>
                      </div>
                      <button className="btn small secondary" onClick={() => removeFood(x)} aria-label={`Remove ${x.name}`}>×</button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div className="toast mt" key={toast.text} initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 36 }}>
            <span>{toast.text}</span>
            {toast.undo && <button onClick={() => { haptic(); toast.undo(); setToast(null) }}>Undo</button>}
          </motion.div>
        )}
      </AnimatePresence>
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
                <button className="fs-item" onClick={() => {
                  haptic()
                  inputRef.current?.blur() // drop the keyboard first so the dialog sits in the visible area
                  setOpen(key)
                }}>
                  {it.image ? <img src={it.image} alt="" loading="lazy" /> : <span className="fc-ph" />}
                  <div><b>{it.name}</b><span className="num">{it.brand ? it.brand + ' · ' : ''}{it.per100.kcal} kcal / 100 g</span></div>
                  <span className="fs-src">{it.source === 'usda' ? 'USDA' : 'OFF'}</span>
                </button>
                {open === key && (
                  <CenterDialog onClose={() => setOpen(null)}>
                    <PortionCard item={it} slotLabel={slotLabel} onAdd={g => { onAdd(it, g); setOpen(null); setQ('') }} onRescan={() => setOpen(null)} backLabel="Cancel" />
                  </CenterDialog>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Mon–Sun: what you ate against each day's target. The week matters more than any single day.
function WeekBars({ state, today }) {
  const mon = mondayOf(today)
  const days = Array.from({ length: 7 }, (_, i) => {
    const k = addDays(mon, i)
    return { k, future: k > today, e: k > today ? 0 : eaten(state, k).kcal, t: targets(state, k).kcal }
  })
  const past = days.filter(d => !d.future && (d.e > 0 || d.k === today))
  const eatenSum = past.reduce((a, d) => a + d.e, 0), targetSum = past.reduce((a, d) => a + d.t, 0)
  const max = Math.max(...days.map(d => Math.max(d.e, d.t)), 1)
  if (past.length < 2) return null
  return (
    <div className="wb">
      <div className="row"><span className="label">This week</span><span className="num td-small">{eatenSum.toLocaleString('en-US')} / {targetSum.toLocaleString('en-US')} kcal · {past.length} days</span></div>
      <div className="wb-bars" aria-hidden="true">
        {days.map((d, i) => (
          <div key={d.k} className={'wb-day' + (d.k === today ? ' now' : '') + (d.future ? ' fut' : '')}>
            <div className="wb-col">
              <i className="wb-t" style={{ height: `${(d.t / max) * 100}%` }} />
              <i className={'wb-e' + (d.e > d.t * 1.1 ? ' over' : '')} style={{ height: `${(d.e / max) * 100}%`, animationDelay: `${i * 40}ms` }} />
            </div>
            <span>{'MTWTFSS'[i]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Eating out, no label, no scale: log a ballpark number and move on. Consistency beats precision.
function QuickKcal({ onAdd }) {
  const [open, setOpen] = useState(false)
  const [kcal, setKcal] = useState('')
  const [p, setP] = useState('')
  const [name, setName] = useState('')
  const ok = +kcal > 0 && +kcal < 5000
  const add = () => {
    if (!ok) return
    onAdd({ name: name.trim() || 'Quick estimate', grams: 0, kcal: Math.round(+kcal), p: Math.round(+p || 0), c: 0, f: 0, source: 'quick', est: true })
    setKcal(''); setP(''); setName(''); setOpen(false)
  }
  if (!open) return <button className="qk-open" onClick={() => { haptic(); setOpen(true) }}>No label? Log a ballpark number</button>
  return (
    <div className="card qk">
      <span className="label">Ballpark</span>
      <input placeholder="What was it? (optional)" value={name} onChange={e => setName(e.target.value.slice(0, 50))} />
      <div className="qk-row">
        <label>kcal<input inputMode="numeric" autoFocus value={kcal} onChange={e => setKcal(e.target.value.replace(/\D/g, '').slice(0, 4))} onKeyDown={e => { if (e.key === 'Enter') add() }} /></label>
        <label>protein g<input inputMode="numeric" value={p} onChange={e => setP(e.target.value.replace(/\D/g, '').slice(0, 3))} onKeyDown={e => { if (e.key === 'Enter') add() }} /></label>
      </div>
      <div className="grid2">
        <button className="btn secondary" onClick={() => setOpen(false)}>Cancel</button>
        <button className="btn" disabled={!ok} onClick={add}>Log it</button>
      </div>
    </div>
  )
}

// Opens in the middle of whatever the person is looking at — never at the bottom of the page.
function CenterDialog({ onClose, children }) {
  useBackClose(true, onClose)
  const [vv, setVv] = useState(() => readViewport())
  useEffect(() => {
    const v = window.visualViewport
    if (!v) return
    const on = () => setVv(readViewport())
    v.addEventListener('resize', on); v.addEventListener('scroll', on)
    return () => { v.removeEventListener('resize', on); v.removeEventListener('scroll', on) }
  }, [])
  // Portal to <body>: animated ancestors (transform) would otherwise turn position:fixed into page-relative.
  return createPortal(
    <div className="cdlg" style={{ top: vv.top, height: vv.height }} onClick={e => { if (e.target === e.currentTarget) history.back() }}>
      <div className="cdlg-box" role="dialog" aria-modal="true">{children}</div>
    </div>,
    document.body
  )
}

function readViewport() {
  const v = typeof window !== 'undefined' ? window.visualViewport : null
  return v ? { top: v.offsetTop, height: v.height } : { top: 0, height: typeof window !== 'undefined' ? window.innerHeight : 800 }
}

// One idea at a time for the meal you are about to eat, sized to what is left today. Nothing counts until you log it.
function Ideas({ slot, items, budget, left, onSlot, onSuggest, onSwap, onLog }) {
  return (
    <div className="card id">
      <div className="row"><span className="label">What to eat</span><span className="num td-small">{left} kcal left</span></div>
      <div className="chips">{SLOTS.map(sl => <button key={sl} className={'chip' + (slot === sl ? ' on' : '')} onClick={() => onSlot(sl)}>{sl}</button>)}</div>
      {budget === 0 ? (
        <p className="hint">Today’s calories are covered, nothing more is needed. If you’re still hungry, reach for protein and vegetables first.</p>
      ) : !items ? (
        <>
          <p className="hint">Three ideas for {slot}, around {budget} kcal. They only count once you tap Log it.</p>
          <button className="btn secondary" onClick={onSuggest}>Suggest a {slot}</button>
        </>
      ) : items.length === 0 ? (
        <button className="btn secondary" onClick={onSuggest}>↻ Show ideas for {slot}</button>
      ) : (
        <>
          <AnimatePresence initial={false}>
            {items.map((m, i) => (
              <motion.div className="id-item" key={m.name} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 34 }}>
                <div className="id-t">
                  <b>{m.name}</b>
                  <span className="macros num">{m.kcal} kcal · P {m.p}g · C {m.c}g · F {m.f_}g{m.factor !== 1 ? ` · ×${m.factor}` : ''}</span>
                </div>
                <div className="id-b">
                  <button className="btn small" onClick={() => onLog(m)}>Log it</button>
                  <button className="btn small secondary" onClick={() => onSwap(i)} aria-label={`Swap ${m.name}`}>⇄</button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <button className="ac-link" onClick={onSuggest}>↻ Other ideas</button>
        </>
      )}
    </div>
  )
}

// A one-line way back to what you ate yesterday.
function Yesterday({ state, today, onOpen }) {
  const y = addDays(today, -1)
  const items = state.foodLog?.[y] || []
  const days = items.length ? null : historyDays(state, today, 1)
  const d = items.length ? { key: y, items } : days[0]
  if (!d) return null
  const kcal = Math.round(d.items.reduce((a, x) => a + (x.kcal || 0), 0))
  const label = d.key === y ? 'Yesterday' : new Date(d.key + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  return (
    <button className="card yd" onClick={onOpen}>
      <span><span className="label">{label}</span><b className="num">{kcal} kcal</b><span className="td-small"> · {d.items.length} item{d.items.length === 1 ? '' : 's'}</span></span>
      <span aria-hidden="true">›</span>
    </button>
  )
}
