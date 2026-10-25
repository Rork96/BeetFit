import React, { useEffect, useRef, useState } from 'react'
import { haptic } from '../lib/platform.js'
import { askBeet, loadChat, saveChat, suggestions, BEET_ERR } from '../lib/beet.js'
import './beet.css'

// Today card: a way in, with questions picked from today's data.
export function BeetCard({ state, onAsk }) {
  const qs = suggestions(state).slice(0, 2)
  return (
    <div className="card bt-card">
      <div className="bt-head">
        <BeetMark />
        <div><b>Ask Beet</b><span className="hint">Knows your plan, targets and today’s log</span></div>
      </div>
      <div className="bt-sugg">
        {qs.map(q => <button key={q} className="chip" onClick={() => { haptic(); onAsk(q) }}>{q}</button>)}
      </div>
      <button className="btn secondary" onClick={() => { haptic(); onAsk(null) }}>Open chat</button>
    </div>
  )
}

export function BeetMark({ busy }) {
  return <span className={'bt-mark' + (busy ? ' busy' : '')}><i /><i /><i /></span>
}

export default function BeetChat({ state, first, onClose }) {
  const [msgs, setMsgs] = useState(loadChat)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef(null)
  const sentFirst = useRef(false)

  useEffect(() => { saveChat(msgs); end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [msgs, busy])

  const send = async q => {
    const t = (q ?? text).trim()
    if (!t || busy) return
    haptic(); setText('')
    const history = [...msgs, { role: 'user', text: t, at: Date.now() }]
    setMsgs(history); setBusy(true)
    const r = await askBeet(history, state)
    setBusy(false)
    if (r.status === 200 && r.text) setMsgs(m => [...m, { role: 'model', text: r.text, at: Date.now() }])
    else setMsgs(m => [...m, { role: 'model', text: BEET_ERR[r.error] || `Something went wrong (${r.error || r.status}).`, error: true, at: Date.now() }])
  }
  useEffect(() => { if (first && !sentFirst.current) { sentFirst.current = true; send(first) } }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const qs = suggestions(state)
  return (
    <div className="screen bt-screen">
      <header className="screen-top">
        <button className="td-icon" onClick={onClose} aria-label="Back">←</button>
        <div className="bt-title"><BeetMark busy={busy} /><h2>Beet</h2></div>
        {msgs.length ? <button className="td-icon" aria-label="Clear chat" onClick={() => { haptic('medium'); setMsgs([]) }}>⌫</button> : <span style={{ width: 44 }} />}
      </header>
      <div className="page bt-page">
        {!msgs.length && (
          <div className="bt-empty stk">
            <h1>What do you need?</h1>
            <p className="hint">Beet sees your plan, targets, today’s food and water, recent weights, check-ins and pain reports. It isn’t a doctor.</p>
            <div className="bt-sugg col">
              {qs.map((q, i) => <button key={q} className="chip" style={{ animationDelay: `${i * 60}ms` }} onClick={() => send(q)}>{q}</button>)}
            </div>
          </div>
        )}
        <div className="bt-msgs">
          {msgs.map((m, i) => (
            <div key={i} className={'bt-msg ' + (m.role === 'user' ? 'me' : 'beet') + (m.error ? ' err' : '')}>
              {m.text.split('\n').map((l, j) => (l.trim() ? <p key={j}>{l}</p> : null))}
            </div>
          ))}
          {busy && <div className="bt-msg beet typing"><BeetMark busy /></div>}
          <i ref={end} />
        </div>
      </div>
      <div className="bt-input">
        <textarea rows={1} value={text} maxLength={1500} placeholder="Ask about training or food"
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
        <button className="btn" disabled={!text.trim() || busy} onClick={() => send()}>Send</button>
      </div>
    </div>
  )
}
