import React, { useEffect, useRef, useState } from 'react'
import { Pips } from './Icons.jsx'
import { haptic } from '../lib/platform.js'
import { fetchStatus, useUsage, usageLeft } from '../lib/billing.js'
import { askBeet, loadChat, saveChat, suggestions, BEET_ERR } from '../lib/beet.js'
import BeetMascot from './BeetMascot.jsx'
import './beet.css'

// Today card: a way in, with questions picked from today's data.
export function BeetCard({ state, onAsk }) {
  const qs = suggestions(state).slice(0, 2)
  return (
    <div className="card bt-card">
      <div className="bt-head">
        <BeetMascot size={44} mood="happy" bubble="right" />
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

export default function BeetChat({ state, first, onClose, onUpgrade, embedded }) {
  const [msgs, setMsgs] = useState(loadChat)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef(null)
  const sentFirst = useRef(false)
  const usage = useUsage()
  const left = usageLeft(usage, 'chats')

  useEffect(() => { saveChat(msgs); end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [msgs, busy])

  const send = async q => {
    const t = (q ?? text).trim()
    if (!t || busy) return
    haptic(); setText('')
    const history = [...msgs, { role: 'user', text: t, at: Date.now() }]
    setMsgs(history); setBusy(true)
    const r = await askBeet(history, state)
    setBusy(false)
    if (onUpgrade) fetchStatus()
    if (r.status === 200 && r.text) setMsgs(m => [...m, { role: 'model', text: r.text, at: Date.now() }])
    else if (r.error === 'daily_limit' && r.pro === false) setMsgs(m => [...m, { role: 'model', text: `That was today’s ${r.limit || 5} free questions. Beet is back tomorrow, or keep going with PRO.`, error: true, upgrade: true, at: Date.now() }])
    else setMsgs(m => [...m, { role: 'model', text: BEET_ERR[r.error] || `Something went wrong (${r.error || r.status}).`, error: true, at: Date.now() }])
  }
  useEffect(() => { if (first && !sentFirst.current) { sentFirst.current = true; send(first) } }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const qs = suggestions(state)
  return (
    <div className={embedded ? 'bt-screen bt-tab' : 'screen bt-screen'}>
      <header className="screen-top">
        {embedded ? <span style={{ width: 44 }} /> : <button className="td-icon" onClick={onClose} aria-label="Back">←</button>}
        <div className="bt-title"><BeetMascot size={30} mood={busy ? 'think' : 'idle'} bubble="bottom" /><h2>Beet</h2></div>
        {msgs.length ? <button className="td-icon" aria-label="Clear chat" onClick={() => { haptic('medium'); setMsgs([]) }}>⌫</button> : <span style={{ width: 44 }} />}
      </header>
      <div className="page bt-page">
        {!msgs.length && (
          <div className="bt-empty stk">
            <div className="bt-hello"><BeetMascot size={104} mood="idle" title="Beet" bubble="right" /></div>
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
              {m.upgrade && onUpgrade && i === msgs.length - 1 && <button className="btn small bt-up" onClick={() => { haptic(); onUpgrade() }}>See PRO</button>}
            </div>
          ))}
          {busy && <div className="bt-msg beet typing"><BeetMascot size={40} mood="think" title="Beet is thinking" tap={false} /></div>}
          <i ref={end} />
        </div>
      </div>
      <div className="bt-foot">
      {onUpgrade && left != null && (
        <button className={'bt-meter' + (left <= 1 ? ' low' : '')} onClick={() => { haptic(); onUpgrade() }}>
          <Pips left={left} limit={usage?.chats?.limit} /><span className="num">{left}</span> free {left === 1 ? 'question' : 'questions'} left · <u>PRO has 60</u>
        </button>
      )}
      <div className="bt-input">
        <textarea rows={1} value={text} maxLength={1500} placeholder="Ask about training or food"
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
        <button className="btn" disabled={!text.trim() || busy} onClick={() => send()}>Send</button>
      </div>
      </div>
    </div>
  )
}
