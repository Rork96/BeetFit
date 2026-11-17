import React from 'react'
import { haptic, hapticSuccess } from '../lib/platform.js'
import { dayKey, KG_TO_LB } from '../lib/day.js'
import { energyCheck, applyCheck } from '../lib/adapt.js'
import Ic from './Icons.jsx'
import './energy.css'

const n = v => Math.round(v).toLocaleString('en-US')
const shortDate = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

// "Your real burn": the weekly check-in that measures what the person burns from their own log, then
// offers to hold the pace (calories move) or hold the calories (the date moves).
// where = 'today' shows only a check-in that is ready and due; 'progress' always shows where things stand.
// The first check-in is free for everyone; later ones are part of PRO (`pro` = usePro(), may be missing).
export default function EnergyCard({ state, update, pro, where = 'progress' }) {
  const today = dayKey()
  const c = energyCheck(state, today)
  if (!c) return null
  const lb = state.settings?.units === 'lb'
  const rateTxt = r => `${Math.abs(lb ? r * KG_TO_LB : r).toFixed(2)} ${lb ? 'lb' : 'kg'} a week`
  const tgt = lb ? `${(state.profile.targetKg * KG_TO_LB).toFixed(0)} lb` : `${state.profile.targetKg} kg`
  const locked = !!pro?.on && !pro.pro && !!state.settings?.adaptFree
  const act = c.ready && c.due && !c.coach
  if (where === 'today' && !act) return null

  const choose = choice => {
    choice === 'skip' || choice === 'hold' ? haptic() : hapticSuccess()
    update(prev => { const patch = applyCheck(prev, c, choice, today); return { ...patch, settings: { ...patch.settings, adaptFree: true } } })
  }

  if (!c.ready) {
    const M = ({ have, need, label }) => (
      <div className={'en-m' + (have >= need ? ' ok' : '')}>
        <span className="en-m-bar"><i style={{ width: `${Math.min(100, have / need * 100)}%` }} /></span>
        <b className="num">{Math.min(have, need)}/{need}</b><small>{label}</small>
      </div>
    )
    return (
      <section className="card en">
        <div className="row"><span className="label">Your real burn</span><span className="en-pct num">{c.pct}%</span></div>
        <p className="en-lead">The formula says <b className="num">{n(c.formula)}</b> kcal a day. Your food log and the scale will say what it really is.</p>
        <div className="en-meters">
          <M have={c.have.logDays} need={c.need.logDays} label="full food days" />
          <M have={c.have.weighIns} need={c.need.weighIns} label="weigh-ins" />
          <M have={c.have.spanDays} need={c.need.spanDays} label="days apart" />
        </div>
        <p className="hint en-fine">Counted over the last 4 weeks. Then your calories follow your body, not an average.</p>
      </section>
    )
  }

  const Facts = () => (
    <div className="en-facts">
      <div><b className="num">{n(c.intake)}</b><small>kcal eaten, average</small></div>
      <div><b className="num">{c.rate > 0 ? '+' : c.rate < 0 ? '−' : ''}{Math.abs(lb ? c.rate * KG_TO_LB : c.rate).toFixed(2)}</b><small>{lb ? 'lb' : 'kg'} a week on the scale</small></div>
      <div><b className="num">{n(c.formula)}</b><small>the formula’s guess</small></div>
    </div>
  )

  if (!act) {
    return (
      <section className="card en">
        <div className="row"><span className="label">Your real burn</span>{c.last && <span className="hint en-when">checked {shortDate(new Date(c.last + 'T12:00'))}</span>}</div>
        <div className="en-big"><b className="num">{n(c.current)}</b><span>kcal a day</span></div>
        <Facts />
        <p className="hint en-fine">{c.coach ? 'Your coach sets your targets, so nothing changes here.' : 'Checked once a week from your log. The next check-in shows up on Today.'}</p>
      </section>
    )
  }

  if (locked) {
    return (
      <section className="card en due">
        <div className="row"><span className="label">Weekly check-in</span><span className="st-pro">PRO</span></div>
        <div className="en-big"><b className="num en-blur" aria-hidden="true">0,000</b><span>kcal a day · this week’s burn is ready</span></div>
        <p className="en-lead">Your log and the scale have a new number, and a new target to match.</p>
        <button className="btn" onClick={() => { haptic(); pro.open('adapt') }}>See it with PRO</button>
        <button className="ac-link" onClick={() => choose('skip')}>Skip this week</button>
      </section>
    )
  }

  const up = c.measured > c.current
  return (
    <section className="card en due">
      <div className="row"><span className="label">Weekly check-in</span><span className="en-conf">{c.confidence === 'early' ? 'early read' : c.confidence === 'good' ? 'good data' : 'solid data'}</span></div>
      <div className="en-big"><b className="num">{n(c.measured)}</b><span>kcal a day is what you really burn</span></div>
      <Facts />
      {c.noisy ? (
        <>
          <p className="en-lead">These numbers don’t add up yet: water weight, or days logged in part. Nothing changes this week.</p>
          <button className="btn secondary" onClick={() => choose('skip')}>OK, check again in a week</button>
        </>
      ) : !c.changes ? (
        <>
          <p className="en-lead"><Ic n="check" /> Right on the estimate. Your target stays at <b className="num">{n(c.kcalNow)}</b> kcal.</p>
          <button className="btn secondary" onClick={() => choose('hold')}>Got it</button>
        </>
      ) : (
        <>
          <p className="en-lead">That’s <b className="num">{n(Math.abs(c.diff))}</b> kcal {up ? 'more' : 'less'} than your plan assumed. Pick what to hold:</p>
          {Math.abs(c.raw - c.measured) >= 100 && <p className="hint en-fine">This week alone read {n(c.raw)}. One week is noisy, so the estimate moves part of the way and firms up as weeks add up.</p>}
          <button className="en-opt" onClick={() => choose('pace')}>
            <span><b>{state.profile.goal === 'maintain' ? 'Update my target' : 'Stay on pace'}</b>
              <small>{c.keepPace.eta ? `${tgt} by ~${shortDate(c.keepPace.eta.date)}` : c.keepPace.rate ? rateTxt(c.keepPace.rate) : 'hold your weight'}</small></span>
            <em className="num">{n(c.keepPace.kcal)}<small>kcal</small></em>
          </button>
          {c.keepKcal.ok && (
            <button className="en-opt" onClick={() => choose('kcal')}>
              <span><b>Keep my calories</b>
                <small>{rateTxt(c.keepKcal.rate)}{c.keepKcal.eta ? ` · ${tgt} by ~${shortDate(c.keepKcal.eta.date)}` : ''}</small></span>
              <em className="num">{n(c.keepKcal.kcal)}<small>kcal</small></em>
            </button>
          )}
          <button className="ac-link" onClick={() => choose('skip')}>Not this week</button>
        </>
      )}
      {!pro?.pro && pro?.on && !state.settings?.adaptFree && <p className="hint en-fine">Your first check-in is free. After it, weekly check-ins are part of PRO.</p>}
    </section>
  )
}
