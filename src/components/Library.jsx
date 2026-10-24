import React, { useMemo, useState } from 'react'
import { LIB, CUEX, EQLABEL, PATLABEL } from '../data/library.js'
import { availOf, DEFAULT_INTAKE } from '../lib/program.js'
import { TRACKER_BY_NAME } from '../camera/pose/exercises.js'
import { haptic } from '../lib/platform.js'
import { useBackClose } from '../lib/hooks.js'

const CATS = ['All', 'Legs', 'Push', 'Pull', 'Core', 'Cardio']
const ABBR = { squat: 'SQT', hinge: 'HNG', lunge: 'LNG', push: 'PSH', pull: 'PUL', core: 'COR', carry: 'CRY', cardio: 'CAR' }

export default function Library({ state, onClose }) {
  const it = state.intake || DEFAULT_INTAKE
  const [cat, setCat] = useState('All')
  const [onlyFit, setOnlyFit] = useState(true)
  const [open, setOpen] = useState(null)
  useBackClose(!!open, () => setOpen(null))

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
              <span className="lib-pat">{ABBR[L.pat] || L.pat.slice(0, 3)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{L.n}{cam && <span className="ex-cam">▣ cam</span>}</b>
                <span className="sub">{L.pri}{L.sec ? ` · ${L.sec}` : ''}{a.ok ? '' : ` — ${a.why}`}</span>
              </div>
            </button>
          ))}
          {rows.length === 0 && <p className="hint">Nothing here fits your setup. Turn off the filter to see everything.</p>}
        </div>
      </div>

      {open && (
        <>
          <div className="sheet-back" onClick={() => history.back()} />
          <div className="sheet">
            <span className="label">{open.cat} · {PATLABEL[open.pat]}</span>
            <h2>{open.n}</h2>
            {CUEX[open.n] && <p className="ss-cue">{CUEX[open.n]}</p>}
            <div className="grid2">
              <div className="stat"><div className="v" style={{ fontSize: 14 }}>{open.pri}</div><div className="l">primary</div></div>
              <div className="stat"><div className="v" style={{ fontSize: 14 }}>{open.sec || '—'}</div><div className="l">secondary</div></div>
            </div>
            <p className="hint">Equipment: {open.eq.map(e => EQLABEL[e] || e).join(' or ')} · Level: {open.lvl} · {open.type === 'hold' ? `hold ${open.dr}s` : `${open.dr} reps`}</p>
            {TRACKER_BY_NAME[open.n] && <p className="hint" style={{ color: 'var(--accent)' }}>▣ The camera counts this one automatically.</p>}
            <button className="btn secondary" onClick={() => history.back()}>Close</button>
          </div>
        </>
      )}
    </div>
  )
}
