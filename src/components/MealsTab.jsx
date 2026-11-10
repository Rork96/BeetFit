import React, { useEffect, useRef, useState } from 'react'
import Ic from './Icons.jsx'
import { MacroBar, MacroChips } from './Nutri.jsx'
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
  const [slot, setSlot] = useState(slotByHour)
  const [focus, setFocus] = useState(0)
  const [editAt, setEditAt] = useState(null)
  const addTo = sl => { haptic(); setSlot(sl); setFocus(n => n + 1) }
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
  // Change the grams of a logged item; kcal and macros scale with it.
  const regram = (x, g) => {
    const k = g / x.grams
    update(prev => ({ foodLog: { ...prev.foodLog, [today]: (prev.foodLog?.[today] || []).map(y => (y.at === x.at
      ? { ...y, grams: g, kcal: Math.round(x.kcal * k), p: Math.round(x.p * k * 10) / 10, c: Math.round(x.c * k * 10) / 10, f: Math.round(x.f * k * 10) / 10 } : y)) } }))
  }

  if (hist) return <FoodHistory state={state} today={today} onClose={() => history.back()} onAdd={(items, o) => { addFoods(items, o); }} />

  if (cam) return <FoodCamera initialMode={cam} slotLabel={slot} onAdd={addFoods} onClose={() => history.back()} onUpgrade={onUpgrade && (r => { history.back(); setTimeout(() => onUpgrade(r), 80) })} />

  const left = Math.max(0, t.kcal - totals.kcal)
  const over = totals.kcal > t.kcal
  return (
    <div className="page">
      <div className="row">
        <div className="hero"><span className="glow" /><h1>Food</h1></div>
        <button className="btn small secondary" onClick={() => { haptic(); setHist(true) }}>History</button>
      </div>

      {/* 1. Where the day stands */}
      <div className="card mf-sum">
        <div className="mf-left">
          <div><b className="num">{over ? totals.kcal - t.kcal : left}</b><span>{over ? 'kcal over' : 'kcal left'}</span></div>
          <span className="td-small num">{totals.kcal} of {t.kcal}{t.dayType && <span className={'td-dt ' + t.dayType}>{t.dayType === 'train' ? `training day +${t.delta}` : `rest day ${t.delta}`}</span>}</span>
        </div>
        <div className="progressbar"><div style={{ width: `${Math.min(100, pct)}%`, background: pct > 110 ? 'var(--warn)' : undefined }} /></div>
        <div className="mf-macros">
          <MacroLine icon="protein" label="Protein" v={totals.p} max={t.protein} color="var(--accent)" />
          <MacroLine icon="carbs" label="Carbs" v={totals.c} max={t.carbs} color="var(--data-2)" />
          <MacroLine icon="fat" label="Fat" v={totals.f} max={t.fat} color="var(--water)" />
        </div>
        <WeekBars state={state} today={today} />
      </div>

      {/* 2. One place to add: pick the meal, then search, scan, photo or a ballpark */}
      <div className="card mf-add">
        <div className="mf-slots" role="radiogroup" aria-label="Add to which meal">
          {SLOTS.map(sl => (
            <button key={sl} role="radio" aria-checked={slot === sl} className={'mf-slot' + (slot === sl ? ' on' : '')} onClick={() => { haptic(); setSlot(sl) }}>
              <Ic n={SLOT_IC[sl]} className="solid" /><span>{sl}</span>
            </button>
          ))}
        </div>
        <FoodSearch bare focus={focus} slotLabel={slot} onAdd={(item, g) => addFoods([portion(item, g)])}
          actions={<>
            <button className="mf-act" onClick={() => { haptic(); setCam('barcode') }} aria-label="Scan a barcode"><Ic n="barcode" /></button>
            <button className="mf-act hot" onClick={() => { haptic(); setCam('snap') }} aria-label="Photo of your meal"><Ic n="cam" className="solid" /></button>
          </>} />
        {again && !again.items.every(loggedIn) && (
          <button className="mq-again" onClick={() => { hapticSuccess(); addFoods(again.items) }}>
            <span className="mq-again-ic"><Ic n="reps" /></span>
            <span><b>Same {slot} as {again.date === addDays(today, -1) ? 'yesterday' : new Date(again.date + 'T12:00').toLocaleDateString('en-US', { weekday: 'short' })}</b>
              <span className="td-small">{again.items.map(x => x.name.split(' · ')[0]).join(', ')}</span></span>
            <span className="num mq-k">{again.kcal}<small>kcal</small></span>
          </button>
        )}
        {recent.length > 0 && (
          <>
            <span className="label mf-sub">Recent · 1 tap</span>
            <div className="mq-chips">
              {recent.map(it => (
                <motion.button key={it.name} whileTap={{ scale: 0.94 }} className="mq-chip" onClick={() => quick(it)}>
                  <b>{it.name.split(' · ')[0]}</b><span className="num">{it.source === 'plan' ? '1 serving · ' : it.grams ? `${it.grams} g · ` : ''}<Ic n="flame" />{it.kcal}</span>
                </motion.button>
              ))}
            </div>
          </>
        )}
        <QuickKcal onAdd={x => { hapticSuccess(); addFoods([x]) }} />
      </div>

      {/* 3. The diary: every meal, always visible */}
      <div className="card ml mf-diary">
        <div className="row"><span className="label">Today’s meals</span>{logged.length > 0 && <span className="td-small">Tap an item to change grams</span>}</div>
        {SLOTS.map(sl => {
          const items = logged.filter(x => x.slot === sl)
          const kc = Math.round(items.reduce((a, x) => a + x.kcal, 0))
          return (
            <div key={sl} className={'ml-slot' + (items.length ? '' : ' empty')}>
              <div className="ml-h">
                <span className="ml-hn"><Ic n={SLOT_IC[sl]} className="solid" />{sl}</span>
                {items.length > 0 && <span className="num ml-hk"><Ic n="flame" />{kc}</span>}
                <button className="ml-plus" onClick={() => addTo(sl)} aria-label={`Add to ${sl}`}><Ic n="plus" /></button>
              </div>
              <AnimatePresence initial={false}>
                {items.map(x => (
                  <motion.div className="meal" key={x.at} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0, transition: { duration: 0.18 } }} transition={{ type: 'spring', stiffness: 420, damping: 34 }}>
                    <button className="meal-b" onClick={() => { if (x.grams > 0) { haptic(); setEditAt(editAt === x.at ? null : x.at) } }} aria-expanded={editAt === x.at}>
                      <div className="ml-n">
                        {x.source === 'snap' ? <Ic n="cam" label="From a photo" /> : x.source === 'off' || x.code ? <Ic n="barcode" label="Scanned" /> : x.source === 'quick' ? <Ic n="target" label="Ballpark" /> : null}
                        <span>{x.name}</span>{x.est && <span className="ml-est">≈</span>}
                      </div>
                      <div className="macros ml-m">
                        <span className="ml-k num"><Ic n="flame" />{x.kcal}</span>
                        {x.source !== 'quick' && <MacroChips sm p={x.p} c={x.c} f={x.f} />}
                        {x.grams > 0 && <span className="ml-g num">{x.grams} g{editAt !== x.at && <Ic n="edit" />}</span>}
                      </div>
                    </button>
                    <button className="btn small secondary" onClick={() => removeFood(x)} aria-label={`Remove ${x.name}`}>×</button>
                    {editAt === x.at && (
                      <div className="ml-edit">
                        {[0.5, 0.75, 1.25, 1.5].map(k => <button key={k} className="chip" onClick={() => { haptic(); regram(x, Math.max(5, Math.round(x.grams * k / 5) * 5)) }}>×{k}</button>)}
                        <GramStep value={x.grams} onChange={g => regram(x, g)} />
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              {!items.length && <button className="ml-add" onClick={() => addTo(sl)}><Ic n="plus" />Add {sl}</button>}
            </div>
          )
        })}
      </div>

      <Ideas slot={ideas?.slot || sugSlot} items={ideas?.items} budget={budget(ideas?.slot || sugSlot)} left={left}
        onSlot={sl => (ideas ? suggest(sl) : setSugSlot(sl))} onSuggest={() => suggest()} onSwap={swapIdea} onLog={logIdea} />

      <Yesterday state={state} today={today} onOpen={() => { haptic(); setHist(true) }} />

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

const SLOT_IC = { breakfast: 'sunrise', lunch: 'sun', dinner: 'moon', snack: 'apple' }

function MacroLine({ icon, label, v, max, color }) {
  return (
    <div className="mf-ml" aria-label={`${label} ${v} of ${max} g`}>
      <div className="row"><span className="mf-ml-l" style={{ color }}><Ic n={icon} className="solid" /><span>{label}</span></span><span className="num">{v}<small>/{max}g</small></span></div>
      <div className="td-bar"><i style={{ transform: `scaleX(${Math.min(1, v / max)})`, background: color }} /></div>
    </div>
  )
}

function GramStep({ value, onChange }) {
  const step = value >= 100 ? 25 : 10
  return (
    <div className="fc-step ml-step">
      <button onClick={() => { haptic(); onChange(Math.max(step, value - step)) }} aria-label="Less">−</button>
      <span className="num">{value}<small>g</small></span>
      <button onClick={() => { haptic(); onChange(value + step) }} aria-label="More">+</button>
    </div>
  )
}

function FoodSearch({ onAdd, slotLabel, bare, actions, focus }) {
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
  useEffect(() => { if (focus) { inputRef.current?.focus(); inputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }) } }, [focus])

  return (
    <div className={bare ? 'fs-bare' : 'card'}>
      <div className="fs-row-in">
        <div className="fs-input">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="13" height="13" /><path d="M14 14l7 7" /></svg>
          <input ref={inputRef} type="search" placeholder="Search food" aria-label={`Search food for ${slotLabel}`} value={q} onChange={e => setQ(e.target.value)} enterKeyHint="search" />
        </div>
        {actions}
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
                  {it.image ? <img src={it.image} alt="" loading="lazy" /> : <span className="fc-ph"><Ic n="food" /></span>}
                  <div><b>{it.name}</b><span className="fs-sub">{it.brand && <span className="fs-brand">{it.brand}</span>}<MacroBar p={it.per100.p} c={it.per100.c} f={it.per100.f} w={44} /></span></div>
                  <span className="fs-kcal num" aria-label={`${it.per100.kcal} kcal per 100 g`}><b>{it.per100.kcal}</b><small>/100g</small></span>
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
  if (!open) return <button className="qk-open" onClick={() => { haptic(); setOpen(true) }}><Ic n="target" />No label? Log kcal on a guess</button>
  return (
    <div className="qk">
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
