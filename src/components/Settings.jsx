import React, { useEffect, useState } from 'react'
import { HabitsSetup } from './Habits.jsx'
import { GOALS, ACTIVITY_LEVELS, minTargetKg, targetNote } from '../lib/calories.js'
import { applyMotionLevel, getMotionLevel } from '../lib/motion.js'
import { voiceEnabled, setVoiceEnabled, speak, unlockVoice } from '../lib/voice.js'
import { exportState, clearState } from '../lib/store.js'
import { downloadCSV } from '../lib/foods.js'
import { haptic } from '../lib/platform.js'
import { KG_TO_LB, GLASS_SIZES, glassMl, fmtWater } from '../lib/day.js'
import { DEFAULT_INTAKE } from '../lib/program.js'
import { rebuildKeep } from '../lib/myex.js'
import { TrainingCard } from './TrainSetup.jsx'
import { createPairCode, claimPairCode, leaveSync, mergeStates } from '../lib/sync.js'
import { YourCoachCard, CoachModeCard, CoachHome } from './Coach.jsx'
import { useBackClose } from '../lib/hooks.js'
import { planEvents, weekPlanOf, DOW } from '../lib/plans.js'
import Ic from './Icons.jsx'
import './settings.css'
import { AccountCard } from './Account.jsx'
import { cachedAccount, getMailRem, setMailRem, MAIL_ERR } from '../lib/account.js'
import { proLine } from './Pro.jsx'
import { REMINDERS, remindersOf, pushSupport, pushOn, enablePush, disablePush, testPush, PUSH_ERR, permission } from '../lib/push.js'

const VERSION = '0.36.1'

// Settings is a short list of groups (the iOS / Android pattern): each row opens its own page,
// so the root fits on one screen and the version sits at the bottom of it.
const PAGES = {
  profile: 'Profile & goal', training: 'Training', food: 'Food & water', reminders: 'Reminders',
  workout: 'Workout & camera', general: 'General', coach: 'Coach', sync: 'Sync & devices', account: 'Account', data: 'Your data'
}

export default function Settings({ state, update, sync, coach, account, pro, openChat, startCoach, focusCoach, page: startPage = null, onClose }) {
  const [coachHome, setCoachHome] = useState(!!startCoach)
  useBackClose(coachHome, () => setCoachHome(false))
  const [page, setPage] = useState(startPage || (focusCoach ? 'coach' : null))
  useBackClose(!!page, () => setPage(null))
  const s = state.settings || {}
  const p = state.profile
  const [motion, setMotion] = useState(getMotionLevel())
  const [voice, setVoice] = useState(voiceEnabled())
  const [armReset, setArmReset] = useState(false)
  const [poseFull, setPoseFull] = useState(() => { try { return localStorage.getItem('bf_pose_model') === 'full' } catch { return false } })
  const lb = s.units === 'lb'

  const setS = patch => update(prev => ({ settings: { ...(prev.settings || {}), ...patch } }))
  const setP = patch => update(prev => ({ profile: { ...prev.profile, ...patch } }))
  const shownTarget = lb ? +(p.targetKg * KG_TO_LB).toFixed(1) : p.targetKg
  const open = id => { haptic(); setPage(id); window.scrollTo(0, 0) }

  if (page) {
    return (
      <div className="screen st-page">
        <header className="screen-top">
          <button className="td-icon" onClick={() => history.back()} aria-label="Back to Settings">←</button>
          <h2>{PAGES[page]}</h2>
          <span style={{ width: 44 }} />
        </header>
        <div className="page stk" style={{ paddingTop: 4 }}>
          {page === 'profile' && (
            <section className="card">
              <label>Name<input value={s.name || ''} placeholder="What should we call you?" onChange={e => setS({ name: e.target.value.slice(0, 24) })} /></label>
              <label>Goal</label>
              <div className="chips wrap">
                {GOALS.map(g => (
                  <button key={g.id} className={'chip' + (p.goal === g.id ? ' on' : '')} onClick={() => { haptic(); update(prev => ({ profile: { ...prev.profile, goal: g.id }, program: rebuildKeep(g.id, prev.intake || DEFAULT_INTAKE, prev.program, prev.myEx) })) }}>{g.label}</button>
                ))}
              </div>
              <p className="hint" style={{ margin: 0 }}>Changing the goal rebuilds your plan. Exercises you added by hand stay.</p>
              <label>Target weight, {lb ? 'lb' : 'kg'}
                <input type="number" inputMode="decimal" value={shownTarget}
                  onChange={e => { const v = +e.target.value; if (v) setP({ targetKg: lb ? Math.round((v / KG_TO_LB) * 2) / 2 : v }) }} />
              </label>
              {p.goal === 'lose' && p.targetKg < minTargetKg(p.heightCm) && <p className="hint" role="alert" style={{ margin: 0, color: 'var(--warn)' }}>A weight-loss target needs a healthy weight, BMI 18.5 or more: about {lb ? +(minTargetKg(p.heightCm) * KG_TO_LB).toFixed(0) + ' lb' : minTargetKg(p.heightCm) + ' kg'} at your height.</p>}
              {targetNote(p) && <p className="hint" style={{ margin: 0 }}>{targetNote(p)}</p>}
              <label>Activity
                <select value={p.activity} onChange={e => setP({ activity: e.target.value })}>
                  {ACTIVITY_LEVELS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
              </label>
            </section>
          )}

          {page === 'training' && <TrainingCard state={state} update={update} />}

          {page === 'food' && (
            <section className="card">
              <Row label="Water target">
                <div className="fc-step mini">
                  <button onClick={() => setS({ waterTarget: Math.max(4, (s.waterTarget || 8) - 1) })} aria-label="Less">−</button>
                  <span className="num">{s.waterTarget || 8}<small>glasses</small></span>
                  <button onClick={() => setS({ waterTarget: Math.min(16, (s.waterTarget || 8) + 1) })} aria-label="More">+</button>
                </div>
              </Row>
              <div className="st-block">
                <span className="st-block-l">Glass size</span>
                <Seg value={glassMl(state)} options={GLASS_SIZES.map(n => [n, lb ? `${+(n / 29.5735).toFixed(0)} oz` : `${n} ml`])} onChange={v => setS({ glassMl: v })} />
                <p className="hint" style={{ margin: 0 }}>Daily goal: {fmtWater(s.waterTarget || 8, state)}</p>
              </div>
              <Row label="Eat to your training days" hint="Training days get a little more food, rest days a little less; the week adds up the same. Uses your training days.">
                <Toggle on={s.cycleFood !== false} onChange={v => setS({ cycleFood: v })} />
              </Row>
              {state.coach?.override && <p className="hint" style={{ margin: 0 }}>Your coach set your calories and protein, so they stay the same every day.</p>}
            </section>
          )}

          {page === 'reminders' && <><RemindersCard state={state} update={update} sync={sync} account={account?.value} /><HabitsSetup state={state} update={update} /></>}

          {page === 'workout' && (
            <section className="card">
              <Row label="Voice coach" hint="Counts the last reps and calls rest">
                <Toggle on={voice} onChange={v => { unlockVoice(); setVoice(v); setVoiceEnabled(v); if (v) speak('Voice coach on') }} />
              </Row>
              <Row label="Accurate tracking" hint="Bigger pose model: steadier counts, a bit slower on older phones">
                <Toggle on={poseFull} onChange={v => { setPoseFull(v); try { localStorage.setItem('bf_pose_model', v ? 'full' : 'lite') } catch {} }} />
              </Row>
              <p className="hint" style={{ margin: 0 }}>Camera video is processed on this phone and never uploaded.</p>
            </section>
          )}

          {page === 'general' && (
            <section className="card">
              <Row label="Units">
                <Seg value={s.units || 'kg'} options={[['kg', 'kg'], ['lb', 'lb']]} onChange={v => setS({ units: v })} />
              </Row>
              <Row label="Streak" hint="Off hides the streak, milestones and the evening streak nudge. Your logs stay the same.">
                <Toggle on={s.streak !== false} onChange={v => setS({ streak: v })} />
              </Row>
              <Row label="Animation" hint="Auto follows your phone's reduce-motion setting">
                <Seg value={motion} options={[['auto', 'Auto'], ['full', 'Full'], ['lite', 'Lite'], ['off', 'Off']]}
                  onChange={v => { setMotion(v); applyMotionLevel(v) }} />
              </Row>
            </section>
          )}

          {page === 'coach' && (
            <>
              {coach && <YourCoachCard coach={coach} syncOn={sync?.on} onChat={openChat} />}
              <CoachModeCard onOpen={() => setCoachHome(true)} focus={focusCoach} />
            </>
          )}

          {page === 'sync' && sync && <SyncCard sync={sync} update={update} />}

          {page === 'account' && account && <AccountCard account={account} />}

          {page === 'data' && (
            <section className="card">
              <p className="hint">{account?.value ? 'Stored on this device and in your BeetFit account.' : sync?.on ? 'Stored on this device and backed up to BeetFit sync.' : 'Everything is stored on this device.'} Camera video never leaves it. Meal photos are sent to Google Gemini only when you tap the shutter.</p>
              <div className="grid2">
                <button className="btn secondary" onClick={() => { haptic(); downloadCSV(state) }}>Export CSV</button>
                <button className="btn secondary" onClick={() => { haptic(); exportState(state) }}>Export JSON</button>
              </div>
              <p className="hint" style={{ margin: 0 }}>Free, always. CSV opens in Sheets or Excel: every meal, set, weigh-in and glass of water.</p>
              <button className={'btn ' + (armReset ? 'danger' : 'secondary')}
                onClick={() => {
                  haptic('medium')
                  if (!armReset) { setArmReset(true); setTimeout(() => setArmReset(false), 3000); return }
                  const done = () => { clearState(); location.reload() }
                  if (sync?.on) leaveSync().finally(done); else done()
                }}>
                {armReset ? 'Tap again to erase everything' : 'Reset app'}
              </button>
            </section>
          )}
        </div>
        {coachHome && <CoachHome onClose={() => history.back()} />}
      </div>
    )
  }

  const goal = GOALS.find(g => g.id === p.goal)?.label || 'Your goal'
  const it = state.intake || DEFAULT_INTAKE
  const wd = weekPlanOf(state).days
  const prefs = remindersOf(state)
  const remN = REMINDERS.filter(r => prefs[r.id]?.on).length
  const pushed = pushOn()
  const acct = account?.value
  const coachName = coach?.link?.coach?.name
  const me = readCoachMe()
  const syncLine = !sync ? '' : !sync.on ? 'Off' : sync.info.status === 'syncing' ? 'Syncing…' : sync.info.status === 'ok' || sync.info.status === 'idle' ? `Synced ${ago(sync.info.at)}` : 'Needs attention'

  return (
    <div className="screen">
      <header className="screen-top">
        <button className="td-icon" onClick={onClose} aria-label="Back">←</button>
        <h2>Settings</h2>
        <span style={{ width: 44 }} />
      </header>
      <div className="page stk st-root" style={{ paddingTop: 4 }}>
        <div className="card st-list">
          {account && (
            <button className="st-nav st-me" onClick={() => open('account')}>
              <span className="ac-avatar st-av">{(s.name || acct?.email || '?').charAt(0).toUpperCase()}</span>
              <span className="st-t"><b>{s.name || 'You'}</b><small>{acct?.email || 'Not signed in · keep your progress safe'}</small></span>
              <i className="st-chev" aria-hidden="true" />
            </button>
          )}
          {pro?.on && <Nav ic="beet" label={pro.status?.pro ? 'BeetFit PRO' : 'Try BeetFit PRO'} sub={proLine(pro)} hot={!pro.status?.pro} onClick={() => { haptic(); pro.open() }} />}
        </div>

        <Group title="Your plan">
          <Nav ic="target" label={PAGES.profile} sub={`${goal} · target ${shownTarget} ${lb ? 'lb' : 'kg'}`} onClick={() => open('profile')} />
          <Nav ic="train" label={PAGES.training} sub={`${placeShort(it.loc)} · ${wd.length ? [...wd].sort().map(d => DOW[d]).join(' ') : `${it.daysWk} days a week`}`} onClick={() => open('training')} />
          <Nav ic="water" label={PAGES.food} sub={`${s.waterTarget || 8} glasses · ${fmtWater(s.waterTarget || 8, state)}${s.cycleFood !== false ? ' · eat to training days' : ''}`} onClick={() => open('food')} />
          <Nav ic="people" label={PAGES.coach} sub={coachName ? `Coached by ${coachName}` : me?.code ? `You coach · code ${me.code}` : 'Add your coach, or coach others'} onClick={() => open('coach')} />
        </Group>

        <Group title="App">
          <Nav ic="timer" label={PAGES.reminders} sub={pushed ? `On · ${remN} a day` : 'Off on this phone'} onClick={() => open('reminders')} />
          <Nav ic="cam" label={PAGES.workout} sub={`Voice ${voice ? 'on' : 'off'} · ${poseFull ? 'accurate' : 'fast'} tracking`} onClick={() => open('workout')} />
          <Nav ic="sun" label={PAGES.general} sub={`${lb ? 'lb' : 'kg'} · streak ${s.streak === false ? 'off' : 'on'} · animation ${motion}`} onClick={() => open('general')} />
        </Group>

        <Group title="Data">
          {sync && <Nav ic="phone" label={PAGES.sync} sub={sync.on ? `${syncLine} · ${sync.info.devices || 1} ${sync.info.devices === 1 ? 'device' : 'devices'}` : syncLine} onClick={() => open('sync')} />}
          <Nav ic="lock" label={PAGES.data} sub="Export CSV or JSON, privacy, reset" onClick={() => open('data')} />
        </Group>

        <p className="hint st-ver num">BeetFit {VERSION} · <a href="/privacy" target="_blank" rel="noopener">Privacy</a> · <a href="/terms" target="_blank" rel="noopener">Terms</a></p>
      </div>
      {coachHome && <CoachHome onClose={() => history.back()} />}
    </div>
  )
}

const placeShort = loc => (loc === 'gym' ? 'Gym' : loc === 'home, basic' ? 'Home, some kit' : 'Home, no kit')
const readCoachMe = () => { try { return JSON.parse(localStorage.getItem('beetfit_coach_me') || 'null') } catch { return null } }

function Group({ title, children }) {
  return (
    <section className="st-group">
      <span className="label">{title}</span>
      <div className="card st-list">{children}</div>
    </section>
  )
}

function Nav({ ic, label, sub, hot, onClick }) {
  return (
    <button className={'st-nav' + (hot ? ' hot' : '')} onClick={onClick}>
      <span className="st-ic"><Ic n={ic} /></span>
      <span className="st-t"><b>{label}</b>{sub && <small>{sub}</small>}</span>
      <i className="st-chev" aria-hidden="true" />
    </button>
  )
}

const SYNC_ERR = {
  offline: 'No connection. Will retry when you are back online.',
  sync_not_configured: 'Sync is not set up on the server yet.',
  unauthorized: 'Server key missing (DEVICE_SECRET).',
  bad_code: 'That code is wrong or expired.',
  same_device: 'That code was made on this phone. Enter it on the other one.',
  too_many_tries: 'Too many tries today. Try again tomorrow.',
  daily_limit: 'Too many codes today. Try again tomorrow.',
  too_large: 'Your data is too big to sync.'
}
const errText = e => SYNC_ERR[e] || (e ? `Sync failed (${e}).` : '')

function ago(t) {
  if (!t) return 'never'
  const s = Math.round((Date.now() - t) / 1000)
  return s < 10 ? 'just now' : s < 60 ? `${s} s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : new Date(t).toLocaleString()
}

function SyncCard({ sync, update }) {
  const { on, setOn, info, run } = sync
  const [mode, setMode] = useState(null) // 'show' | 'enter'
  const [pair, setPair] = useState(null)
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick(x => x + 1), 1000); return () => clearInterval(t) }, [])

  const left = pair ? Math.max(0, Math.round((pair.expires - Date.now()) / 1000)) : 0
  const show = async () => {
    haptic(); setErr(''); setBusy(true)
    if (!on) setOn(true)
    const r = await createPairCode()
    setBusy(false)
    if (r.status === 200) { setPair(r); setMode('show') } else setErr(errText(r.error || 'offline'))
  }
  const claim = async () => {
    haptic('medium'); setErr(''); setBusy(true)
    const r = await claimPairCode(code)
    setBusy(false)
    if (r.status !== 200) return setErr(errText(r.error || 'offline'))
    // Joined the other phone's account: fold what this phone has into it, then sync.
    if (r.data) update(prev => mergeStates(prev, r.data))
    setOn(true); setMode(null); setCode('')
  }
  const status = info.status === 'syncing' ? 'Syncing…' : info.status === 'ok' || info.status === 'idle' ? `Synced ${ago(info.at)}` : errText(info.status)

  return (
    <section className="card">
      <span className="label">Sync & devices</span>
      <Row label="Back up & sync" hint="Keeps your plan and logs on all your phones. No email or password.">
        <Toggle label="Sync between devices" on={on} onChange={v => { haptic(); if (v) setOn(true); else { leaveSync(); setOn(false); setMode(null) } }} />
      </Row>
      {on && (
        <div className="sy-status">
          <i className={'sy-dot ' + (info.status === 'syncing' ? 'busy' : info.status === 'ok' || info.status === 'idle' ? 'ok' : 'bad')} />
          <span>{status}</span>
          <span className="num sy-dev">{info.devices} {info.devices === 1 ? 'device' : 'devices'}</span>
          <button className="chip" onClick={() => { haptic(); run() }} disabled={info.status === 'syncing'}>Sync now</button>
        </div>
      )}
      {mode === 'show' && pair && (
        <div className="sy-code">
          <span className="label">Enter on your other phone</span>
          <b className="num">{pair.code.slice(0, 3)} {pair.code.slice(3)}</b>
          <span className="hint num">{left ? `Expires in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : 'Expired. Make a new one.'}</span>
        </div>
      )}
      {mode === 'enter' && (
        <div className="sy-enter">
          <input inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="6-digit code" value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
          <button className="btn" disabled={code.length !== 6 || busy} onClick={claim}>{busy ? 'Linking…' : 'Link'}</button>
        </div>
      )}
      {err && <p className="sy-err">{err}</p>}
      <div className="grid2">
        <button className="btn secondary" disabled={busy} onClick={show}>{mode === 'show' ? 'New code' : 'Link another phone'}</button>
        <button className="btn secondary" onClick={() => { haptic(); setErr(''); setMode(mode === 'enter' ? null : 'enter') }}>I have a code</button>
      </div>
    </section>
  )
}

const pad = n => String(n).padStart(2, '0')

function RemindersCard({ state, update, sync, account }) {
  const prefs = remindersOf(state)
  const support = pushSupport()
  const [on, setOnState] = useState(() => pushOn() && (support === 'native' || permission() === 'granted'))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const set = (id, patch) => update(prev => {
    const cur = remindersOf(prev)
    return { settings: { ...(prev.settings || {}), reminders: { ...cur, [id]: typeof cur[id] === 'object' ? { ...cur[id], ...patch } : patch } } }
  })
  const toggle = async v => {
    haptic(); setMsg('')
    if (!v) { setOnState(false); await disablePush(); return }
    setBusy(true)
    const r = await enablePush(prefs, planEvents(state))
    setBusy(false)
    if (!r.ok) return setMsg(PUSH_ERR[r.error] || `Couldn’t turn on notifications (${r.error}).`)
    hapticSuccess(); setOnState(true)
    if (r.next) setMsg(`Next: ${r.next.kind === 'event' ? 'Calendar' : REMINDERS.find(x => x.id === r.next.kind)?.label} at ${new Date(r.next.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`)
  }
  return (
    <section className="card rm-card">
      <span className="label">Reminders</span>
      <Row label="Notifications on this phone" hint={support === 'native' ? 'Scheduled on the phone' : 'Smart: skipped when you already did it'}>
        <Toggle label="Reminders on this phone" on={on} onChange={v => { if (!busy) toggle(v) }} />
      </Row>
      {support === 'install' && !on && <p className="hint">{PUSH_ERR.install}</p>}
      {REMINDERS.map(r => (
        <div key={r.id} className={'rm-row' + (prefs[r.id].on ? '' : ' off')}>
          <button className={'rm-check' + (prefs[r.id].on ? ' on' : '')} aria-label={r.label} onClick={() => { haptic(); set(r.id, { on: !prefs[r.id].on }) }} />
          <div className="rm-t"><b>{r.label}</b><span className="hint">{r.hint}</span></div>
          <input type="time" className="rm-time num" value={`${pad(prefs[r.id].h)}:${pad(prefs[r.id].m)}`} disabled={!prefs[r.id].on}
            onChange={e => { const [h, m] = e.target.value.split(':').map(Number); if (Number.isFinite(h)) set(r.id, { h, m: m || 0 }) }} />
        </div>
      ))}
      {support !== 'native' && (
        <Row label="Coach messages" hint="Ping me when my coach or a client writes, finishes a session, or goes quiet">
          <Toggle on={prefs.coach !== false} onChange={v => { haptic(); update(prev => ({ settings: { ...(prev.settings || {}), reminders: { ...remindersOf(prev), coach: v } } })) }} />
        </Row>
      )}
      <MailRem sync={sync} account={account} />
      {on && <button className="btn secondary" onClick={async () => { haptic(); const r = await testPush(); setMsg(r.ok ? 'Sent. It should arrive in a few seconds.' : (PUSH_ERR[r.error] || 'Test failed.')) }}>Send a test notification</button>}
      {msg && <p className={msg.startsWith('Next') || msg.startsWith('Sent') ? 'hint' : 'sy-err'}>{msg}</p>}
    </section>
  )
}

// One email a day at a time you pick, only when something is still open. Needs an account (the address) and sync (what is done).
function MailRem({ sync, account }) {
  const acct = account || cachedAccount()
  const [v, setV] = useState({ on: false, h: 18, m: 0 })
  const [msg, setMsg] = useState('')
  useEffect(() => {
    if (!acct?.email) return
    let live = true
    getMailRem().then(r => { if (live && r.status === 200) setV({ on: !!r.on, h: r.h, m: r.m }) })
    return () => { live = false }
  }, [acct?.email])
  const save = async next => {
    const prev = v
    setV(next); setMsg('')
    const r = await setMailRem(next)
    if (r.status !== 200) { setV(prev); setMsg(MAIL_ERR[r.error] || 'Couldn’t save. Try again.') }
    else if (next.on) setMsg(`Next email: ${new Date(r.next).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}.`)
  }
  return (
    <>
      <Row label="Daily email check-in" hint={acct?.email ? (v.on ? acct.email : 'One email a day, only if something is still open') : 'Sign in to get it by email'}>
        <Toggle on={v.on} onChange={on => { if (!acct?.email) return setMsg(MAIL_ERR.sign_in_first); save({ ...v, on }) }} />
      </Row>
      {v.on && (
        <div className="rm-row">
          <div className="rm-t"><b>Send at</b><span className="hint">{sync?.on ? 'Your local time' : 'Turn on sync so we know what you already did'}</span></div>
          <input type="time" className="rm-time num" value={`${pad(v.h)}:${pad(v.m)}`}
            onChange={e => { const [h, m] = e.target.value.split(':').map(Number); if (Number.isFinite(h)) save({ ...v, h, m: m || 0 }) }} />
        </div>
      )}
      {msg && <p className={msg.startsWith('Next') ? 'hint' : 'sy-err'}>{msg}</p>}
    </>
  )
}

function Row({ label, hint, children }) {
  return (
    <div className="set-row">
      <div><div className="set-l">{label}</div>{hint && <div className="hint" style={{ fontSize: 12 }}>{hint}</div>}</div>
      {React.Children.map(children, c => (c && c.type === Toggle && !c.props.label && typeof label === 'string') ? React.cloneElement(c, { label }) : c)}
    </div>
  )
}

function Seg({ value, options, onChange }) {
  return (
    <div className="seg">
      {options.map(([v, l]) => (
        <button key={v} className={value === v ? 'on' : ''} onClick={() => { haptic(); onChange(v) }}>{l}</button>
      ))}
    </div>
  )
}

export function Toggle({ on, onChange, label }) {
  return (
    <button className={'tgl' + (on ? ' on' : '')} role="switch" aria-checked={on} aria-label={label} onClick={() => { haptic(); onChange(!on) }}><i /></button>
  )
}
