import React, { useEffect, useRef, useState } from 'react'
import { authConfig, emailStart, emailVerify, googleSignIn, appleSignIn, mountGoogle, appleIdToken, ACCOUNT_ERR } from '../lib/account.js'
import { haptic, hapticSuccess, hapticError } from '../lib/platform.js'
import './account.css'

const errText = e => ACCOUNT_ERR[e] || (e ? `Sign-in failed (${e}).` : '')
const PROVIDER = { email: 'Email', google: 'Google', apple: 'Apple' }

// Sign-in methods the server offers. `onDone(r)` gets { result: 'linked'|'switched'|'same', account, doc? }.
export function SignIn({ onDone, autoFocus }) {
  const [cfg, setCfg] = useState(null)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState('pick') // 'pick' | 'code'
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const gRef = useRef(null)
  const codeRef = useRef(null)

  useEffect(() => { authConfig().then(setCfg) }, [])

  const finish = r => {
    setBusy(false)
    if (r.status === 200 && r.account) { hapticSuccess(); onDone(r) } else { hapticError(); setErr(errText(r.error || (r.status ? `http_${r.status}` : 'offline'))) }
  }

  useEffect(() => {
    if (!cfg?.google || !gRef.current || step !== 'pick') return
    const w = Math.min(400, gRef.current.clientWidth || 320)
    mountGoogle(gRef.current, cfg.google, credential => { setBusy(true); setErr(''); googleSignIn(credential).then(finish) }, w)
      .catch(() => setErr('Google sign-in didn’t load. Check your connection.'))
  }, [cfg, step]) // eslint-disable-line react-hooks/exhaustive-deps

  const apple = async () => {
    haptic(); setErr('')
    try {
      const t = await appleIdToken(cfg.apple)
      if (!t) return
      setBusy(true); finish(await appleSignIn(t))
    } catch (e) {
      if (e?.error !== 'popup_closed_by_user') setErr('Apple sign-in didn’t go through. Try again.')
    }
  }

  const send = async () => {
    haptic(); setErr(''); setBusy(true)
    const r = await emailStart(email)
    setBusy(false)
    if (r.status === 200) { setStep('code'); setCode(''); setTimeout(() => codeRef.current?.focus(), 60) } else { hapticError(); setErr(errText(r.error)) }
  }
  const verify = async c => {
    setErr(''); setBusy(true)
    finish(await emailVerify(email, c))
  }

  if (!cfg) return <div className="ac-wait"><span className="ac-dot" /><span className="ac-dot" /><span className="ac-dot" /></div>
  if (!cfg.email && !cfg.google && !cfg.apple) return <p className="hint">Sign-in isn’t set up on the server yet.</p>

  if (step === 'code') {
    return (
      <div className="ac stk">
        <p className="ac-sent">We sent a 6-digit code to <b>{email.trim()}</b>.</p>
        <input ref={codeRef} className="ac-code num" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••" value={code}
          onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 6); setCode(v); if (v.length === 6) verify(v) }} aria-label="Code" />
        {err && <p className="ac-err">{err}</p>}
        <button className="btn" disabled={code.length !== 6 || busy} onClick={() => verify(code)}>{busy ? 'Checking…' : 'Sign in'}</button>
        <div className="ac-row">
          <button className="ac-link" onClick={() => { haptic(); setStep('pick'); setErr('') }}>Change email</button>
          <button className="ac-link" disabled={busy} onClick={send}>Send a new code</button>
        </div>
      </div>
    )
  }

  return (
    <div className="ac stk">
      {cfg.apple && (
        <button className="ac-apple" onClick={apple} disabled={busy}>
          <svg viewBox="0 0 17 20" aria-hidden="true"><path fill="currentColor" d="M14.1 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9C3.6 4.8 2 5.8 1.1 7.3c-1.8 3.2-.5 7.9 1.3 10.5.9 1.3 1.9 2.7 3.3 2.6 1.3-.1 1.8-.9 3.4-.9s2 .9 3.4.8c1.4 0 2.3-1.3 3.2-2.6 1-1.5 1.4-2.9 1.4-3-.1 0-2.9-1.1-3-4.1zM11.5 3c.7-.9 1.2-2.1 1.1-3.3-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.2 1.1.1 2.3-.6 3-1.5z" /></svg>
          Continue with Apple
        </button>
      )}
      {cfg.google && <div className="ac-google" ref={gRef} />}
      {cfg.email && (
        <>
          {(cfg.apple || cfg.google) && <div className="ac-or"><span>or with email</span></div>}
          <input type="email" inputMode="email" autoComplete="email" autoFocus={autoFocus} placeholder="you@example.com" value={email}
            onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && email.includes('@')) send() }} aria-label="Email" />
          <button className="btn secondary" disabled={!email.includes('@') || busy} onClick={send}>{busy ? 'Sending…' : 'Email me a code'}</button>
        </>
      )}
      {err && <p className="ac-err">{err}</p>}
    </div>
  )
}

// Settings card: sign in, or who you are + sign out / delete.
export function AccountCard({ account }) {
  const { value, onSignedIn, signOut, del } = account
  const [arm, setArm] = useState(null) // 'out' | 'delete'
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [justIn, setJustIn] = useState(null)

  const confirm = async kind => {
    haptic('medium'); setErr('')
    if (arm !== kind) { setArm(kind); return }
    setBusy(true)
    const r = kind === 'out' ? await signOut() : await del()
    setBusy(false)
    if (r?.status !== 200) setErr(errText(r?.error || 'offline'))
  }

  if (!value) {
    return (
      <section className="card ac-card" id="account">
        <span className="label">Account</span>
        <h3 className="ac-h">Keep your progress safe</h3>
        <p className="hint" style={{ margin: 0 }}>Sign in and your logs, plan and streak follow you to a new phone. Nothing on this phone is lost.</p>
        <SignIn onDone={r => { setJustIn(r.result); onSignedIn(r) }} />
      </section>
    )
  }
  return (
    <section className="card ac-card" id="account">
      <span className="label">Account</span>
      <div className="ac-me">
        <span className="ac-avatar">{(value.email || '?').charAt(0).toUpperCase()}</span>
        <div>
          <b>{value.email || 'Signed in'}</b>
          <span className="hint">{value.providers.map(p => PROVIDER[p.provider] || p.provider).join(' · ')} · synced</span>
        </div>
      </div>
      {justIn === 'switched' && <p className="ac-ok">Signed in. Your account’s data was merged with what was on this phone.</p>}
      {justIn === 'linked' && <p className="ac-ok">Account created. This phone’s data is now backed up to it.</p>}
      {arm === 'delete' && <p className="ac-err">This deletes your account and everything stored on the server, on every phone. It can’t be undone. Export your data first if you want a copy.</p>}
      {arm === 'out' && <p className="hint" style={{ margin: 0 }}>This phone will be cleared. Your data stays in your account; sign in again to get it back.</p>}
      {err && <p className="ac-err">{err}</p>}
      <div className="grid2">
        <button className={'btn ' + (arm === 'out' ? 'danger' : 'secondary')} disabled={busy} onClick={() => confirm('out')}>{arm === 'out' ? 'Tap to sign out' : 'Sign out'}</button>
        <button className={'btn ' + (arm === 'delete' ? 'danger' : 'secondary')} disabled={busy} onClick={() => confirm('delete')}>{arm === 'delete' ? 'Delete forever' : 'Delete account'}</button>
      </div>
      {arm && <button className="ac-link" onClick={() => setArm(null)}>Cancel</button>}
    </section>
  )
}
