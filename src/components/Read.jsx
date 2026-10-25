import React, { useState } from 'react'
import { haptic } from '../lib/platform.js'
import { useBackClose } from '../lib/hooks.js'
import { GUIDES, guideById, pickGuides } from '../data/guides.js'
import './read.css'

const KEY = 'beetfit_read'
const readList = () => { try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] } }
const markRead = id => { try { const r = readList(); if (!r.includes(id)) localStorage.setItem(KEY, JSON.stringify([...r, id])) } catch { /* ignore */ } }

export function ReadCard({ state, onOpen }) {
  const picks = pickGuides(state, readList())
  return (
    <div className="card">
      <div className="row"><span className="label">Read · 2 min</span><button className="rd-all" onClick={() => { haptic(); onOpen(null) }}>All guides →</button></div>
      {picks.map(g => (
        <button key={g.id} className="rd-item" onClick={() => { haptic(); onOpen(g.id) }}>
          <span className="rd-cat">{g.cat}</span>
          <b>{g.title}</b>
          <span className="hint">{g.lead}</span>
        </button>
      ))}
    </div>
  )
}

export default function Guides({ first, onClose }) {
  const [open, setOpen] = useState(first || null)
  const [read, setRead] = useState(readList)
  const openG = id => { haptic(); setOpen(id) }
  useBackClose(!!open && open !== first, () => setOpen(first || null))
  const cats = [...new Set(GUIDES.map(g => g.cat))]

  if (open) {
    const g = guideById(open)
    return <Article g={g} onClose={() => (open === first ? onClose() : history.back())} onDone={() => { markRead(g.id); setRead(readList()) }} next={GUIDES[(GUIDES.indexOf(g) + 1) % GUIDES.length]} onNext={id => { markRead(g.id); setRead(readList()); setOpen(id); window.scrollTo(0, 0) }} />
  }
  return (
    <div className="screen rd-screen">
      <header className="screen-top">
        <button className="td-icon" onClick={onClose} aria-label="Back">←</button>
        <h2>Guides</h2>
        <span className="hint num" style={{ width: 44, textAlign: 'right' }}>{read.length}/{GUIDES.length}</span>
      </header>
      <div className="page stk">
        {cats.map(c => (
          <section key={c} className="stk">
            <span className="label">{c}</span>
            {GUIDES.filter(g => g.cat === c).map((g, i) => (
              <button key={g.id} className={'card rd-row' + (read.includes(g.id) ? ' done' : '')} style={{ animationDelay: `${i * 40}ms` }} onClick={() => openG(g.id)}>
                <div><b>{g.title}</b><span className="hint">{g.lead}</span></div>
                <span className="num rd-min">{read.includes(g.id) ? '✓' : `${g.mins} min`}</span>
              </button>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}

function Article({ g, onClose, onDone, next, onNext }) {
  return (
    <div className="screen rd-screen" key={g.id}>
      <header className="screen-top">
        <button className="td-icon" onClick={onClose} aria-label="Back">←</button>
        <span className="label">{g.cat} · {g.mins} min</span>
        <span style={{ width: 44 }} />
      </header>
      <article className="page rd-art">
        <h1>{g.title}</h1>
        <p className="rd-lead">{g.lead}</p>
        {g.body.map((b, i) => (
          b.h ? <h3 key={i}>{b.h}</h3>
            : b.ul ? <ul key={i}>{b.ul.map(x => <li key={x}>{x}</li>)}</ul>
              : b.tip ? <p key={i} className="rd-tip">{b.tip}</p>
                : <p key={i}>{b.p}</p>
        ))}
        {g.sources && (
          <div className="rd-src">
            <span className="label">Sources</span>
            {g.sources.map(s => <a key={s.u} href={s.u} target="_blank" rel="noreferrer">{s.t}</a>)}
          </div>
        )}
        <p className="hint rd-note">General information, not medical advice.</p>
        <div className="grid2">
          <button className="btn secondary" onClick={() => { onDone(); onClose() }}>Done</button>
          <button className="btn" onClick={() => onNext(next.id)}>Next: {next.title.length > 18 ? next.title.slice(0, 17) + '…' : next.title}</button>
        </div>
      </article>
    </div>
  )
}
