import React, { useState } from 'react'
import { planStatus } from '../lib/train.js'
import { nextUp, dayKey, eaten, targets, waterOf, dayTasks, streakInfo, todayStanding, weekReview, week, program, nextDayIndex, setsLogged, currentWeight, fmtWeight, KG_TO_LB } from '../lib/day.js'
import { trackerFor } from '../camera/RepTracker.jsx'
import { useCountUp, useBackClose } from '../lib/hooks.js'
import { StreakPill, StreakSheet, useMilestone, Milestone } from './Streak.jsx'
import { plansOn, planTitle, planDone } from '../lib/plans.js'
import BodyFigure from './BodyFigure.jsx'
import { haptic, hapticSuccess } from '../lib/platform.js'
import { CoachNote, CoachStrip } from './Coach.jsx'
import { DayDone, useDayDone } from './DayDone.jsx'
import { BeetCard } from './Beet.jsx'
import { YourCoachCard } from './Coach.jsx'
import { loadChat } from '../lib/beet.js'
import BeetMascot from './BeetMascot.jsx'
import Ic from './Icons.jsx'
import { ReadCard } from './Read.jsx'
import SyncBadge from './SyncBadge.jsx'
import InstallCard from './InstallCard.jsx'
import './today.css'

const greeting = () => { const h = new Date().getHours(); return h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening' }

export default function TodayTab({ state, update, go, openSettings, coach, openChat, openClients, askBeet, openRead, openCalendar, sync }) {
  const key = dayKey()
  const t = targets(state)
  const e = eaten(state, key)
  const water = waterOf(state, key)
  const tasks = dayTasks(state, key)
  const si = streakInfo(state, key)
  const st = si.days
  const wk = week(state, key)
  const units = state.settings?.units || 'kg'
  const name = state.settings?.name
  const need = todayStanding(state, key).need
  const mascotMood = st >= 7 ? 'cheer' : st > 0 && need === 0 ? 'happy' : st > 0 && need > 0 && new Date().getHours() >= 17 ? 'tired' : 'idle'

  const remaining = Math.max(0, t.kcal - e.kcal)
  const shownRemaining = useCountUp(remaining)
  const kcalPct = Math.min(1, e.kcal / t.kcal)
  const [splash, setSplash] = useState(0)
  const [streakOpen, setStreakOpen] = useState(false)
  useBackClose(streakOpen, () => setStreakOpen(false))
  const [milestone, closeMilestone] = useMilestone(state)
  const [dayDone, closeDayDone, openDayDone, allDone] = useDayDone(state)
  const todayPlans = plansOn(state, key)
  const calendar = o => { if (!openCalendar) return; history.back(); setTimeout(() => openCalendar(o), 60) }

  const prog = program(state)
  const dayIdx = nextDayIndex(state, key)
  const day = prog.days[dayIdx]
  const trainedToday = setsLogged(state, key) > 0
  const camCount = day.exercises.filter(ex => trackerFor(ex)).length
  const wPlan = todayPlans.find(x => x.kind === 'workout' && x.time && !planDone(state, x, key))
  const ts = planStatus(state, key)
  const up = nextUp(state, key, { workoutTime: wPlan?.time || null, restDay: !wPlan && (ts.kind === 'rest' || ts.kind === 'week') })
  const tomorrow = prog.days[(dayIdx + (trainedToday ? 1 : 0)) % prog.days.length]

  const wNow = currentWeight(state)
  const wStart = state.weightLog?.[0]?.kg ?? wNow
  const toGo = +(wNow - state.profile.targetKg).toFixed(1)

  const addGlass = delta => {
    haptic(delta > 0 ? 'light' : 'medium')
    const next = Math.max(0, water + delta)
    if (delta > 0) setSplash(s => s + 1)
    if (next === t.water && delta > 0) hapticSuccess()
    update(prev => ({ water: { ...(prev.water || {}), [key]: next } }))
  }

  const R = 64, C = 2 * Math.PI * R

  return (
    <div className="page today">
      <div className="row td-top">
        <div>
          <div className="td-date"><span className="label">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>{sync && <SyncBadge sync={sync} onOpen={openSettings} />}</div>
          <div className="hero"><span className="glow" /><h1>{greeting()}{name ? `, ${name}` : ''}</h1></div>
          {state.settings?.streak !== false && <StreakPill state={state} onOpen={() => setStreakOpen(true)} />}
        </div>
        <div className="td-top-r">
          <BeetMascot size={52} mood={mascotMood} bubble="left" />
          <button className="td-icon" onClick={() => { haptic(); openSettings() }} aria-label="Settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="6" height="6" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.5 2.5M16.5 16.5L19 19M5 19l2.5-2.5M16.5 7.5L19 5" /></svg>
          </button>
        </div>
      </div>

      <div className="stk td-stack">
        <NextUp up={up} onSummary={allDone ? openDayDone : null} tasks={tasks} day={day} camCount={camCount} tomorrow={tomorrow} streak={st} t={t} water={water} state={state} units={units} go={go}
          onGlass={() => addGlass(1)} onStart={() => { haptic(); go('workout', { start: true, dayIdx }) }} />
        {coach && <CoachNote coach={coach} onOpen={openChat} />}
        {/* Calories */}
        <div className="card td-kcal">
          <div className="td-ring">
            <svg viewBox="0 0 160 160">
              <circle cx="80" cy="80" r={R} className="trk" />
              <circle cx="80" cy="80" r={R} className={'val' + (e.kcal > t.kcal * 1.1 ? ' over' : '')}
                style={{ strokeDasharray: C, strokeDashoffset: C * (1 - kcalPct) }} />
            </svg>
            <div className="td-ring-in">
              <b className="num">{shownRemaining}</b>
              <span>kcal left</span>
            </div>
          </div>
          <div className="td-kcal-side">
            <div className="td-kv" aria-label={`Eaten ${e.kcal} kcal`}><Ic n="flame" className="solid" /><span className="td-kv-l">eaten</span><b className="num">{e.kcal}</b></div>
            <div className="td-kv" aria-label={`Target ${t.kcal} kcal`}><Ic n="target" /><span className="td-kv-l">goal</span><b className="num">{t.kcal}</b></div>
            {(t.coach || t.dayType) && <div className="td-kv-tag">{t.coach ? <span className="ch-tag">Set by your coach</span> : <span className={'td-dt ' + t.dayType}>{t.dayType === 'train' ? `Training day +${t.delta}` : `Rest day ${t.delta}`}</span>}</div>}
            <Macro icon="protein" label="Protein" v={e.p} max={t.protein} color="var(--accent)" />
            <Macro icon="carbs" label="Carbs" v={e.c} max={t.carbs} color="var(--data-2)" />
            <Macro icon="fat" label="Fat" v={e.f} max={t.fat} color="var(--water)" />
          </div>
          <button className="td-link" onClick={() => go('meals')}>Log food →</button>
        </div>

        <FirstSteps state={state} go={go} onGlass={() => addGlass(1)} askBeet={askBeet} onStart={() => { haptic(); go('workout', { start: true, dayIdx }) }} />
        <WeekReview state={state} today={key} streak={st} units={units} onPlan={() => { haptic(); openCalendar?.({ plan: true }) }} />
        {todayPlans.length > 0 && (
          <button className="card td-plans" onClick={() => { haptic(); openCalendar?.({ day: key }) }}>
            <span className="label">On your calendar today</span>
            {todayPlans.map(p => (
              <span key={p.id} className={'td-plan' + (planDone(state, p, key) ? ' done' : '')}>
                <i />{planTitle(p)}<span className="num">{p.time || ''}</span>
              </span>
            ))}
          </button>
        )}

        {/* Water + Body */}
        <div className="grid2">
          <div className="card td-water">
            <div className="row"><span className="label">Water</span><span className="num td-small">{water}/{t.water}</span></div>
            <div className="td-glasses">
              {Array.from({ length: t.water }, (_, i) => <i key={i} className={i < water ? 'on' : ''} style={{ transitionDelay: `${i * 29}ms` }} />)}
            </div>
            <div className="td-water-btns">
              <button onClick={() => addGlass(-1)} disabled={!water} aria-label="Remove a glass">−</button>
              <button className="add" onClick={() => addGlass(1)} aria-label="Add a glass">+ glass{splash > 0 && <span className="td-splash" key={splash} />}</button>
            </div>
          </div>
          <button className="card td-body" onClick={() => go('progress')}>
            <span className="td-fig"><BodyFigure sex={state.profile.sex} heightCm={state.profile.heightCm} startKg={wStart} currentKg={wNow} targetKg={state.profile.targetKg} goal={state.profile.goal} show="target" height={118} /></span>
            <span className="label">Body</span>
            <b className="num">{fmtWeight(wNow, units)}</b>
            <span className="td-small">{toGo === 0 ? 'At target' : `${fmtWeight(Math.abs(toGo), units)} to go`}</span>
            <span className={'td-delta ' + ((wNow - wStart) * (wStart - state.profile.targetKg) > 0 ? 'good' : 'flat')}>
              {wNow - wStart === 0 ? 'since start: —' : `since start: ${wNow - wStart > 0 ? '+' : '−'}${fmtWeight(Math.abs(wNow - wStart), units)}`}
            </span>
          </button>
        </div>

        {askBeet && <BeetCard state={state} onAsk={askBeet} />}
        <CoachStrip openClients={openClients} />
        {coach && !coach.link?.coach && <AddTrainer coach={coach} />}

        {/* Week + today's tasks */}
        <div className="card td-wk">
          <div className="row"><span className="label">This week · <span className="num">{wk.filter(d => d.score >= 2).length}/7</span>{state.settings?.streak !== false && <> · {si.freezeLeft ? 'freeze ready' : 'freeze used'}</>}</span><button className="rd-all" onClick={() => { haptic(); openCalendar?.({ day: key }) }}>Calendar →</button></div>
          <div className="td-week">
            {wk.map(d => (
              <div key={d.key} className={'td-day' + (d.today ? ' today' : '')}>
                <i className={d.paused && !(d.score >= 2) ? 'pz' : d.score == null ? 'future' : si.frozen.includes(d.key) ? 'frz' : `s${d.score}`} />
                <span>{d.label}</span>
              </div>
            ))}
          </div>
          {state.settings?.streak !== false && <p className="td-small td-rule">2 of 3 keeps the streak · 1 missed day a week is free</p>}
        </div>

        <InstallCard />
        {openRead && <ReadCard state={state} onOpen={openRead} />}
      </div>
      {streakOpen && <StreakSheet state={state} update={update} onClose={() => history.back()} onCalendar={() => calendar({ day: key })} />}
      {milestone && <Milestone days={milestone} onClose={closeMilestone} />}
      {dayDone && <DayDone state={state} coach={coach?.link?.coach?.name} onClose={closeDayDone} />}
    </div>
  )
}

const SEEN = 'beetfit_week_seen'
const seenWeek = () => { try { return localStorage.getItem(SEEN) } catch { return null } }

// Sunday: this week so far. Monday: last week. Dismissed per week.
function WeekReview({ state, today, streak, units, onPlan }) {
  const r = weekReview(state, today)
  const [seen, setSeen] = useState(seenWeek)
  if (!r || seen === r.id + (r.final ? 'f' : '')) return null
  const close = () => { haptic(); const id = r.id + (r.final ? 'f' : ''); try { localStorage.setItem(SEEN, id) } catch { /* ignore */ } setSeen(id) }
  const fmtD = k => new Date(k + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const wc = r.weightChange
  const wcText = wc == null ? '—' : `${wc > 0 ? '+' : ''}${units === 'lb' ? +(wc * KG_TO_LB).toFixed(1) : wc}`
  const head = r.kept ? `Week kept: ${r.sessions} of ${r.planned} sessions.`
    : r.final ? `${r.sessions} of ${r.planned} sessions last week.`
      : `${r.sessions} of ${r.planned} sessions so far.`
  const sub = r.kept ? (streak >= 3 ? `${streak}-day streak going into ${r.final ? 'this' : 'next'} week.` : `Same again ${r.final ? 'this' : 'next'} week.`)
    : r.final ? `Plan for ${r.planned} this week. Pick the days now.`
      : r.planned - r.sessions === 1 ? 'One session today hits the week.' : 'Today still counts. Do one session.'
  return (
    <div className={'card td-review' + (r.kept ? ' kept' : '')}>
      <div className="row">
        <span className="label">{r.final ? 'Last week' : 'This week'} · {fmtD(r.start)}–{fmtD(r.end)}</span>
        <button className="td-x" onClick={close} aria-label="Dismiss">✕</button>
      </div>
      <div>
        <b className="td-review-h">{head}</b>
        <p className="hint" style={{ margin: '4px 0 0' }}>{sub}</p>
      </div>
      <div className="td-review-g">
        <div aria-label={`${r.sessions} of ${r.planned} sessions`}><Ic n="train" /><b className="num">{r.sessions}/{r.planned}</b></div>
        <div aria-label={`${r.foodDays} of 7 days food logged`}><Ic n="food" /><b className="num">{r.foodDays}/7</b></div>
        <div aria-label={`Protein average ${r.protein ?? 'none'}${r.protein != null ? ` of ${r.proteinTarget} g` : ''}`}><Ic n="protein" className="solid" /><b className="num">{r.protein ?? '—'}{r.protein != null && <small>g</small>}</b></div>
        <div aria-label="Weight trend"><Ic n="trend" /><b className="num">{wcText}{wc != null && <small>{units}</small>}</b></div>
      </div>
      {!r.kept && onPlan && <button className="btn secondary small" onClick={onPlan}>Plan my training days</button>}
    </div>
  )
}

function Macro({ icon, label, v, max, color }) {
  return (
    <div className="td-macro" aria-label={`${label} ${v} of ${max} g`}>
      <div className="row"><span className="td-mi" style={{ color }}><Ic n={icon} className="solid" /><span>{label}</span></span><span className="num">{v}<small>/{max}g</small></span></div>
      <div className="td-bar"><i style={{ transform: `scaleX(${Math.min(1, v / max)})`, background: color }} /></div>
    </div>
  )
}

// One thing to do now. Everything else on Today is context for it.
function NextUp({ up, onSummary, tasks, day, camCount, tomorrow, streak, t, water, state, units, go, onGlass, onStart }) {
  const dayName = n => n.split('—')[1]?.trim() || n
  const last = up.id === 'weigh' ? state.weightLog.reduce((m, w) => (w.date > m.date ? w : m)) : null
  const h = {
    train: { label: 'Next up · training day', title: dayName(day.name), sub: `${day.exercises.length} exercises${camCount ? ` · camera counts ${camCount}` : ''}`, cta: 'Start session', act: onStart },
    food: { label: 'Next up', title: 'Log what you eat', sub: `Target ${t.kcal} kcal · ${t.protein} g protein. Photo, barcode or search.`, cta: 'Log food', act: () => { haptic(); go('meals') } },
    weigh: last && { label: 'Next up · weekly check', title: 'Weigh in', sub: `Last: ${fmtWeight(last.kg, units)}, ${new Date(last.date + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. One number a week keeps the plan honest.`, cta: 'Log weight', act: () => { haptic(); go('progress') } },
    water: { label: 'Next up', title: `Water: ${water} of ${t.water}`, sub: 'Last task for today.', cta: '+ glass', act: onGlass },
    done: { label: 'Today is done', title: 'Nothing left for today', sub: `${streak ? `${streak}-day streak. ` : ''}Next session: ${dayName(tomorrow.name)}.`, cta: null },
    rest: { label: 'Next up · rest day', title: 'Recover today', sub: `Muscles rebuild today. Next session: ${dayName(tomorrow.name)}. A walk still counts.`, cta: null }
  }[up.id]
  const done = up.id === 'done' || up.id === 'rest'
  return (
    <div className={'card td-next' + (done ? ' done' : '')}>
      <span className="label">{h.label}</span>
      <h2>{h.title}</h2>
      {up.id === 'train'
        ? <p className="hint td-sub-ic" aria-label={h.sub}><span><Ic n="train" />{day.exercises.length}</span>{camCount > 0 && <span className="cam"><Ic n="cam" className="solid" />{camCount}</span>}</p>
        : <p className="hint">{h.sub}</p>}
      {h.cta && <button className="btn" onClick={h.act}>{h.cta}</button>}
      {onSummary && done && <button className="td-link td-seeday" onClick={onSummary}>See your day →</button>}
      {up.id === 'rest' && <button className="td-link td-anyway" onClick={() => { haptic(); go('workout') }}>Train anyway →</button>}
      <div className="td-tasks" aria-label="Today: 2 of 3 keeps the streak">
        {tasks.map(tk => (
          <span key={tk.id} className={'td-task' + (tk.done ? ' on' : '') + (tk.rest ? ' rest' : '')} title={tk.label} aria-label={tk.label + (tk.done ? ', done' : '')}>
            <Ic n={tk.rest ? 'moon' : { food: 'food', water: 'water', train: 'train' }[tk.id] || 'check'} />
            <span className="td-task-l">{tk.id === 'water' ? <span className="num">{water}/{t.water}</span> : tk.rest ? 'Rest' : { food: 'Food', train: 'Train' }[tk.id] || tk.short}</span>
            {tk.done && <i><Ic n="check" /></i>}
          </span>
        ))}
      </div>
      <p className="td-tasks-cap"><b className="num">{tasks.filter(x => x.done).length}/3</b> done today · {tasks.some(x => x.rest) ? 'rest day counts, one more keeps your streak' : 'any 2 keep your streak'}</p>
    </div>
  )
}

// First days: five small wins, in order, each one tap away. Hides itself when done or dismissed.
const FS_OFF = 'beetfit_firststeps_off'
function FirstSteps({ state, go, onGlass, askBeet, onStart }) {
  const [off, setOff] = useState(() => { try { return localStorage.getItem(FS_OFF) === '1' } catch { return false } })
  const steps = [
    { id: 'food', icon: 'food', t: 'Log your first meal', s: 'Photo, barcode or search', done: Object.values(state.foodLog || {}).some(d => d?.length), act: () => go('meals') },
    { id: 'water', icon: 'water', t: 'Add a glass of water', s: 'One tap on Today', done: Object.values(state.water || {}).some(n => n > 0), act: onGlass },
    { id: 'train', icon: 'train', t: 'Do Day 1', s: 'The camera counts your reps', done: Object.values(state.workoutLog || {}).some(d => Object.keys(d || {}).some(k => !k.startsWith('__'))), act: onStart },
    { id: 'weigh', icon: 'scale', t: 'Log your weight', s: 'Once a week is enough', done: (state.weightLog || []).length > 0, act: () => go('progress') },
    ...(askBeet ? [{ id: 'beet', icon: 'beet', t: 'Ask Beet a question', s: 'It knows your plan and food', done: (loadChat() || []).length > 0, act: () => askBeet() }] : []),
  ]
  const n = steps.filter(x => x.done).length
  if (off || n === steps.length) return null
  const next = steps.find(x => !x.done)
  const hide = () => { haptic(); try { localStorage.setItem(FS_OFF, '1') } catch { /* ignore */ } setOff(true) }
  return (
    <div className="card fs1">
      <div className="fs1-h">
        <BeetMascot size={46} mood={n ? 'happy' : 'idle'} bubble="right" lines={['One small thing at a time.', 'Tap the next step.', n ? 'Nice, keep going!' : 'Start with a meal.']} />
        <div><b>Getting started</b><span className="hint num">{n} of {steps.length} done</span></div>
        <button className="td-x" onClick={hide} aria-label="Hide getting started">✕</button>
      </div>
      <div className="fs1-bar"><i style={{ transform: `scaleX(${n / steps.length})` }} /></div>
      <div className="fs1-list">
        {steps.map(x => (
          <button key={x.id} className={'fs1-row' + (x.done ? ' done' : '') + (x === next ? ' next' : '')} disabled={x.done} onClick={() => { haptic(); x.act() }}>
            <span className="fs1-ic">{x.done ? <Ic n="check" /> : <Ic n={x.icon} className="solid" />}</span>
            <span className="fs1-t"><b>{x.t}</b>{!x.done && <small>{x.s}</small>}</span>
            {!x.done && <Ic n="chevron" />}
          </button>
        ))}
      </div>
    </div>
  )
}

// "Add your trainer": the coach link is BeetFit's edge, so it gets a front-door entry, not a Settings row.
const AT_OFF = 'beetfit_addtrainer_off'
function AddTrainer({ coach }) {
  const [off, setOff] = useState(() => { try { return localStorage.getItem(AT_OFF) === '1' } catch { return false } })
  const [open, setOpen] = useState(false)
  if (off) return null
  if (open) return <YourCoachCard coach={coach} syncOn onChat={() => {}} />
  return (
    <div className="card at">
      <div className="at-h">
        <span className="at-ic"><Ic n="people" className="solid" /></span>
        <div><b>Train with a coach?</b><span className="hint">They see sets your camera counted and a form score, not just what you typed.</span></div>
        <button className="td-x" aria-label="Hide" onClick={() => { haptic(); try { localStorage.setItem(AT_OFF, '1') } catch { /* ignore */ } setOff(true) }}>✕</button>
      </div>
      <div className="at-pts">
        <span><Ic n="cam" className="solid" />Verified reps</span><span><Ic n="target" />Targets they set</span><span><Ic n="beet" className="solid" />Messages on Today</span>
      </div>
      <button className="btn secondary btn-ic" onClick={() => { haptic(); setOpen(true) }}><Ic n="plus" />Add your trainer</button>
    </div>
  )
}
