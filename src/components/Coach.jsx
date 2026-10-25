import React, { useCallback, useEffect, useRef, useState } from 'react'
import { haptic, hapticSuccess } from '../lib/platform.js'
import { useBackClose } from '../lib/hooks.js'
import { migrate } from '../lib/store.js'
import { fmtWeight, dayKey } from '../lib/day.js'
import {
  coachSetup, coachNewCode, coachClients, coachClient, coachReply, coachClientSeen, coachRemove, coachOverride,
  overview, cleanCode, CODE_RE
} from '../lib/coach.js'
import './coach.css'

const GOAL = { lose: 'Lose fat', gain: 'Build muscle', maintain: 'Maintain', recomp: 'Recomp' }
const ERR = {
  offline: 'No connection.',
  bad_code: "That code isn't recognised. Check it with your coach.",
  own_code: 'That is your own coach code.',
  too_many_tries: 'Too many tries today. Try again tomorrow.',
  sync_not_configured: 'Coaching is not set up on the server yet.',
  unauthorized: 'Server key missing (DEVICE_SECRET).',
  daily_limit: 'Daily limit reached. Try again tomorrow.',
  bad_name: 'Name needs at least 2 letters.',
  not_found: 'That client is no longer linked.'
}
const errText = e => ERR[e] || (e ? `Something went wrong (${e}).` : '')
const initial = n => (n || '?').trim().charAt(0).toUpperCase()
const when = t => {
  const d = new Date(t), now = new Date()
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (d.toDateString() === now.toDateString()) return time
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + time
}
const ago = day => {
  if (!day) return 'no logs yet'
  const n = Math.round((Date.parse(dayKey()) - Date.parse(day)) / 864e5)
  return n <= 0 ? 'active today' : n === 1 ? 'active yesterday' : `active ${n} days ago`
}

// ---------------------------------------------------------------- shared

export function Thread({ msgs, me, other, onSend, placeholder }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const end = useRef(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }) }, [msgs.length])
  const send = async () => {
    const t = text.trim()
    if (!t || sending) return
    haptic(); setSending(true); setText('')
    const r = await onSend(t)
    setSending(false)
    if (r?.status !== 200) setText(t)
  }
  return (
    <div className="ch-thread">
      {msgs.length === 0 && <p className="hint">No messages yet.</p>}
      <div className="ch-msgs">
        {msgs.map(m => (
          <div key={m.id} className={'ch-msg ' + (m.by === me ? 'me' : 'them') + (m.pending ? ' pending' : '') + (m.failed ? ' failed' : '')}>
            <p>{m.text}</p>
            <span>{m.by === me ? 'You' : other} · {m.failed ? 'not sent' : m.pending ? 'sending…' : when(m.at)}</span>
          </div>
        ))}
        <i ref={end} />
      </div>
      <div className="ch-input">
        <textarea rows={1} value={text} maxLength={1000} placeholder={placeholder}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
        <button className="btn" disabled={!text.trim() || sending} onClick={send}>Send</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- client side

// Today card: shows the coach's newest unread message.
export function CoachNote({ coach, onOpen }) {
  const { link, unread, markSeen } = coach
  if (!link?.coach || !unread.length) return null
  const m = unread[unread.length - 1]
  return (
    <div className="card ch-note">
      <div className="row">
        <span className="label">Coach · {link.coach.name}</span>
        {unread.length > 1 && <span className="ch-badge num">{unread.length} new</span>}
      </div>
      <p className="ch-note-t">{m.text}</p>
      <div className="ch-note-a">
        <button className="btn secondary" onClick={() => { haptic(); markSeen() }}>Got it</button>
        <button className="btn" onClick={() => { haptic(); onOpen() }}>Reply</button>
      </div>
    </div>
  )
}

// Full-screen thread with my coach.
export function CoachChat({ coach, onClose }) {
  const { link, send, markSeen, refresh } = coach
  useEffect(() => { markSeen().then(refresh) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  if (!link?.coach) return null
  return (
    <div className="screen ch-screen">
      <header className="screen-top">
        <button className="td-icon" onClick={onClose} aria-label="Back">←</button>
        <h2>{link.coach.name}</h2>
        <span style={{ width: 44 }} />
      </header>
      <div className="page stk">
        {link.override?.note && <div className="card ch-ovr"><span className="label">Coach note on your targets</span><p>{link.override.note}</p></div>}
        <Thread msgs={link.msgs} me="client" other={link.coach.name.split(' ')[0]} onSend={send} placeholder="Message your coach" />
      </div>
    </div>
  )
}

// Settings card: connect / see / disconnect my coach.
export function YourCoachCard({ coach, syncOn, onChat }) {
  const { link, join, leave } = coach
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [arm, setArm] = useState(false)
  const connect = async () => {
    haptic('medium'); setErr(''); setBusy(true)
    const r = await join(code)
    setBusy(false)
    if (r.status !== 200) return setErr(errText(r.error || 'offline'))
    hapticSuccess(); setCode('')
  }
  return (
    <section className="card">
      <span className="label">Your coach</span>
      {link?.coach ? (
        <>
          <div className="ch-who">
            <div className="ch-av"><span>{initial(link.coach.name)}</span></div>
            <div>
              <b>{link.coach.name}</b>
              <span className="hint">Connected since {new Date(link.coach.since).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
            </div>
          </div>
          <p className="hint">Sees your weight, meals, workouts, water, check-ins and pain reports. Can message you and set your calorie and protein targets.{syncOn ? '' : ' Turn sync on so they see your latest logs.'}</p>
          {link.override && (link.override.kcal || link.override.protein) && (
            <p className="ch-ovr-line num">Targets set by coach: {[link.override.kcal && `${link.override.kcal} kcal`, link.override.protein && `${link.override.protein} g protein`].filter(Boolean).join(' · ')}</p>
          )}
          <div className="grid2">
            <button className="btn secondary" onClick={() => { haptic(); onChat() }}>Messages</button>
            <button className={'btn ' + (arm ? 'danger' : 'secondary')} onClick={async () => {
              haptic('medium')
              if (!arm) { setArm(true); setTimeout(() => setArm(false), 3000); return }
              setArm(false); const r = await leave(); if (r.status !== 200) setErr(errText(r.error || 'offline'))
            }}>{arm ? 'Tap to disconnect' : 'Disconnect'}</button>
          </div>
        </>
      ) : (
        <>
          <p className="hint">Training with a coach? Enter the code they sent you. They’ll see your logs and can adjust your targets.</p>
          <div className="sy-enter">
            <input autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="Coach code" value={code}
              onChange={e => setCode(cleanCode(e.target.value))} />
            <button className="btn" disabled={!CODE_RE.test(code) || busy} onClick={connect}>{busy ? 'Connecting…' : 'Connect'}</button>
          </div>
        </>
      )}
      {err && <p className="sy-err">{err}</p>}
    </section>
  )
}

// ---------------------------------------------------------------- coach side

const ME_KEY = 'beetfit_coach_me'
const readMe = () => { try { return JSON.parse(localStorage.getItem(ME_KEY)) } catch { return null } }

// Settings card: become a coach, share the invite code, open the client list.
export function CoachModeCard({ onOpen }) {
  const [me, setMe] = useState(readMe) // { name, code }
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [armNew, setArmNew] = useState(false)
  const save = v => { setMe(v); try { localStorage.setItem(ME_KEY, JSON.stringify(v)) } catch { /* ignore */ } }

  useEffect(() => { coachClients().then(r => { if (r.status === 200 && r.coach) save(r.coach) }) }, [])

  const setup = async () => {
    haptic('medium'); setErr(''); setBusy(true)
    const r = await coachSetup(name.trim())
    setBusy(false)
    if (r.status !== 200) return setErr(errText(r.error || 'offline'))
    hapticSuccess(); save({ name: r.name, code: r.code })
  }
  const invite = me && `Train with me on BeetFit: open https://beetfit.wealthifai.xyz, tap “I have a coach code” and enter ${me.code}.`
  const share = async () => {
    haptic()
    try {
      if (navigator.share) await navigator.share({ title: 'BeetFit coach invite', text: invite })
      else { await navigator.clipboard.writeText(invite); setCopied(true); setTimeout(() => setCopied(false), 1800) }
    } catch { /* cancelled */ }
  }
  const newCode = async () => {
    haptic('medium')
    if (!armNew) { setArmNew(true); setTimeout(() => setArmNew(false), 3000); return }
    setArmNew(false)
    const r = await coachNewCode()
    if (r.status === 200) save({ name: r.name, code: r.code }); else setErr(errText(r.error || 'offline'))
  }

  return (
    <section className="card">
      <span className="label">Coach mode</span>
      {!me ? (
        <>
          <p className="hint">Coach other people: invite them with a code, see their logs and check-ins, message them and set their targets.</p>
          <div className="sy-enter">
            <input placeholder="Your name as clients see it" value={name} maxLength={40} onChange={e => setName(e.target.value)} />
            <button className="btn" disabled={name.trim().length < 2 || busy} onClick={setup}>{busy ? '…' : 'Start'}</button>
          </div>
        </>
      ) : (
        <>
          <div className="sy-code ch-code">
            <span className="label">Your invite code</span>
            <b className="num">{me.code}</b>
            <span className="hint">Clients enter it on the first screen or in Settings → Your coach.</span>
          </div>
          <div className="grid2">
            <button className="btn secondary" onClick={share}>{copied ? '✓ Copied' : 'Share invite'}</button>
            <button className={'btn ' + (armNew ? 'danger' : 'secondary')} onClick={newCode}>{armNew ? 'Old code stops working' : 'New code'}</button>
          </div>
          <button className="btn" onClick={() => { haptic(); onOpen() }}>Open my clients</button>
        </>
      )}
      {err && <p className="sy-err">{err}</p>}
    </section>
  )
}

export function CoachHome({ onClose }) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState(null)
  useBackClose(!!open, () => setOpen(null))

  const load = useCallback(async () => {
    const r = await coachClients()
    if (r.status === 200) { setErr(''); setData(r) } else setErr(errText(r.error || 'offline'))
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (!open) load() }, [open, load])

  const clients = data?.clients || []
  const flagged = clients.filter(c => c.summary?.pain || c.unread).length
  return (
    <div className="screen ch-screen">
      <header className="screen-top">
        <button className="td-icon" onClick={onClose} aria-label="Back">←</button>
        <h2>Clients</h2>
        <button className="td-icon" onClick={() => { haptic(); load() }} aria-label="Refresh">↻</button>
      </header>
      <div className="page stk">
        {data?.coach && (
          <div className="ch-kpis">
            <div><b className="num">{clients.length}</b><span>clients</span></div>
            <div><b className="num">{clients.length ? Math.round(clients.reduce((n, c) => n + (c.summary?.adh || 0), 0) / clients.length) : 0}%</b><span>avg adherence</span></div>
            <div className={flagged ? 'hot' : ''}><b className="num">{flagged}</b><span>need you</span></div>
          </div>
        )}
        {err && <p className="sy-err">{err}</p>}
        {!data && !err && <div className="card ch-skel" />}
        {data && !clients.length && (
          <div className="card stk">
            <b>No clients yet</b>
            <p className="hint">Share your code <b className="num">{data.coach?.code}</b>. Clients show up here as soon as they connect.</p>
          </div>
        )}
        {clients.map((c, i) => {
          const s = c.summary
          return (
            <button key={c.id} className="card ch-client" style={{ animationDelay: `${i * 40}ms` }} onClick={() => { haptic(); setOpen(c.id) }}>
              <div className="ch-av"><span>{initial(s?.name)}</span></div>
              <div className="ch-client-t">
                <b>{s?.name || 'New client'}{c.unread > 0 && <span className="ch-badge num">{c.unread}</span>}</b>
                <span className="hint num">{s ? `${GOAL[s.goal] || s.goal} · ${s.sessions}/${s.planned} sessions · ${ago(s.last)}` : 'Waiting for their first sync'}</span>
              </div>
              {s && <div className={'ch-adh num' + (s.adh < 50 ? ' low' : '')}>{s.adh}%</div>}
              {s?.pain > 0 && <i className="ch-flag" title="Pain reported" />}
            </button>
          )
        })}
      </div>
      {open && <ClientView id={open} onClose={() => history.back()} />}
    </div>
  )
}

function ClientView({ id, onClose }) {
  const [res, setRes] = useState(null)
  const [err, setErr] = useState('')
  const [ovr, setOvr] = useState({ kcal: '', protein: '', note: '' })
  const [saved, setSaved] = useState('')
  const [arm, setArm] = useState(false)

  const load = useCallback(async () => {
    const r = await coachClient(id)
    if (r.status !== 200) return setErr(errText(r.error || 'offline'))
    setErr(''); setRes(r)
    const o = r.override || {}
    setOvr({ kcal: o.kcal ?? '', protein: o.protein ?? '', note: o.note ?? '' })
  }, [id])
  useEffect(() => { load(); coachClientSeen(id) }, [id, load])
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') coachClient(id).then(r => { if (r.status === 200) setRes(p => ({ ...p, msgs: r.msgs })) }) }, 45000)
    return () => clearInterval(t)
  }, [id])

  const state = res?.data ? migrate(res.data) : null
  const ov = state?.profile ? overview(state) : null
  const units = state?.settings?.units || 'kg'

  const send = async text => {
    const r = await coachReply(id, text)
    if (r.status === 200) setRes(p => ({ ...p, msgs: [...p.msgs, r.msg] })); else setErr(errText(r.error || 'offline'))
    return r
  }
  const saveOvr = async clear => {
    haptic('medium')
    const body = clear ? {} : { kcal: ovr.kcal === '' ? null : +ovr.kcal, protein: ovr.protein === '' ? null : +ovr.protein, note: ovr.note }
    const r = await coachOverride(id, body)
    if (r.status !== 200) return setErr(errText(r.error || 'offline'))
    hapticSuccess()
    const o = r.override || {}
    setOvr({ kcal: o.kcal ?? '', protein: o.protein ?? '', note: o.note ?? '' })
    setRes(p => ({ ...p, override: r.override }))
    setSaved(clear ? 'Cleared' : 'Saved'); setTimeout(() => setSaved(''), 1800)
  }

  return (
    <div className="screen ch-screen ch-cv">
      <header className="screen-top">
        <button className="td-icon" onClick={onClose} aria-label="Back">←</button>
        <div className="ch-cv-h">
          <h2>{ov?.name || 'Client'}</h2>
          {ov && <span className="hint">{GOAL[ov.goal] || ov.goal} · {ago(ov.last)}</span>}
        </div>
        {ov ? <div className={'ch-adh num' + (ov.week.adh < 50 ? ' low' : '')}>{ov.week.adh}%<small>adherence</small></div> : <span style={{ width: 44 }} />}
      </header>
      <div className="page stk">
        {err && <p className="sy-err">{err}</p>}
        {!res && !err && <div className="card ch-skel" />}
        {res && !ov && <div className="card"><b>Waiting for their first sync</b><p className="hint">Their numbers show up once their phone syncs. Messages work already.</p></div>}

        {ov && (
          <>
            <div className="ch-kpis">
              <div><b className="num">{fmtWeight(ov.weight, units)}</b><span>{ov.rate == null ? 'weight' : `${ov.rate > 0 ? '+' : ''}${ov.rate} kg/wk`}</span></div>
              <div><b className="num">{ov.week.sessions}/{ov.week.planned}</b><span>sessions 7d</span></div>
              <div><b className="num">{ov.week.kcal ?? '—'}</b><span>kcal avg / {ov.targets.kcal}</span></div>
            </div>

            <section className="card">
              <span className="label">Needs attention</span>
              {!ov.alerts.length && <p className="ch-ok">Nothing flagged this week.</p>}
              {ov.alerts.map((a, i) => (
                <div key={i} className={'ch-alert ' + a.kind} style={{ animationDelay: `${i * 50}ms` }}>
                  <b>{a.t}</b><span>{a.sub}</span>
                </div>
              ))}
            </section>

            {ov.checkin && (
              <section className="card">
                <div className="row"><span className="label">Latest check-in</span><span className="hint num">{ov.checkin.date}</span></div>
                <div className="ch-ci num">
                  <div><b>{ov.checkin.sleep ?? '—'}</b><span>sleep h</span></div>
                  <div><b>{ov.checkin.mood ?? '—'}/5</b><span>mood</span></div>
                  <div><b>{ov.checkin.energy ?? '—'}/5</b><span>energy</span></div>
                  <div><b>{ov.checkin.hunger ?? '—'}/5</b><span>hunger</span></div>
                </div>
              </section>
            )}
          </>
        )}

        {res && (
          <section className="card">
            <span className="label">Messages</span>
            <Thread msgs={res.msgs || []} me="coach" other={(ov?.name || 'Client').split(' ')[0]} onSend={send} placeholder="They’ll see this on Today" />
          </section>
        )}

        {res && (
          <section className="card">
            <div className="row"><span className="label">Targets override</span>{saved && <span className="ex-cam">✓ {saved}</span>}</div>
            <p className="hint">Replaces the calculated targets on their phone{ov ? ` (now ${ov.targets.kcal} kcal · ${ov.targets.protein} g protein)` : ''}. Leave a field empty to keep the formula.</p>
            <div className="grid2">
              <label>Calories, kcal<input type="number" inputMode="numeric" value={ovr.kcal} placeholder="auto" onChange={e => setOvr(o => ({ ...o, kcal: e.target.value }))} /></label>
              <label>Protein, g<input type="number" inputMode="numeric" value={ovr.protein} placeholder="auto" onChange={e => setOvr(o => ({ ...o, protein: e.target.value }))} /></label>
            </div>
            <label>Note to client<input value={ovr.note} maxLength={280} placeholder="Why the change" onChange={e => setOvr(o => ({ ...o, note: e.target.value }))} /></label>
            <div className="grid2">
              <button className="btn secondary" onClick={() => saveOvr(true)}>Clear</button>
              <button className="btn" onClick={() => saveOvr(false)}>Save</button>
            </div>
          </section>
        )}

        {ov && (
          <section className="card">
            <span className="label">Last 4 weeks</span>
            <table className="ch-weeks num">
              <thead><tr><th>Week to</th><th>Weight</th><th>Sessions</th><th>Adh.</th><th>kcal</th></tr></thead>
              <tbody>
                {ov.weeks.map(w => (
                  <tr key={w.end}>
                    <td>{new Date(w.end + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                    <td>{w.weight ?? '—'}</td>
                    <td>{w.sessions}/{w.planned}</td>
                    <td className={w.adh < 50 ? 'low' : ''}>{w.adh}%</td>
                    <td>{w.kcal ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {ov && (
          <section className="card">
            <span className="label">Their plan · {ov.plan.name}</span>
            {ov.plan.days.map((d, i) => (
              <div key={i} className="ch-day">
                <b>{d.name || `Day ${i + 1}`}</b>
                <span className="hint">{d.exercises.map(e => e.name).join(' · ')}</span>
              </div>
            ))}
          </section>
        )}

        {res && (
          <button className={'btn ' + (arm ? 'danger' : 'secondary')} onClick={async () => {
            haptic('medium')
            if (!arm) { setArm(true); setTimeout(() => setArm(false), 3000); return }
            const r = await coachRemove(id)
            if (r.status === 200) onClose(); else setErr(errText(r.error || 'offline'))
          }}>{arm ? 'Tap again to remove this client' : 'Remove client'}</button>
        )}
      </div>
    </div>
  )
}
