import React, { useMemo, useState } from 'react'
import { BeetEmpty } from './BeetMascot.jsx'
import Ic from './Icons.jsx'
import { LIB, CUEX, EQLABEL, PATLABEL } from '../data/library.js'
import HowToSheet, { ExerciseAnim, howtoFor } from './HowTo.jsx'
import { availOf, DEFAULT_INTAKE } from '../lib/program.js'
import { TRACKER_BY_NAME } from '../camera/pose/exercises.js'
import { haptic } from '../lib/platform.js'
import { useBackClose } from '../lib/hooks.js'
import { ExEditor, Clip } from './MyEx.jsx'
import { myExOf } from '../lib/myex.js'

const CATS = ['All', 'Legs', 'Push', 'Pull', 'Core', 'Cardio']
const ABBR = { squat: 'SQT', hinge: 'HNG', lunge: 'LNG', push: 'PSH', pull: 'PUL', core: 'COR', carry: 'CRY', cardio: 'CAR' }

const LVL = { beginner: 1, novice: 1, easy: 1, intermediate: 2, medium: 2, advanced: 3, hard: 3 }

export default function Library({ state, update, pro, onClose }) {
  const it = state.intake || DEFAULT_INTAKE
  const [cat, setCat] = useState('All')
  const [onlyFit, setOnlyFit] = useState(true)
  const [open, setOpen] = useState(null)
  const [how, setHow] = useState(null)
  useBackClose(!!open, () => setOpen(null))
  const [edit, setEdit] = useState(null) // 'new' | id of your exercise
  const mine = myExOf(state)

  const rows = useMemo(() => LIB
    .filter(L => cat === 'All' || L.cat === cat)
    .map(L => ({ L, a: availOf(L, it), cam: !!TRACKER_BY_NAME[L.n] }))
    .filter(r => !onlyFit || r.a.ok), [cat, onlyFit, it])

  return (
    <div className="screen">
      <header className="screen-top">
        <button className="td-icon" onClick={onClose} aria-label="Back">←</button>
        <h2>Exercise library</h2>
        <span className="num td-small" style={{ width: 44, textAlign: 'right' }}>{rows.length}</span>
      </header>
      <div className="page" style={{ paddingTop: 4 }}>
        {update && cat === 'All' && (
          <div className="card lib-mine">
            <div className="row"><span className="label">Your exercises</span><span className="num td-small">{mine.length}</span></div>
            {mine.map(c => (
              <button key={c.id} className="lib-item" onClick={() => { haptic(); setEdit(c.id) }}>
                <span className="lib-thumb">{c.video ? <Clip v={c.video} /> : <i className="lib-pat">{ABBR[c.pat] || '★'}</i>}</span>
                <div style={{ flex: 1, minWidth: 0 }}><b>{c.n}</b><span className="sub num">{c.sets} × {c.reps}{c.video ? ' · demo clip' : ''}</span></div>
              </button>
            ))}
            <button className="btn secondary btn-ic" onClick={() => { haptic(); setEdit('new') }}><Ic n="plus" />New exercise</button>
            {!mine.length && <p className="hint" style={{ margin: 0 }}>Missing a move? Make it yours: name, cue, demo clip. Then add it to any day from Train → Edit.</p>}
          </div>
        )}
        <div className="chips">
          {CATS.map(c => <button key={c} className={'chip' + (cat === c ? ' on' : '')} onClick={() => { haptic(); setCat(c) }}>{c}</button>)}
        </div>
        <div className="set-row">
          <div className="set-l" style={{ fontSize: 14 }}>Only what fits my setup</div>
          <button className={'tgl' + (onlyFit ? ' on' : '')} role="switch" aria-checked={onlyFit} onClick={() => { haptic(); setOnlyFit(v => !v) }}><i /></button>
        </div>
        <div className="card stk" key={cat + onlyFit}>
          {rows.map(({ L, a, cam }) => (
            <button key={L.id} className={'lib-item' + (a.ok ? '' : ' off')} onClick={() => { haptic(); setOpen(L) }}>
              <span className="lib-thumb">{howtoFor(L.id) ? <ExerciseAnim H={howtoFor(L.id).H} size="sm" play={false} pin={Math.min(1, howtoFor(L.id).H.f.length - 1)} /> : <i className="lib-pat">{ABBR[L.pat] || L.pat.slice(0, 3)}</i>}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{L.n}{cam && <span className="ex-cam i"><Ic n="cam" className="solid" label="Camera counts reps" /></span>}</b>
                <span className="sub">{L.pri}{L.sec ? ` · ${L.sec}` : ''}{a.ok ? '' : ` — ${a.why}`}</span>
              </div>
            </button>
          ))}
          {rows.length === 0 && <BeetEmpty mood="tired" title="Nothing fits your setup" hint="Turn off the filter to see every exercise." />}
        </div>
      </div>

      {open && (
        <>
          <div className="sheet-back" onClick={() => history.back()} />
          <div className="sheet">
            <span className="label">{open.cat} · {PATLABEL[open.pat]}</span>
            <h2>{open.n}</h2>
            {howtoFor(open.id) && <button className="ht-lib" onClick={() => { haptic(); setHow(open.id) }} aria-label={`How to do ${open.n}`}><ExerciseAnim H={howtoFor(open.id).H} size="lg" /><span className="btn small">▶ Step by step</span></button>}
            {CUEX[open.n] && <p className="ss-cue">{CUEX[open.n]}</p>}
            <div className="lib-mus" aria-label={`Works ${open.pri}${open.sec ? `, also ${open.sec}` : ''}`}>
              {open.pri.split(/,\s*/).map(m => <span key={m} className="pri">{m}</span>)}
              {(open.sec || '').split(/,\s*/).filter(Boolean).map(m => <span key={m}>{m}</span>)}
            </div>
            <div className="lib-facts">
              <div aria-label={`Equipment: ${open.eq.map(e => EQLABEL[e] || e).join(' or ')}`}><Ic n="weight" /><span>{open.eq.map(e => EQLABEL[e] || e).join(' / ')}</span></div>
              <div aria-label={`Level: ${open.lvl}`}><span className="lib-lvl">{[0, 1, 2].map(i => <i key={i} className={i < (LVL[open.lvl] || 1) ? 'on' : ''} />)}</span><span>{open.lvl}</span></div>
              <div aria-label={open.type === 'hold' ? `Hold ${open.dr} seconds` : `${open.dr} reps`}><Ic n={open.type === 'hold' ? 'timer' : 'reps'} /><span className="num">{open.type === 'hold' ? `${open.dr}s` : open.dr}</span></div>
              {TRACKER_BY_NAME[open.n] && <div className="cam" aria-label="The camera counts this one automatically"><Ic n="cam" className="solid" /><span>auto count</span></div>}
            </div>
            <button className="btn secondary" onClick={() => history.back()}>Close</button>
          </div>
        </>
      )}
      {how && <HowToSheet id={how} onClose={() => setHow(null)} onOpen={setHow} />}
      {edit && <ExEditor state={state} update={update} pro={pro} id={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  )
}
