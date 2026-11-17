import React, { useEffect, useState } from 'react'
import { fetchReview, REVIEW_ERR } from '../lib/review.js'
import { applySwap } from '../lib/program.js'
import { haptic, hapticSuccess } from '../lib/platform.js'
import './planreview.css'

// A personal read of the plan: what it does for this person, a few practical notes, and swaps they can accept.
export default function PlanReview({ profile, intake, program, onChange, auto = false }) {
  const [st, setSt] = useState('idle') // idle | busy | done | err
  const [r, setR] = useState(null)
  const [err, setErr] = useState('')
  const [taken, setTaken] = useState([])

  const run = async () => {
    haptic(); setSt('busy'); setErr('')
    const res = await fetchReview(profile, intake, program)
    if (res.status === 200 && res.summary) { setR(res); setSt('done') } else { setErr(REVIEW_ERR[res.error] || 'Couldn’t get a review.'); setSt('err') }
  }
  useEffect(() => { if (auto) run() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const take = s => { hapticSuccess(); onChange(applySwap(program, s, intake)); setTaken(t => [...t, s.day + s.from]) }
  const open = r?.swaps?.filter(s => !taken.includes(s.day + s.from) && program[s.day]?.exercises.some(e => e.id === s.from)) || []

  return (
    <div className="card pv">
      <span className="label">Coach review of your plan</span>
      {st === 'idle' && (
        <>
          <p className="hint">Beet reads your answers (sleep, stress, kit, injuries, week) against this plan and suggests changes. You decide what to accept.</p>
          <button className="btn secondary" onClick={run}>Review my plan</button>
        </>
      )}
      {st === 'busy' && <div className="pv-skel" aria-label="Reviewing"><i /><i /><i /></div>}
      {st === 'err' && (
        <>
          <p className="sy-err">{err}</p>
          <button className="btn small secondary" onClick={run}>Try again</button>
        </>
      )}
      {st === 'done' && r && (
        <>
          <p className="pv-sum">{r.summary}</p>
          {r.notes.map(n => <div key={n.title} className="pv-note"><b>{n.title}</b><span>{n.text}</span></div>)}
          {open.map(s => (
            <div key={s.day + s.from} className="pv-swap">
              <div><span className="hint">{program[s.day]?.name}</span><b>{s.fromName} → {s.toName}</b><span>{s.why}</span></div>
              <button className="btn small" onClick={() => take(s)}>Swap</button>
            </div>
          ))}
          {taken.length > 0 && <p className="hint">{taken.length} swap{taken.length > 1 ? 's' : ''} applied.</p>}
          <p className="hint pv-fine">AI-written guidance, not medical advice. Stop if something hurts and see a clinician if it persists.</p>
        </>
      )}
    </div>
  )
}
