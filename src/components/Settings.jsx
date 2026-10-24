import React, { useState } from 'react'
import { GOALS, ACTIVITY_LEVELS } from '../lib/calories.js'
import { applyMotionLevel, getMotionLevel } from '../lib/motion.js'
import { voiceEnabled, setVoiceEnabled, speak, unlockVoice } from '../lib/voice.js'
import { exportState, clearState } from '../lib/store.js'
import { haptic } from '../lib/platform.js'
import { KG_TO_LB } from '../lib/day.js'
import { mkProg, DEFAULT_INTAKE } from '../lib/program.js'

const VERSION = '0.3.0'

export default function Settings({ state, update, onClose }) {
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

        <section className="card">
          <span className="label">Your data</span>
          <p className="hint">Everything is stored on this device. Camera video never leaves it. Meal photos are sent to Google Gemini only when you tap the shutter.</p>
          <button className="btn secondary" onClick={() => { haptic(); exportState(state) }}>Export all data (JSON)</button>
          <button className={'btn ' + (armReset ? 'danger' : 'secondary')}
            onClick={() => {
              haptic('medium')
              if (!armReset) { setArmReset(true); setTimeout(() => setArmReset(false), 3000); return }
              clearState(); location.reload()
            }}>
            {armReset ? 'Tap again to erase everything' : 'Reset app'}
          </button>
        </section>

        <p className="hint" style={{ textAlign: 'center' }}>BeetFit {VERSION}</p>
      </div>
    </div>
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
