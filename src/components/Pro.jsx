import React, { useEffect, useState } from 'react'
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
  success: null
}

const fmtDate = ms => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const daysLeft = ms => Math.max(0, Math.ceil((ms - Date.now()) / 864e5))

// What's free stays listed first: the point is that logging never moves behind the paywall.
function rows(free) {
  return [
    ['Food logging: search, barcode, quick add', true, true],
    ['Training plan and camera rep counting', true, true],
    ['Streak, calendar, reminders, sync, CSV export', true, true],
    ['Meal photo estimates', `${free?.snaps ?? 3} a day`, '30 a day'],
    ['Ask Beet', `${free?.chats ?? 5} a day`, '60 a day'],
    ['Strength trends', 'top lift', 'every lift']
  ]
}

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
    body = (
      <>
        <div className="pr-top">
          <span className="pr-mark"><i /></span>
          <div>
            <h2 className="pr-h">BeetFit PRO</h2>
            <p className="hint" style={{ margin: 0 }}>Logging stays free, always. PRO is for the AI and the deeper numbers.</p>
          </div>
        </div>
        {reason && REASON[reason] && <p className="pr-why">{REASON[reason]}</p>}

        <div className="pr-table" role="table" aria-label="Free and PRO">
          <div className="pr-tr pr-th" role="row"><span /><span>Free</span><span>PRO</span></div>
          {rows(cfg.free).map(([l, f, p]) => (
            <div className="pr-tr" role="row" key={l}>
              <span>{l}</span>
              <span className={f === true ? 'pr-yes' : ''}>{f === true ? '✓' : f}</span>
              <span className={p === true ? 'pr-yes' : 'pr-up'}>{p === true ? '✓' : p}</span>
            </div>
          ))}
        </div>

        {isNative() ? (
          <p className="hint pr-fine">In-app purchase arrives with the App Store and Google Play release.</p>
        ) : !canBuyHere(cfg) || !pr ? (
          <p className="hint pr-fine">Payments aren’t switched on yet.</p>
        ) : (
          <>
            <div className="pr-plans" role="radiogroup" aria-label="Plan">
              {[['year', pr.year], ['month', pr.month]].map(([id, p]) => (
                <button key={id} role="radio" aria-checked={plan === id} className={'pr-plan' + (plan === id ? ' on' : '')} onClick={() => { haptic(); setPlan(id) }}>
                  <span className="pr-plan-n">{id === 'year' ? 'Yearly' : 'Monthly'}{id === 'year' && save > 0 && <em>−{save}%</em>}</span>
                  <b className="num">{fmtMoney(p)}<small>/{id === 'year' ? 'year' : 'month'}</small></b>
                  {id === 'year' ? <span className="num pr-per">{fmtMoney(p, 12)} a month{save > 0 ? ` · ${save}% less than paying monthly` : ''}</span>
                    : <span className="num pr-per">{fmtMoney(p, 1 / 12)} a year</span>}
                </button>
              ))}
            </div>
            {!signedIn ? (
              <div className="pr-sign">
                <p className="hint" style={{ margin: 0 }}>Sign in first. PRO lives on your account, so it moves with you to a new phone.</p>
                <SignIn onDone={r => account.onSignedIn(r)} />
              </div>
            ) : (
              <button className="btn pr-cta" disabled={busy} onClick={buy}>
                {busy ? 'Opening checkout…' : trial ? `Start ${cfg.trialDays} days free` : `Subscribe · ${fmtMoney(price)}/${per}`}
              </button>
            )}
            <p className="hint pr-fine">
              {trial
                ? `No card now. After ${cfg.trialDays} days PRO just stops, unless you add a card. With a card it’s ${fmtMoney(price)} a ${per}, renewing until you cancel. `
                : `${fmtMoney(price)} a ${per}, renewing until you cancel. `}
              Cancel any time in Settings → PRO. Payments by Stripe.
            </p>
          </>
        )}
        {err && <p className="ac-err">{err}</p>}
        <button className="ac-link" onClick={() => history.back()}>Not now</button>
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
