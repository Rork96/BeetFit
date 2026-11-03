import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { startCheckout, openPortal, canBuyHere, fmtMoney, yearSaving, BILLING_ERR } from '../lib/billing.js'
import { isNative } from '../lib/platform.js'
import { useBackClose } from '../lib/hooks.js'
import { haptic, hapticSuccess } from '../lib/platform.js'
import { SignIn } from './Account.jsx'
import './pro.css'

const REASON = {
  snap: 'That was today’s last free photo estimate.',
  chat: 'That was today’s last free question for Beet.',
  strength: 'Strength trends for every lift are part of PRO.',
  clients: 'Free coaching covers 3 clients. PRO lifts that to 200.',
  welcome: 'Your plan is built. Beet and photo estimates are what keep you on it: try them free first.',
  success: null
}

const HEAD = {
  welcome: 'Your plan is set. Now keep it going.',
  snap: 'Photograph your meals, skip the typing',
  chat: 'A coach in your pocket, all day',
  strength: 'See every lift get stronger',
  clients: 'Coach more people',
  default: 'The plan is free. PRO makes it stick.'
}

// Product demos: what the screens look like, drawn in code. Numbers are examples, labelled as such.
function DemoSnap() {
  return (
    <div className="pr-demo">
      <span className="label">Photo → numbers</span>
      <div className="pd-plate">
        <svg viewBox="0 0 220 120" aria-hidden="true">
          <circle cx="110" cy="64" r="52" className="pd-dish" /><circle cx="110" cy="64" r="40" className="pd-dish in" />
          <ellipse cx="88" cy="62" rx="22" ry="16" fill="#d9a066" /><ellipse cx="128" cy="70" rx="22" ry="17" fill="#f1ecd8" /><circle cx="120" cy="46" r="11" fill="#5f9d45" /><circle cx="134" cy="50" r="8" fill="#4d8a3a" />
          <rect x="63" y="44" width="50" height="36" className="pd-box" /><rect x="102" y="52" width="52" height="38" className="pd-box" /><rect x="106" y="31" width="40" height="30" className="pd-box blue" />
        </svg>
      </div>
      <ul className="pd-items">
        <li><span>Chicken breast</span><b className="num">150 g · 248</b></li>
        <li><span>Rice</span><b className="num">180 g · 234</b></li>
        <li><span>Broccoli</span><b className="num">100 g · 34</b></li>
      </ul>
      <div className="pd-total"><span>Meal</span><b className="num">516 kcal</b></div>
    </div>
  )
}

function DemoBeet() {
  return (
    <div className="pr-demo">
      <span className="label">Ask Beet</span>
      <div className="pd-chat">
        <p className="me">I skipped lunch. What should dinner be?</p>
        <p className="beet">You have <b className="num">1,150 kcal</b> and <b className="num">62 g</b> protein left today. Chicken, rice and greens gets you about 600 kcal and 50 g protein. Add a yogurt later for the rest.</p>
      </div>
      <p className="pd-note">Knows your plan, targets and today’s log.</p>
    </div>
  )
}

function DemoTrend() {
  const lines = [['#e0fd90', '4,46 40,40 76,34 112,28 148,22 184,12'], ['#7d70f6', '4,50 40,48 76,42 112,40 148,33 184,30'], ['#6fb6ff', '4,54 40,52 76,50 112,46 148,44 184,38']]
  return (
    <div className="pr-demo">
      <span className="label">Strength · 12 weeks</span>
      <svg className="pd-chart" viewBox="0 0 190 64" aria-hidden="true">
        <path d="M0 63h190M0 32h190" className="pd-grid" />
        {lines.map(([c, pts]) => <polyline key={c} points={pts} fill="none" stroke={c} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />)}
      </svg>
      <ul className="pd-items">
        <li><span>Squat</span><b className="num pd-up">+12 kg</b></li>
        <li><span>Bench press</span><b className="num pd-up">+7.5 kg</b></li>
        <li><span>Row</span><b className="num pd-up">+5 kg</b></li>
      </ul>
    </div>
  )
}

const fmtDate = ms => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const daysLeft = ms => Math.max(0, Math.ceil((ms - Date.now()) / 864e5))

export default function ProSheet({ pro, account, reason, onClose }) {
  useBackClose(true, onClose)
  const cfg = pro.config
  const st = pro.status
  const [plan, setPlan] = useState('year')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [welcome, setWelcome] = useState(reason === 'success')
  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = '' } }, [])
  useEffect(() => {
    if (reason !== 'success') return
    pro.afterCheckout().then(s => { if (s?.pro) hapticSuccess(); else setWelcome(false) })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const pr = cfg?.prices
  const trial = !st?.trialUsed
  const save = yearSaving(pr)
  const price = plan === 'year' ? pr?.year : pr?.month
  const per = plan === 'year' ? 'year' : 'month'
  const signedIn = !!account?.value
  const signRef = useRef(null)

  const buy = async () => {
    haptic('medium'); setErr(''); setBusy(true)
    const r = await startCheckout(plan)
    if (!r.url) { setBusy(false); setErr(BILLING_ERR[r.error] || 'Couldn’t open checkout. Try again.') }
  }
  const manage = async () => {
    haptic(); setErr(''); setBusy(true)
    const r = await openPortal()
    if (!r.url) { setBusy(false); setErr(BILLING_ERR[r.error] || 'Couldn’t open billing. Try again.') }
  }

  let body
  if (st?.pro || welcome) {
    const store = st?.source === 'appstore' ? 'App Store' : st?.source === 'play' ? 'Google Play' : null
    body = (
      <>
        <motion.div className="pr-badge" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 18 }}><i /></motion.div>
        <h2 className="pr-h">{st?.pro ? 'You have PRO' : 'Finishing up…'}</h2>
        {st?.pro && (
          <div className="pr-state">
            <div><span className="label">Plan</span><b>{st.plan === 'year' ? 'Yearly' : 'Monthly'}</b></div>
            <div><span className="label">{st.state === 'trialing' ? 'Trial' : st.cancelAtEnd ? 'Ends' : 'Renews'}</span>
              <b className="num">{st.state === 'trialing' && st.trialEnd ? `${daysLeft(st.trialEnd)} days left` : st.periodEnd ? fmtDate(st.periodEnd) : '—'}</b></div>
          </div>
        )}
        {st?.state === 'trialing' && (
          <>
            <p className="hint pr-fine">Your trial ends {fmtDate(st.trialEnd)}. With no card on file it simply stops; nothing is charged.</p>
            {pr && st.manage && !store && (
              <div className="pr-keep">
                <p className="pr-fine">Want to keep PRO? Adding a card means <b>{fmtMoney(st.plan === 'year' ? pr.year : pr.month)} is charged on {fmtDate(st.trialEnd)}</b>, then every {st.plan === 'year' ? 'year' : 'month'} until you cancel. Cancel any time here.</p>
                <button className="btn" disabled={busy} onClick={manage}>Add a card · keep PRO</button>
              </div>
            )}
          </>
        )}
        {st?.state === 'past_due' && <p className="ac-err">The last payment didn’t go through. Update your card in Manage; PRO stays on meanwhile.</p>}
        {st?.cancelAtEnd && st?.state !== 'trialing' && <p className="hint pr-fine">Cancelled. PRO stays until {fmtDate(st.periodEnd)}, then your logs carry on as free.</p>}
        {store
          ? <p className="hint pr-fine">Billed by {store}. Manage or cancel it in your {store} subscriptions.</p>
          : st?.manage && <button className="btn secondary" disabled={busy} onClick={manage}>{busy ? 'Opening…' : 'Manage or cancel'}</button>}
        <button className="btn" onClick={() => history.back()}>Done</button>
      </>
    )
  } else if (!cfg?.on) {
    body = <><h2 className="pr-h">BeetFit PRO</h2><p className="hint">PRO isn’t switched on yet. Everything is open for now.</p><button className="btn" onClick={() => history.back()}>OK</button></>
  } else {
    const trialLine = trial ? `Start ${cfg.trialDays} days free` : price ? `Subscribe · ${fmtMoney(price)}/${per}` : 'Subscribe'
    const go = () => { if (!signedIn) { haptic(); signRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }) } else buy() }
    body = (
      <>
        <div className="pr-hero">
          <span className="pr-mark"><i /></span>
          <h2 className="pr-h">{HEAD[reason] || HEAD.default}</h2>
          <p className="pr-sub">Logging, your plan and camera rep counting stay free. PRO adds the parts that do the thinking for you.</p>
        </div>
        {reason && REASON[reason] && <p className="pr-why">{REASON[reason]}</p>}

        <div className="pr-demos" aria-label="What PRO adds">
          <DemoSnap />
          <DemoBeet />
          <DemoTrend />
        </div>
        <p className="pr-eg">Examples with made-up numbers. Swipe →</p>

        <ul className="pr-lim">
          <li><b className="num">{cfg.free?.snaps ?? 3} → 30</b> meal photo estimates a day</li>
          <li><b className="num">{cfg.free?.chats ?? 5} → 60</b> Beet questions a day</li>
          <li><b>All lifts</b> in strength trends, not only the top one</li>
          <li><b className="num">{cfg.free?.clients ?? 3} → 200</b> coaching clients</li>
        </ul>

        {isNative() ? (
          <p className="hint pr-fine">In-app purchase arrives with the App Store and Google Play release.</p>
        ) : !canBuyHere(cfg) ? (
          <p className="hint pr-fine">Payments aren’t switched on yet.</p>
        ) : (
          <>
            {trial && (
              <ol className="pr-tl" aria-label="How the trial works">
                <li><i /><b>Today</b><span>PRO unlocks. No card.</span></li>
                <li><i /><b>Day {cfg.trialDays}</b><span>It stops by itself. Nothing is charged.</span></li>
                <li><i className="opt" /><b>Your call</b><span>Add a card in PRO to keep it.</span></li>
              </ol>
            )}
            <div className="pr-plans" role="radiogroup" aria-label="Plan">
              {[['year', pr?.year], ['month', pr?.month]].map(([id, p]) => (
                <button key={id} role="radio" aria-checked={plan === id} className={'pr-plan' + (plan === id ? ' on' : '')} onClick={() => { haptic(); setPlan(id) }}>
                  <span className="pr-plan-n">{id === 'year' ? 'Yearly' : 'Monthly'}{id === 'year' && save > 0 && <em>−{save}%</em>}</span>
                  {p ? <b className="num">{fmtMoney(p)}<small>/{id === 'year' ? 'year' : 'month'}</small></b> : <b className="num">—</b>}
                  {p && (id === 'year' ? <span className="num pr-per">{fmtMoney(p, 12)} a month</span>
                    : <span className="num pr-per">{fmtMoney(p, 1 / 12)} a year</span>)}
                </button>
              ))}
            </div>
            {!signedIn && (
              <div className="pr-sign" ref={signRef}>
                <p className="hint" style={{ margin: 0 }}>Sign in first. PRO lives on your account, so it moves with you to a new phone.</p>
                <SignIn onDone={r => account.onSignedIn(r)} />
              </div>
            )}
            <p className="hint pr-fine">
              {!price ? 'Billed monthly or yearly, renewing until you cancel. ' : trial
                ? `With a card it’s ${fmtMoney(price)} a ${per}, renewing until you cancel. `
                : `${fmtMoney(price)} a ${per}, renewing until you cancel. `}
              Cancel any time in Settings → PRO. Payments by Stripe.
            </p>
            <div className="pr-cta-bar">
              <button className="btn pr-cta" disabled={busy} onClick={go}>{busy ? 'Opening checkout…' : trialLine}</button>
            </div>
          </>
        )}
        {err && <p className="ac-err">{err}</p>}
        <button className="ac-link" onClick={() => history.back()}>{reason === 'welcome' ? 'Continue free' : 'Not now'}</button>
      </>
    )
  }

  return createPortal(
    <>
      <div className="sheet-back" onClick={() => history.back()} />
      <div className="sheet pr" role="dialog" aria-label="BeetFit PRO">{body}</div>
    </>,
    document.body
  )
}

// Settings card: one line of status and the way in.
export function ProCard({ pro, onOpen }) {
  if (!pro.on) return null
  const st = pro.status
  const line = !st?.pro ? (st?.trialUsed ? 'Unlimited photo estimates, more Beet, strength trends.' : `${pro.config?.trialDays || 14} days free, no card needed.`)
    : st.state === 'trialing' ? `Trial · ${daysLeft(st.trialEnd)} days left`
      : st.cancelAtEnd ? `Ends ${fmtDate(st.periodEnd)}`
        : `${st.plan === 'year' ? 'Yearly' : 'Monthly'} · renews ${st.periodEnd ? fmtDate(st.periodEnd) : ''}`
  return (
    <section className="card pr-card">
      <div className="row">
        <div><span className="label">BeetFit PRO</span><p className="pr-card-l">{line}</p></div>
        <button className={'btn small' + (st?.pro ? ' secondary' : '')} onClick={() => { haptic(); onOpen() }}>{st?.pro ? 'Manage' : 'See PRO'}</button>
      </div>
    </section>
  )
}
