import React, { useEffect, useState } from 'react'
import BeetMascot from './BeetMascot.jsx'
import Ic from './Icons.jsx'
import { MacroRing } from './Nutri.jsx'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { startCheckout, openPortal, startTrial, canBuyHere, fmtMoney, yearSaving, BILLING_ERR, usedSoFar, useUsage } from '../lib/billing.js'
import { isNative } from '../lib/platform.js'
import { useBackClose } from '../lib/hooks.js'
import { haptic, hapticSuccess } from '../lib/platform.js'
import { SignIn } from './Account.jsx'
import { Verified } from './Coach.jsx'
import { track } from '../lib/track.js'
import { TOUR } from '../lib/tour.js'
import './pro.css'
import './energy.css'

const REASON = {
  snap: 'That was today’s last free photo estimate.',
  chat: 'That was today’s last free question for Beet.',
  strength: 'Strength trends for every lift are part of PRO.',
  clients: 'Free coaching covers 3 clients. PRO lifts that to 200.',
  video: 'Your own exercises are free. Demo videos on them are part of PRO.',
  welcome: 'Your plan is built. Beet and photo estimates are what keep you on it: try them free first.',
  adapt: 'Your first check-in was free. PRO re-measures your burn every week and moves your calories with it.',
  ended: null,
  success: null
}

const HEAD = {
  welcome: 'Your plan is set. Now keep it going.',
  adapt: 'Calories that follow your body',
  ended: 'Your 14 days of PRO are up',
  snap: 'Photograph your meals, skip the typing',
  chat: 'A coach in your pocket, all day',
  strength: 'See every lift get stronger',
  clients: 'Coach more people',
  video: 'Show the move, not just the name',
  default: 'The plan is free. PRO keeps it honest.'
}

// The photo card is drawn in code (a real photo result needs a real photo); the rest are real screens, below.
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
      <div className="pd-ring">
        <MacroRing kcal={516} p={53} c={57} f={6} size={84} />
        <ul className="pd-items">
          <li><span>Chicken breast</span><b className="num">248</b></li>
          <li><span>Rice</span><b className="num">234</b></li>
          <li><span>Broccoli</span><b className="num">34</b></li>
        </ul>
      </div>
    </div>
  )
}

// The weekly check-in, drawn with the same classes as the real card (components/Energy.jsx). Sample numbers.
function DemoCheck() {
  return (
    <div className="pr-demo pr-check">
      <span className="label">Weekly check-in</span>
      <div className="en-big"><b className="num">2,280</b><span>kcal a day is what you really burn</span></div>
      <div className="en-facts">
        <div><b className="num">2,100</b><small>kcal eaten, average</small></div>
        <div><b className="num">−0.2</b><small>kg a week on the scale</small></div>
        <div><b className="num">2,578</b><small>the formula’s guess</small></div>
      </div>
      <div className="en-opt"><span><b>Stay on pace</b><small>82 kg by ~Mar 8</small></span><em className="num">1,730<small>kcal</small></em></div>
      <p className="pc-cap">Every week your food log and the scale re-set your calories. No more guessing why the scale stopped.</p>
    </div>
  )
}

// Coach mode, with the real "Verified training" card and the push a coach gets. Sample data, relative dates.
function DemoCoach() {
  const d = n => { const t = new Date(); t.setDate(t.getDate() - n); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}` }
  const S = (reps, w, auto) => ({ reps, w, ...(auto && { auto: true }) })
  const sessions = [{
    date: d(0), sets: 6, cam: 5,
    ex: [
      { name: 'Goblet squat', cam: 3, form: 84, sets: [S(10, 16, 1), S(10, 16, 1), S(9, 16, 1)] },
      { name: 'Push-up', cam: 2, form: 61, sets: [S(8, 0, 1), S(6, 0, 1), S(6, 0)] }
    ]
  }]
  return (
    <div className="pr-demo pr-coach">
      <span className="label">Coach mode</span>
      <div className="pc-push" aria-label="Notification: Anna trained, Lower, 9 of 9 sets, 7 camera-verified, form 82%">
        <i><Ic n="beet" className="solid" /></i>
        <span><b>Anna trained</b><small className="num">Lower · 9/9 sets · 7 camera-verified · form 82%</small></span>
        <em>now</em>
      </div>
      <Verified sessions={sessions} week={{ sets: 16, camSets: 11 }} />
      <p className="pc-cap">Your coach sees what the camera counted, not just what you typed.</p>
    </div>
  )
}

// Real screens from the app, shot with sample data (see public/pro). Same pixels the person gets.
function Shot({ src, label, w, h }) {
  return (
    <figure className="pr-demo pr-shot">
      <span className="label">{label}</span>
      <img src={src} width={w} height={h} alt={label} loading="lazy" />
    </figure>
  )
}

// The 15-second tour: plays muted in the strip, tap for sound.
function TourCard() {
  return (
    <figure className="pr-demo pr-shot pr-tour">
      <span className="label">15-second tour</span>
      <video src={TOUR.src} poster={TOUR.poster} muted playsInline loop autoPlay preload="none" controls width={720} height={1280} />
    </figure>
  )
}

// Free and PRO side by side, with "You" on the column that applies now. Numbers come from /api/billing/config.
const PRO_LIM = { snaps: 30, chats: 60, clients: 200 }
export function Limits({ cfg, current }) {
  const rows = [
    ['train', 'Plan, logging, camera reps', '✓', '✓'],
    ['cam', 'Meal photos a day', cfg?.free?.snaps ?? 3, PRO_LIM.snaps],
    ['beet', 'Beet questions a day', cfg?.free?.chats ?? 5, PRO_LIM.chats],
    ['target', 'Weekly check-in: real burn → new target', '1st one', 'Weekly'],
    ['progress', 'Strength trends', 'Top lift', 'All lifts'],
    ['people', 'Add your trainer', '✓', '✓'],
    ['people', 'Coach: clients', cfg?.free?.clients ?? 3, PRO_LIM.clients],
    ['cam', 'Coach: camera form scores', '—', '✓'],
  ]
  return (
    <div className={'pr-cmp' + (current ? ' cur-' + current : '')} role="table" aria-label="Free and PRO compared">
      <div className="pr-cmp-h" role="row"><span role="columnheader" />
        <span role="columnheader" className="free">Free{current === 'free' && <i className="pr-you">You</i>}</span>
        <span role="columnheader" className="pro">PRO{current === 'pro' && <i className="pr-you">You</i>}</span></div>
      {rows.map(([ic, l, f, p]) => (
        <div className="pr-cmp-r" role="row" key={l}>
          <span role="cell"><Ic n={ic} className="solid" />{l}</span>
          <span role="cell" className={'num' + (f === '✓' ? ' yes' : '')}>{f}</span>
          <span role="cell" className={'num pro' + (p === '✓' ? ' yes' : '')}>{p}</span>
        </div>
      ))}
    </div>
  )
}

// Today's meters: what is used of the daily photo and Beet amounts. Before the first request of the day the server
// hasn't counted anything, so the limits alone are shown.
export function UsageToday({ cfg, isPro }) {
  const u = useUsage()
  const lim = k => u?.[k]?.limit ?? (isPro ? PRO_LIM[k] : cfg?.free?.[k] ?? (k === 'snaps' ? 3 : 5))
  const used = k => u?.[k]?.used ?? 0
  const rows = [['snaps', 'cam', 'Meal photos'], ['chats', 'beet', 'Beet questions']]
  return (
    <div className="pr-use" aria-label="Used today">
      {rows.map(([k, ic, l]) => {
        const L = lim(k), n = Math.min(used(k), L)
        return (
          <div key={k} className={'pr-use-r' + (n >= L ? ' out' : '')}>
            <span className="pr-use-l"><Ic n={ic} className="solid" />{l} today</span>
            <b className="num">{n}<small> of {L}</small></b>
            <i className="pr-use-bar"><i style={{ transform: `scaleX(${L ? n / L : 0})` }} /></i>
          </div>
        )
      })}
      <p className="hint pr-use-note">Resets at midnight UTC. Plan, logging, camera reps and reminders have no limit.</p>
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
  useEffect(() => { track('paywall_view') }, [])
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

  const beginTrial = async () => {
    haptic('medium'); setErr(''); setBusy(true)
    const r = await startTrial()
    if (r.ok) { hapticSuccess(); await pro.refresh(); setBusy(false); setWelcome(true) }
    else { setBusy(false); setErr(BILLING_ERR[r.error] || 'Couldn’t start the trial. Try again.') }
  }
  // Checkout and the portal replace this page. Back from Stripe the browser restores it frozen mid-"Opening checkout…" (bfcache),
  // and a cancelled navigation leaves it there too, so un-stick the button in both cases.
  useEffect(() => {
    const back = e => { if (e.persisted) setBusy(false) }
    window.addEventListener('pageshow', back)
    return () => window.removeEventListener('pageshow', back)
  }, [])
  const buy = async () => {
    haptic('medium'); setErr(''); setBusy(true)
    const r = await startCheckout(plan)
    if (!r.url) { setBusy(false); setErr(BILLING_ERR[r.error] || 'Couldn’t open checkout. Try again.') }
    else setTimeout(() => setBusy(false), 8000)
  }
  const manage = async () => {
    haptic(); setErr(''); setBusy(true)
    const r = await openPortal()
    if (!r.url) { setBusy(false); setErr(BILLING_ERR[r.error] || 'Couldn’t open billing. Try again.') }
    else setTimeout(() => setBusy(false), 8000)
  }

  const planPicker = (
    <div className="pr-plans" role="radiogroup" aria-label="Plan">
      {[['year', pr?.year], ['month', pr?.month]].map(([id, p]) => (
        <button key={id} role="radio" aria-checked={plan === id} className={'pr-plan' + (plan === id ? ' on' : '') + (id === 'year' ? ' best' : '')} onClick={() => { haptic(); setPlan(id) }}>
          {id === 'year' && save > 0 && <span className="pr-ribbon">Save {save}%</span>}
          <span className="pr-plan-n"><i className="pr-radio" />{id === 'year' ? 'Yearly' : 'Monthly'}</span>
          {p ? <b className="num">{fmtMoney(p, id === 'year' ? 12 : undefined)}<small>/mo</small></b> : <b className="num">—</b>}
          {p && <span className="num pr-per">{id === 'year' ? `${fmtMoney(p)} billed yearly` : 'billed monthly'}</span>}
        </button>
      ))}
    </div>
  )

  let body
  if (st?.pro || welcome) {
    const store = st?.source === 'appstore' ? 'App Store' : st?.source === 'play' ? 'Google Play' : null
    body = (
      <>
        <motion.div className="pr-beet" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 18 }}><BeetMascot mood={st?.pro ? 'cheer' : 'think'} size={96} bubble="right" /></motion.div>
        <h2 className="pr-h">{st?.pro ? 'You have PRO' : 'Finishing up…'}</h2>
        {st?.pro && (
          <div className="pr-state">
            <div><span className="label">Plan</span><b>{st.source === 'trial' ? 'Free trial' : st.plan === 'year' ? 'Yearly' : 'Monthly'}</b></div>
            <div><span className="label">{st.state === 'trialing' ? 'Trial' : st.cancelAtEnd ? 'Ends' : 'Renews'}</span>
              <b className="num">{st.state === 'trialing' && st.trialEnd ? `${daysLeft(st.trialEnd)} days left` : st.periodEnd ? fmtDate(st.periodEnd) : '—'}</b></div>
          </div>
        )}
        {st?.pro && (
          <div className="pr-lim">
            <span className="label">Your daily limits</span>
            <UsageToday cfg={cfg} isPro />
            {st.state === 'trialing' && st.trialEnd && <p className="hint pr-fine">After {fmtDate(st.trialEnd)} the Free column applies: {cfg?.free?.snaps ?? 3} meal photos and {cfg?.free?.chats ?? 5} Beet questions a day, the first check-in only.</p>}
            <Limits cfg={cfg} current="pro" />
            {st.state === 'trialing' && (
              <div className="pr-demos pr-demos-sm" aria-label="What PRO does">
                <TourCard />
                <Shot src="/pro/checkin.webp" label="Weekly check-in" w={780} h={1185} />
                <Shot src="/pro/beet.webp" label="Ask Beet" w={780} h={460} />
              </div>
            )}
          </div>
        )}
        {st?.state === 'trialing' && (
          <>
            <p className="hint pr-fine">Your trial ends {fmtDate(st.trialEnd)}. {st.source === 'trial' ? 'No card was taken, so nothing can be charged. It just stops.' : 'With no card on file it simply stops; nothing is charged.'}</p>
            {st.source === 'trial' && canBuyHere(cfg) && (
              <div className="pr-keep">
                <p className="pr-fine">Want to keep PRO after {fmtDate(st.trialEnd)}? {pr ? `${fmtMoney(pr.year)} a year or ${fmtMoney(pr.month)} a month` : 'Yearly or monthly'}, renewing until you cancel.</p>
                {planPicker}
                <button className="btn" disabled={busy} onClick={buy}>{busy ? 'Opening checkout…' : 'Subscribe · keep PRO'}</button>
              </div>
            )}
            {pr && st.manage && !store && (
              <div className="pr-keep">
                <p className="pr-fine">Want to keep PRO? Adding a card means <b>{fmtMoney(st.plan === 'year' ? pr.year : pr.month)} is charged on {fmtDate(st.trialEnd)}</b>, then every {st.plan === 'year' ? 'year' : 'month'} until you cancel. Cancel any time here.</p>
                <button className="btn" disabled={busy} onClick={manage}>Add a card · keep PRO</button>
              </div>
            )}
          </>
        )}
        {st?.pro && st.source === 'stripe' && !signedIn && (
          <div className="pr-keep">
            <p className="pr-fine"><b>Save PRO to an account.</b> Right now it lives on this phone only. Sign in with the email you paid with and it follows you to a new phone.</p>
            <SignIn onDone={r => account.onSignedIn(r)} />
          </div>
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
        <div className="pr-hero">
          <span className="pr-beet sm"><BeetMascot mood="happy" size={72} bubble="right" lines={['PRO does the thinking.', '14 days on me.', 'Try it, cancel any time.']} /><i className="pr-crown">PRO</i></span>
          <h2 className="pr-h">{HEAD[reason] || HEAD.default}</h2>
          <p className="pr-sub">Logging, your plan and camera rep counting stay free. PRO adds the parts that do the thinking for you.</p>
        </div>
        {reason && REASON[reason] && <p className="pr-why">{REASON[reason]}</p>}
        {reason === 'ended' && <p className="pr-why">{usedLine() ? `In those two weeks: ${usedLine()}. ` : ''}Your plan, logging and camera rep counting stay free. PRO keeps the parts that did the thinking.</p>}

        <div className="pr-demos" aria-label="What PRO adds">
          {(reason === 'clients' || reason === 'video') && <DemoCoach />}
          {reason !== 'snap' && reason !== 'chat' && reason !== 'clients' && reason !== 'video' && <DemoCheck />}
          <TourCard />
          <DemoSnap />
          {(reason === 'snap' || reason === 'chat') && <DemoCheck />}
          <Shot src="/pro/checkin.webp" label="Weekly check-in" w={780} h={1185} />
          {reason !== 'clients' && reason !== 'video' && <DemoCoach />}
          <Shot src="/pro/beet.webp" label="Ask Beet" w={780} h={460} />
          <Shot src="/pro/trend.webp" label="Strength trends" w={780} h={740} />
          <Shot src="/pro/food.webp" label="Every meal, counted" w={780} h={560} />
        </div>
        <p className="pr-eg">App screens and the tour use sample data; the photo and coach cards are illustrations. Swipe →</p>

        <span className="label pr-lim-l">Your daily limits now</span>
        <UsageToday cfg={cfg} isPro={false} />

        <Limits cfg={cfg} current="free" />

        {isNative() ? (
          <p className="hint pr-fine">In-app purchase arrives with the App Store and Google Play release.</p>
        ) : trial ? (
          <>
            <ol className="pr-tl" aria-label="How the trial works">
              <li><i><Ic n="check" /></i><b>Today</b><span>PRO unlocks. No account, no card.</span></li>
              <li><i><Ic n="timer" /></i><b>Day {cfg.trialDays}</b><span>It stops by itself. Nothing is charged.</span></li>
              <li><i className="opt"><Ic n="target" /></i><b>Your call</b><span>Keep it, or stay free. Your logs and plan stay.</span></li>
            </ol>
            <p className="hint pr-fine">
              {pr ? `Keeping PRO later: ${fmtMoney(pr.year)} a year or ${fmtMoney(pr.month)} a month` : 'Keeping PRO later is yearly or monthly'}, renewing until you cancel. Cancel any time in Settings → PRO.
            </p>
            <div className="pr-cta-bar">
              <button className="btn pr-cta" disabled={busy} onClick={beginTrial}>{busy ? 'Starting…' : `Start ${cfg.trialDays} days free`}</button>
              <p className="pr-cta-sub"><Ic n="lock" className="solid" />No card · stops by itself</p>
            </div>
          </>
        ) : !canBuyHere(cfg) ? (
          <p className="hint pr-fine">Payments aren’t switched on yet.</p>
        ) : (
          <>
            {planPicker}
            <p className="hint pr-fine">
              {!price ? 'Billed monthly or yearly, renewing until you cancel. ' : `${fmtMoney(price)} a ${per}, renewing until you cancel. `}
              Cancel any time in Settings → PRO. Payments by Stripe; no account needed to pay.
            </p>
            <div className="pr-cta-bar">
              <button className="btn pr-cta" disabled={busy} onClick={buy}>{busy ? 'Opening checkout…' : (price ? `Subscribe · ${fmtMoney(price)}/${per}` : 'Subscribe')}</button>
            </div>
          </>
        )}
        {err && <p className="ac-err">{err}</p>}
        <button className="ac-link" onClick={() => history.back()}>{reason === 'welcome' ? 'Continue free' : 'Not now'}</button>
        <p className="pr-legal"><a href="/terms" target="_blank" rel="noopener">Terms of Use</a> · <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a></p>
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

// "18 meal photos and 34 answers from Beet": what this device actually used.
export function usedLine() {
  const u = usedSoFar(), parts = []
  if (u.snaps > 0) parts.push(`${u.snaps} meal ${u.snaps === 1 ? 'photo' : 'photos'} counted`)
  if (u.chats > 0) parts.push(`${u.chats} ${u.chats === 1 ? 'answer' : 'answers'} from Beet`)
  return parts.join(' and ')
}

// Today: where the free trial stands. Quiet on the first days, a real card in the last three, one note when it's over.
const flag = k => { try { return localStorage.getItem(k) } catch { return null } }
const setFlag = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch { /* ignore */ } }
export function TrialNote({ pro, quiet }) {
  const [, tick] = useState(0)
  const st = pro?.status
  if (!pro?.on || !st) return null
  const again = () => tick(n => n + 1)
  const trialing = st.pro && st.state === 'trialing' && st.source === 'trial'
  const left = trialing && st.trialEnd ? daysLeft(st.trialEnd) : null
  const today = new Date().toDateString()
  if (trialing && left > 3) {
    if (!flag('beetfit_trial_note')) return null
    return (
      <div className="card tn">
        <span className="tn-badge">PRO</span>
        <div className="tn-t"><b>PRO is on for {left} days, free</b><span className="hint">No card taken, and it stops by itself.</span></div>
        <button className="td-x" aria-label="OK" onClick={() => { haptic(); setFlag('beetfit_trial_note', null); again() }}>✕</button>
      </div>
    )
  }
  if (trialing) {
    if (flag('beetfit_trial_snooze') === today) return null
    const used = usedLine()
    return (
      <div className="card tn end">
        <div className="row"><span className="tn-badge">PRO</span><button className="td-x" aria-label="Later" onClick={() => { haptic(); setFlag('beetfit_trial_snooze', today); again() }}>✕</button></div>
        <div className="tn-t"><b>{left <= 1 ? 'PRO ends tomorrow' : `PRO ends in ${left} days`}</b>
          <span className="hint">{used ? `So far: ${used}. ` : ''}Nothing is charged when it stops. Your plan and logs stay.</span></div>
        <button className="btn small" onClick={() => { haptic(); pro.open() }}>Keep PRO</button>
      </div>
    )
  }
  if (!quiet && !st.pro && st.trialUsed && flag('beetfit_trial_over') !== '1' && (st.source === 'trial' || st.state === 'expired' || !st.source)) {
    return (
      <div className="card tn end">
        <div className="row"><span className="tn-badge off">PRO</span><button className="td-x" aria-label="Dismiss" onClick={() => { haptic(); setFlag('beetfit_trial_over', '1'); again() }}>✕</button></div>
        <div className="tn-t"><b>Your free PRO days are over</b><span className="hint">Logging, your plan and camera reps carry on free. Photo estimates and Beet are back to the daily free amount.</span></div>
        <button className="btn small secondary" onClick={() => { haptic(); setFlag('beetfit_trial_over', '1'); pro.open('ended') }}>See what PRO keeps</button>
      </div>
    )
  }
  return null
}

// Settings card: one line of status and the way in.
export function proLine(pro) {
  const st = pro.status
  const f = pro.config?.free || {}
  const freeLim = `Free: ${f.snaps ?? 3} meal photos and ${f.chats ?? 5} Beet questions a day`
  const proLim = `${PRO_LIM.snaps} photos and ${PRO_LIM.chats} Beet questions a day`
  return !st?.pro ? (st?.trialUsed ? `${freeLim}. PRO: ${proLim}, weekly check-ins, all strength trends.` : `${freeLim}. ${pro.config?.trialDays || 14} days of PRO free, no card.`)
    : st.state === 'trialing' ? `Trial · ${daysLeft(st.trialEnd)} days left · ${proLim}`
      : st.cancelAtEnd ? `Ends ${fmtDate(st.periodEnd)} · ${proLim}`
        : `${st.plan === 'year' ? 'Yearly' : 'Monthly'} · renews ${st.periodEnd ? fmtDate(st.periodEnd) : ''} · ${proLim}`
}

export function ProCard({ pro, onOpen }) {
  if (!pro.on) return null
  const st = pro.status
  const line = proLine(pro)
  return (
    <section className={'card pr-card' + (st?.pro ? '' : ' sell')}>
      <div className="row">
        <BeetMascot size={46} mood={st?.pro ? 'cheer' : 'happy'} bubble="right" />
        <div style={{ flex: 1, minWidth: 0 }}><span className="label">BeetFit PRO</span><p className="pr-card-l">{line}</p>
          {!st?.pro && <span className="pr-card-ic"><Ic n="cam" className="solid" /><Ic n="beet" className="solid" /><Ic n="progress" className="solid" /></span>}</div>
        <button className={'btn small' + (st?.pro ? ' secondary' : '')} onClick={() => { haptic(); onOpen() }}>{st?.pro ? 'Manage' : 'See PRO'}</button>
      </div>
    </section>
  )
}
