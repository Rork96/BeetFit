import React, { useMemo, useState } from 'react'
import { dayKey, addDays, weekday, dayScore, dayTasks, eaten, waterOf, setsLogged, streakInfo, program, KG_TO_LB } from '../lib/day.js'
import { plansOf, plansOn, planDone, planTitle, dropPlan, toggleNote, newId, weekPlanOf, setWeekPlan, exportICS, PLAN_KINDS, DOW, planEvents } from '../lib/plans.js'
import { pushOn, pushSupport, enablePush, remindersOf, PUSH_ERR } from '../lib/push.js'
import { haptic, hapticSuccess } from '../lib/platform.js'
import { useBackClose } from '../lib/hooks.js'
import { Toggle } from './Settings.jsx'
import './calendar.css'

const MOODS = ['awful', 'low', 'ok', 'good', 'great']
const longDate = k => new Date(k + 'T12:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
const daysApart = (a, b) => Math.round((Date.parse(b + 'T12:00') - Date.parse(a + 'T12:00')) / 864e5)
function relative(k, today) {
  const n = daysApart(today, k)
  return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n === -1 ? 'Yesterday' : n > 0 ? `In ${n} days` : `${-n} days ago`
}

export default function Calendar({ state, update, first, planWeek, onStartWorkout, onClose }) {
  const today = dayKey()
  const [sel, setSel] = useState(first || today)
  const [month, setMonth] = useState(() => { const [y, m] = (first || today).split('-').map(Number); return { y, m: m - 1 } })
  const [sheet, setSheet] = useState(planWeek ? { kind: 'week' } : null) // { kind: 'add' } | { kind: 'week' }
  const [note, setNote] = useState(null) // banner text after saving
  useBackClose(!!sheet, () => setSheet(null))

  const frozen = useMemo(() => new Set(streakInfo(state, today).frozen), [state, today])
  const plans = plansOf(state)
  const savePlans = (next, msg) => {
    update({ plans: next })
    if (msg) setNote(msg)
  }

  const cells = useMemo(() => {
    const first = new Date(month.y, month.m, 1)
    const lead = (first.getDay() + 6) % 7
    const n = new Date(month.y, month.m + 1, 0).getDate()
    const out = Array.from({ length: lead }, () => null)
    for (let d = 1; d <= n; d++) {
      const k = dayKey(new Date(month.y, month.m, d))
      const past = k <= today
      const ps = plansOn(state, k)
      out.push({
        k, d, past, today: k === today,
        score: past ? dayScore(state, k) : null,
        frozen: frozen.has(k),
        trained: past && setsLogged(state, k) > 0,
        planned: ps.length > 0,
        open: ps.some(p => !planDone(state, p, k))
      })
    }
    return out
  }, [state, month, today, frozen])

  const shift = n => { haptic(); setMonth(c => { const d = new Date(c.y, c.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() } }) }
  const pick = k => { haptic(); setSel(k); setNote(null) }
  const goToday = () => { const d = new Date(); setMonth({ y: d.getFullYear(), m: d.getMonth() }); pick(today) }

  const share = async list => {
    haptic()
    const r = await exportICS(list, list.length === 1 ? planTitle(list[0]).toLowerCase().replace(/\W+/g, '-') : 'beetfit')
    if (r === 'downloaded') setNote('Calendar file saved. Open it to add the events to your phone’s calendar.')
  }

  const weekPlan = weekPlanOf(state)
  return (
    <div className="screen cl">
      <header className="screen-top">
        <button className="td-icon" onClick={onClose} aria-label="Back">←</button>
        <h2>Calendar</h2>
        <button className="btn small secondary" onClick={goToday}>Today</button>
      </header>
      <div className="page stk">
        <div className="cl-actions">
          <button className="chip" onClick={() => { haptic(); setSheet({ kind: 'week' }) }}>
            {weekPlan.days.length ? `Training days: ${weekPlan.days.map(d => DOW[d]).join(' ')}` : 'Plan my training days'}
          </button>
          <button className="chip" disabled={!plans.length} onClick={() => share(plans)}>Phone calendar ↗</button>
        </div>

        <div className="card cl-month">
          <div className="row">
            <button className="ss-more" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
            <b className="cl-title">{new Date(month.y, month.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</b>
            <button className="ss-more" onClick={() => shift(1)} aria-label="Next month">›</button>
          </div>
          <div className="cl-grid" key={`${month.y}-${month.m}`}>
            {'MTWTFSS'.split('').map((d, i) => <span key={i} className="cl-dow">{d}</span>)}
            {cells.map((c, i) => c ? (
              <button key={c.k} onClick={() => pick(c.k)}
                className={'cl-d' + (c.past ? ` s${c.score}` : ' fut') + (c.frozen ? ' frz' : '') + (c.today ? ' today' : '') + (c.k === sel ? ' sel' : '')}
                aria-label={`${longDate(c.k)}${c.planned ? ', planned' : ''}`}>
                <span className="num">{c.d}</span>
                <span className="cl-marks">{c.trained && <i className="t" />}{c.planned && <i className={'p' + (c.open ? '' : ' done')} />}</span>
              </button>
            ) : <span key={'e' + i} />)}
          </div>
          <div className="cl-legend">
            <span><i className="lg s2" />day counted</span><span><i className="lg frz" />freeze</span><span><i className="lg t" />trained</span><span><i className="lg p" />planned</span>
          </div>
        </div>

        {note && <p className="cl-note">{note}</p>}
        <Day state={state} k={sel} today={today} onAdd={() => { haptic(); setSheet({ kind: 'add' }) }}
          onTick={p => { hapticSuccess(); savePlans(toggleNote(plans, p, sel)) }}
          onDrop={(p, all) => { haptic('medium'); savePlans(dropPlan(plans, p, sel, all)) }}
          onShare={p => share([p])} onStart={onStartWorkout} />
      </div>

      {sheet && <div className="sheet-back" onClick={() => history.back()} />}
      {sheet?.kind === 'add' && (
        <AddSheet state={state} date={sel < today ? today : sel}
          onSave={async (p, wantPush) => {
            hapticSuccess()
            const next = [...plans, p]
            update({ plans: next })
            history.back()
            if (wantPush) {
              const r = await enablePush(remindersOf(state), planEvents({ ...state, plans: next }))
              setNote(r.ok ? 'Saved. Reminders are on for this phone.' : `Saved. ${PUSH_ERR[r.error] || 'Reminders couldn’t be turned on.'}`)
            } else setNote(p.remind && p.time ? 'Saved. You’ll get a reminder at that time.' : 'Saved.')
            if (p.date !== sel) setSel(p.date)
          }} />
      )}
      {sheet?.kind === 'week' && (
        <WeekSheet state={state} plan={weekPlan}
          onSave={async (days, time, remind) => {
            hapticSuccess()
            const next = setWeekPlan(plans, days, time, remind, today)
            update({ plans: next })
            history.back()
            const wantPush = remind && days.length && !pushOn()
            if (wantPush) {
              const r = await enablePush(remindersOf(state), planEvents({ ...state, plans: next }))
              setNote(r.ok ? 'Training days saved. Reminders are on.' : `Training days saved. ${PUSH_ERR[r.error] || ''}`)
            } else setNote(days.length ? `Training days saved: ${days.map(d => DOW[d]).join(', ')} at ${time}.` : 'Training days cleared.')
          }} />
      )}
    </div>
  )
}

function Day({ state, k, today, onAdd, onTick, onDrop, onShare, onStart }) {
  const ps = plansOn(state, k)
  const past = k <= today
  const [open, setOpen] = useState(null) // plan id with actions shown
  const units = state.settings?.units || 'kg'
  const toU = kg => (units === 'lb' ? kg * KG_TO_LB : kg)
  return (
    <div className="card cl-day" key={k}>
      <div className="row">
        <div><span className="label">{relative(k, today)}</span><h3 className="cl-h">{longDate(k)}</h3></div>
        {k >= today && <button className="btn small" onClick={onAdd}>+ Add</button>}
      </div>

      {ps.length > 0 && (
        <div className="cl-plans">
          {ps.map(p => {
            const done = planDone(state, p, k)
            return (
              <div key={p.id} className={'cl-plan' + (done ? ' done' : '')}>
                <div className="cl-plan-row">
                  <button className={'cl-check k-' + p.kind} disabled={p.kind !== 'note'} onClick={() => onTick(p)} aria-label={done ? 'Done' : 'Mark done'}>
                    {done && <svg viewBox="0 0 24 24"><polyline points="5 12.5 10 17 19 7" /></svg>}
                  </button>
                  <button className="cl-plan-main" onClick={() => { haptic(); setOpen(o => (o === p.id ? null : p.id)) }}>
                    <b>{planTitle(p)}</b>
                    <span className="hint num">{p.time || 'Any time'}{p.repeat === 'weekly' ? ` · every ${DOW[weekday(p.date)]}` : ''}{p.remind && p.time ? ' · reminder' : ''}{p.kind !== 'note' ? ' · ticks itself' : ''}</span>
                  </button>
                  {p.kind === 'workout' && k === today && !done && <button className="btn small" onClick={onStart}>Start</button>}
                </div>
                {open === p.id && (
                  <div className="cl-plan-acts">
                    <button className="chip" onClick={() => onShare(p)}>Add to phone calendar</button>
                    {p.repeat === 'weekly' && <button className="chip" onClick={() => onDrop(p, false)}>Skip this day</button>}
                    <button className="chip cl-del" onClick={() => onDrop(p, true)}>{p.repeat === 'weekly' ? 'Delete every week' : 'Delete'}</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {!ps.length && k >= today && <p className="hint">Nothing planned. Add a workout, a weigh-in or a note, with a reminder if you want one.</p>}

      {past && <History state={state} k={k} toU={toU} units={units} />}
    </div>
  )
}

function History({ state, k, toU, units }) {
  const e = eaten(state, k)
  const tasks = dayTasks(state, k)
  const wl = state.workoutLog?.[k] || {}
  const ex = Object.entries(wl).filter(([n]) => !n.startsWith('__'))
  const ci = state.checkins?.[k]
  const wt = (state.weightLog || []).find(x => x.date === k)
  const food = state.foodLog?.[k] || []
  if (!tasks.some(t => t.done) && !wt && !ci) return <p className="hint">Nothing logged this day.</p>
  return (
    <div className="cl-hist">
      <div className="chips wrap">{tasks.map(t => <span key={t.id} className={'chip' + (t.done ? ' on' : '')}>{t.done ? '✓ ' : ''}{t.id === 'food' ? 'Food' : t.id === 'water' ? 'Water' : 'Training'}</span>)}</div>
      <div className="cl-stats">
        <div><b className="num">{e.kcal}</b><span>kcal</span></div>
        <div><b className="num">{e.p}g</b><span>protein</span></div>
        <div><b className="num">{waterOf(state, k)}</b><span>glasses</span></div>
        <div><b className="num">{wt ? toU(wt.kg).toFixed(1) : '—'}</b><span>{units}</span></div>
      </div>
      {ex.length > 0 && (
        <div><span className="label">Training{wl.__warmup && wl.__warmup !== 'skipped' ? ' · warm-up ✓' : ''}</span>
          {ex.map(([n, v]) => (
            <p key={n} className="td-small num">{n}: {v?.skipped ? `skipped (${v.pain})` : (v?.sets || []).filter(Boolean).map(s => `${s.w ? s.w + '×' : ''}${s.reps ?? (s.secs != null ? s.secs + 's' : '✓')}${s.rpe ? '@' + s.rpe : ''}`).join(', ')}</p>
          ))}
        </div>
      )}
      {food.length > 0 && <div><span className="label">Food</span>{food.slice(0, 8).map(f => <p key={f.at} className="td-small num">{f.name} · {f.kcal} kcal</p>)}{food.length > 8 && <p className="td-small">+{food.length - 8} more</p>}</div>}
      {ci && <p className="td-small">Check-in: sleep {ci.sleep ?? '—'} h · mood {ci.mood ? MOODS[ci.mood - 1] : '—'}</p>}
    </div>
  )
}

const DEFAULT_TIME = { workout: '18:00', weigh: '07:30', note: '' }

function AddSheet({ state, date, onSave }) {
  const [kind, setKind] = useState('workout')
  const [title, setTitle] = useState('')
  const [day, setDay] = useState(date)
  const [time, setTime] = useState(DEFAULT_TIME.workout)
  const [repeat, setRepeat] = useState('none')
  const [remind, setRemind] = useState(true)
  const today = dayKey()
  const setK = k => { haptic(); setKind(k); setTime(DEFAULT_TIME[k]) }
  const ok = day >= today && (kind !== 'note' || title.trim())
  const support = pushSupport()
  const needsPush = remind && time && !pushOn()
  const save = () => onSave({ id: newId(), kind, title: title.trim().slice(0, 60), date: day, time: time || null, repeat, remind: !!(remind && time) }, needsPush && (support === 'web' || support === 'native'))
  return (
    <div className="sheet cl-sheet">
      <span className="label">Add to {new Date(day + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {relative(day, today)}</span>
      <div className="chips">{PLAN_KINDS.map(k => <button key={k.id} className={'chip' + (kind === k.id ? ' on' : '')} onClick={() => setK(k.id)}>{k.label}</button>)}</div>
      <label>{kind === 'note' ? 'What' : 'Name (optional)'}
        <input value={title} maxLength={60} placeholder={kind === 'note' ? 'Physio, meal prep, rest day…' : kind === 'workout' ? `Workout · ${program(state).days.length} in your plan` : 'Weigh-in'} onChange={e => setTitle(e.target.value)} />
      </label>
      <div className="grid2">
        <label>Day<input type="date" value={day} min={today} onChange={e => e.target.value && setDay(e.target.value)} /></label>
        <label>Time<input type="time" value={time} onChange={e => setTime(e.target.value)} /></label>
      </div>
      <div className="set-row">
        <span className="set-l">Repeat</span>
        <div className="seg">
          <button className={repeat === 'none' ? 'on' : ''} onClick={() => { haptic(); setRepeat('none') }}>Once</button>
          <button className={repeat === 'weekly' ? 'on' : ''} onClick={() => { haptic(); setRepeat('weekly') }}>Every {DOW[weekday(day)]}</button>
        </div>
      </div>
      <div className="set-row">
        <div><span className="set-l">Remind me</span>{!time && <p className="hint" style={{ margin: 0 }}>Pick a time for a reminder.</p>}</div>
        <Toggle on={remind && !!time} onChange={v => setRemind(v)} />
      </div>
      {needsPush && support === 'install' && <p className="hint">{PUSH_ERR.install}</p>}
      {needsPush && (support === 'web' || support === 'native') && <p className="hint">Saving will ask to turn notifications on for this phone.</p>}
      <button className="btn" disabled={!ok} onClick={save}>Save</button>
    </div>
  )
}

function WeekSheet({ state, plan, onSave }) {
  const [days, setDays] = useState(plan.days)
  const [time, setTime] = useState(plan.time)
  const [remind, setRemind] = useState(plan.remind)
  const want = program(state).days.length
  const flip = d => { haptic(); setDays(ds => (ds.includes(d) ? ds.filter(x => x !== d) : [...ds, d])) }
  return (
    <div className="sheet cl-sheet">
      <span className="label">Training days</span>
      <h3 className="cl-h">Which days do you train?</h3>
      <p className="hint" style={{ margin: 0 }}>Your plan has {want} sessions a week. Pick the days you can actually make, with a gap between them if you can.</p>
      <div className="cl-week">
        {DOW.map((d, i) => <button key={d} className={'cl-wd' + (days.includes(i) ? ' on' : '')} onClick={() => flip(i)} aria-pressed={days.includes(i)}>{d}</button>)}
      </div>
      <p className={'hint num' + (days.length && days.length !== want ? ' cl-warn' : '')} style={{ margin: 0 }}>
        {days.length} of {want} picked{days.length > want ? ' · extra days are fine for walks or mobility' : days.length && days.length < want ? ' · the plan will run over more days' : ''}
      </p>
      <div className="set-row"><span className="set-l">Time</span><input type="time" value={time} style={{ maxWidth: 140 }} onChange={e => setTime(e.target.value || '18:00')} /></div>
      <div className="set-row"><span className="set-l">Remind me</span><Toggle on={remind} onChange={v => setRemind(v)} /></div>
      <button className="btn" onClick={() => onSave(days, time, remind)}>{days.length ? 'Save training days' : 'Clear training days'}</button>
    </div>
  )
}
