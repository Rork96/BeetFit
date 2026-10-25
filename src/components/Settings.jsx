import React, { useEffect, useState } from 'react'
import { GOALS, ACTIVITY_LEVELS } from '../lib/calories.js'
import { applyMotionLevel, getMotionLevel } from '../lib/motion.js'
import { voiceEnabled, setVoiceEnabled, speak, unlockVoice } from '../lib/voice.js'
import { exportState, clearState } from '../lib/store.js'
import { haptic } from '../lib/platform.js'
import { KG_TO_LB } from '../lib/day.js'
import { mkProg, DEFAULT_INTAKE } from '../lib/program.js'
import { createPairCode, claimPairCode, leaveSync, mergeStates } from '../lib/sync.js'
import { YourCoachCard, CoachModeCard, CoachHome } from './Coach.jsx'
import { useBackClose } from '../lib/hooks.js'
import { REMINDERS, remindersOf, pushSupport, pushOn, enablePush, disablePush, testPush, PUSH_ERR, permission } from '../lib/push.js'

const VERSION = '0.4.1'

export default function Settings({ state, update, sync, coach, openChat, startCoach, onClose }) {
  const [coachHome, setCoachHome] = useState(!!startCoach)
  useBackClose(coachHome, () => setCoachHome(false))
  const s = state.settings || {}
  const p = state.profile
  const [motion, setMotion] = useState(getMotionLevel())
  const [voice, setVoice] = useState(voiceEnabled())
  const [armReset, setArmReset] = useState(false)
  const [rebuilt, setRebuilt] = useState(false)
  const [poseFull, setPoseFull] = useState(() => { try { return localStorage.getItem('bf_pose_model') === 'full' } catch { return false } })
  const lb = s.units === 'lb'

  const setS = patch => update(prev => ({ settings: { ...(prev.settings || {}), ...patch } }))
  const setP = patch => update(prev => ({ profile: { ...prev.profile, ...patch } }))
  const shownTarget = lb ? +(p.targetKg * KG_TO_LB).toFixed(1) : p.targetKg

  return (
    <div className="screen">
      <header className="screen-top">
        <button className="td-icon" onClick={onClose} aria-label="Back">←</button>
        <h2>Settings</h2>
        <span style={{ width: 44 }} />
      </header>
      <div className="page stk" style={{ paddingTop: 4 }}>
        <section className="card">
          <span className="label">Profile</span>
          <label>Name<input value={s.name || ''} placeholder="What should we call you?" onChange={e => setS({ name: e.target.value.slice(0, 24) })} /></label>
          <label>Goal</label>
          <div className="chips">
            {GOALS.map(g => (
              <button key={g.id} className={'chip' + (p.goal === g.id ? ' on' : '')} onClick={() => { haptic(); update(prev => ({ profile: { ...prev.profile, goal: g.id }, program: mkProg(g.id, prev.intake || DEFAULT_INTAKE) })) }}>{g.label}</button>
            ))}
          </div>
          <div className="grid2">
            <label>Target weight, {lb ? 'lb' : 'kg'}
              <input type="number" inputMode="decimal" value={shownTarget}
                onChange={e => { const v = +e.target.value; if (v) setP({ targetKg: lb ? Math.round((v / KG_TO_LB) * 2) / 2 : v }) }} />
            </label>
            <label>Activity
              <select value={p.activity} onChange={e => setP({ activity: e.target.value })}>
                {ACTIVITY_LEVELS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </label>
          </div>
          <label>Injuries or pain (plan leaves these out)
            <input value={state.intake?.injuries || ''} placeholder="e.g. left knee"
              onChange={e => update(prev => ({ intake: { ...(prev.intake || DEFAULT_INTAKE), injuries: e.target.value.slice(0, 80) } }))} />
          </label>
          <button className="btn secondary" onClick={() => {
            haptic('medium')
            update(prev => ({ program: mkProg(prev.profile.goal, prev.intake || DEFAULT_INTAKE) }))
            setRebuilt(true); setTimeout(() => setRebuilt(false), 2000)
          }}>{rebuilt ? '✓ Plan rebuilt' : 'Rebuild my plan'}</button>
        </section>

        <section className="card">
          <span className="label">Preferences</span>
          <Row label="Units">
            <Seg value={s.units || 'kg'} options={[['kg', 'kg'], ['lb', 'lb']]} onChange={v => setS({ units: v })} />
          </Row>
          <Row label="Water target">
            <div className="fc-step mini">
              <button onClick={() => setS({ waterTarget: Math.max(4, (s.waterTarget || 8) - 1) })} aria-label="Less">−</button>
              <span className="num">{s.waterTarget || 8}<small>glasses</small></span>
              <button onClick={() => setS({ waterTarget: Math.min(16, (s.waterTarget || 8) + 1) })} aria-label="More">+</button>
            </div>
          </Row>
          <Row label="Voice coach" hint="Counts the last reps and calls rest">
            <Toggle on={voice} onChange={v => { unlockVoice(); setVoice(v); setVoiceEnabled(v); if (v) speak('Voice coach on') }} />
          </Row>
          <Row label="Accurate tracking" hint="Bigger pose model: steadier counts, a bit slower on older phones">
            <Toggle on={poseFull} onChange={v => { setPoseFull(v); try { localStorage.setItem('bf_pose_model', v ? 'full' : 'lite') } catch {} }} />
          </Row>
          <Row label="Animation" hint="Auto follows your phone's reduce-motion setting">
            <Seg value={motion} options={[['auto', 'Auto'], ['full', 'Full'], ['lite', 'Lite'], ['off', 'Off']]}
              onChange={v => { setMotion(v); applyMotionLevel(v) }} />
          </Row>
        </section>

        <RemindersCard state={state} update={update} />

        {coach && <YourCoachCard coach={coach} syncOn={sync?.on} onChat={openChat} />}

        {sync && <SyncCard sync={sync} update={update} />}

        <CoachModeCard onOpen={() => setCoachHome(true)} />

        <section className="card">
          <span className="label">Your data</span>
          <p className="hint">{sync?.on ? 'Stored on this device and backed up to BeetFit sync.' : 'Everything is stored on this device.'} Camera video never leaves it. Meal photos are sent to Google Gemini only when you tap the shutter.</p>
          <button className="btn secondary" onClick={() => { haptic(); exportState(state) }}>Export all data (JSON)</button>
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

        <p className="hint" style={{ textAlign: 'center' }}>BeetFit {VERSION}</p>
      </div>
      {coachHome && <CoachHome onClose={() => history.back()} />}
    </div>
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
        <Toggle on={on} onChange={v => { haptic(); if (v) setOn(true); else { leaveSync(); setOn(false); setMode(null) } }} />
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

function RemindersCard({ state, update }) {
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
    const r = await enablePush(prefs)
    setBusy(false)
    if (!r.ok) return setMsg(PUSH_ERR[r.error] || `Couldn’t turn on notifications (${r.error}).`)
    hapticSuccess(); setOnState(true)
    if (r.next) setMsg(`Next: ${REMINDERS.find(x => x.id === r.next.kind)?.label} at ${new Date(r.next.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`)
  }
  return (
    <section className="card">
      <span className="label">Reminders</span>
      <Row label="Notifications on this phone" hint={support === 'native' ? 'Scheduled on the phone' : 'Smart: skipped when you already did it'}>
        <Toggle on={on} onChange={v => { if (!busy) toggle(v) }} />
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
        <Row label="Coach messages" hint="Ping me when my coach or a client writes">
          <Toggle on={prefs.coach !== false} onChange={v => { haptic(); update(prev => ({ settings: { ...(prev.settings || {}), reminders: { ...remindersOf(prev), coach: v } } })) }} />
        </Row>
      )}
      {on && <button className="btn secondary" onClick={async () => { haptic(); const r = await testPush(); setMsg(r.ok ? 'Sent. It should arrive in a few seconds.' : (PUSH_ERR[r.error] || 'Test failed.')) }}>Send a test notification</button>}
      {msg && <p className={msg.startsWith('Next') || msg.startsWith('Sent') ? 'hint' : 'sy-err'}>{msg}</p>}
    </section>
  )
}

function Row({ label, hint, children }) {
  return (
    <div className="set-row">
      <div><div className="set-l">{label}</div>{hint && <div className="hint" style={{ fontSize: 12 }}>{hint}</div>}</div>
      {children}
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

function Toggle({ on, onChange }) {
  return (
    <button className={'tgl' + (on ? ' on' : '')} role="switch" aria-checked={on} onClick={() => { haptic(); onChange(!on) }}><i /></button>
  )
}
