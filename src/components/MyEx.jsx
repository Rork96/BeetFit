// Your own exercises: thumbnail + clip viewer, the editor (with a demo clip), and the "Add exercise" picker for a plan day.
import React, { useMemo, useRef, useState } from 'react'
import Ic from './Icons.jsx'
import { HowToThumb } from './HowTo.jsx'
import { EQLABEL, PATLABEL } from '../data/library.js'
import { exPool, DEFAULT_INTAKE } from '../lib/program.js'
import { myExOf, cleanCustom, customError, saveCustom, applyCustom, dropCustom, customToEx, addToDay, libToEx, clipUrl } from '../lib/myex.js'
import { prepClip, uploadClip, deleteClip, CLIP_ERR, CLIP_SECS } from '../lib/clip.js'
import { program as programOf } from '../lib/day.js'
import { useBackClose } from '../lib/hooks.js'
import { haptic, hapticSuccess } from '../lib/platform.js'
import './myex.css'

const ABBR = { squat: 'SQT', hinge: 'HNG', lunge: 'LNG', push: 'PSH', pull: 'PUL', core: 'COR', carry: 'CRY', cardio: 'CAR' }

export function Clip({ v, className = '', controls = false }) {
  const src = clipUrl(v)
  if (!src) return null
  return <video className={'mx-clip ' + className} src={src + '#t=0.05'} muted playsInline autoPlay loop preload="metadata" controls={controls} aria-hidden={!controls} />
}

// Small square next to an exercise: its own clip, a pattern tile for own exercises without one, or the built-in how-to.
export function ExThumb({ ex, onHow, onInfo }) {
  if (ex.video) return <button className="ht-thumb mx-thumb" onClick={() => { haptic(); onInfo(ex) }} aria-label={`Demo of ${ex.name}`}><Clip v={ex.video} /><i className="mx-play" aria-hidden="true" /></button>
  if (ex.custom) return <button className="ht-thumb mx-thumb pat" onClick={() => { haptic(); onInfo(ex) }} aria-label={`About ${ex.name}`}><i>{ABBR[ex.pattern] || '★'}</i></button>
  return <HowToThumb id={ex.id || ex.name} onOpen={onHow} />
}

export function ExInfoSheet({ ex, onClose, onEdit }) {
  useBackClose(true, onClose)
  return (
    <>
      <div className="sheet-back" onClick={() => history.back()} />
      <div className="sheet mx-info">
        <span className="label">Your exercise{ex.pattern ? ` · ${PATLABEL[ex.pattern] || ex.pattern}` : ''}</span>
        <h2>{ex.name}</h2>
        {ex.video ? <Clip v={ex.video} className="big" controls /> : <p className="hint">No demo clip yet.{onEdit ? ' Add one in Edit.' : ''}</p>}
        {ex.cue && <p className="ss-cue">{ex.cue}</p>}
        <p className="td-small num">{ex.sets} sets · {ex.reps}{ex.weight ? ` · ${ex.weight} kg` : ''}{ex.rest ? ` · rest ${ex.rest}s` : ''}</p>
        <div className="grid2">
          {onEdit && <button className="btn secondary" onClick={() => { haptic(); onEdit(ex.id) }}>Edit</button>}
          <button className="btn secondary" onClick={() => history.back()} style={onEdit ? undefined : { gridColumn: '1 / -1' }}>Close</button>
        </div>
      </div>
    </>
  )
}

const RESTS = [30, 45, 60, 75, 90, 120, 180]
const PATS = Object.keys(PATLABEL)
const EQS = Object.keys(EQLABEL)

// New or edit. Saving writes state.myEx and refreshes every plan day that uses it. onSaved(c) gets the cleaned exercise.
export function ExEditor({ state, update, id = null, pro, onSaved, onClose }) {
  useBackClose(true, onClose)
  const init = useMemo(() => myExOf(state).find(c => c.id === id) || null, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [d, setD] = useState(() => init || cleanCustom({ n: '', pat: 'squat', eq: ['none'], type: 'reps', sets: 3, reps: '8-12', rest: 75 }))
  const [clip, setClip] = useState({ state: 'idle', v: init?.video || null, p: 0, err: null })
  const [arm, setArm] = useState(false)
  const uploaded = useRef(new Set()) // keys uploaded in this editor, so a cancel can clean them up
  const fileRef = useRef(null)
  const set = (k, v) => setD(x => ({ ...x, [k]: v }))
  const err = customError(d, myExOf(state), state.program || [])
  const locked = pro?.on && !pro.pro
  const busy = clip.state === 'shrink' || clip.state === 'upload'

  const pick = async file => {
    if (!file) return
    setClip(c => ({ ...c, state: 'shrink', p: 0, err: null }))
    try {
      const r = await prepClip(file, p => setClip(c => ({ ...c, p })))
      setClip(c => ({ ...c, state: 'upload' }))
      const u = await uploadClip(r.blob, r.type)
      if (u.error) {
        setClip(c => ({ ...c, state: 'idle', err: CLIP_ERR[u.error] || CLIP_ERR.offline }))
        if (u.error === 'pro') pro?.open?.('video')
        return
      }
      uploaded.current.add(u.key)
      hapticSuccess()
      setClip({ state: 'idle', v: { key: u.key }, p: 1, err: null })
    } catch (e) {
      setClip(c => ({ ...c, state: 'idle', err: CLIP_ERR[e.message] || CLIP_ERR.unreadable }))
    }
  }

  const cancel = () => { for (const k of uploaded.current) deleteClip(k); history.back() }
  const save = () => {
    const c = cleanCustom({ ...d, video: clip.v })
    if (init?.video?.key && init.video.key !== clip.v?.key) deleteClip(init.video.key)
    for (const k of uploaded.current) if (k !== clip.v?.key) deleteClip(k)
    uploaded.current.clear()
    hapticSuccess()
    update(prev => { const myEx = saveCustom(prev.myEx, c); return { myEx, program: applyCustom(prev.program || programOf(prev).days, myEx) } })
    if (onSaved) onSaved(c) // the caller closes this sheet (and its own) by state
    else history.back()
  }
  const remove = () => {
    if (!arm) { haptic('medium'); setArm(true); setTimeout(() => setArm(false), 3000); return }
    if (init?.video?.key) deleteClip(init.video.key)
    for (const k of uploaded.current) deleteClip(k)
    update(prev => { const myEx = dropCustom(prev.myEx, init.id); return { myEx, program: applyCustom(prev.program || programOf(prev).days, myEx) } })
    history.back()
  }

  const hold = d.type === 'hold'
  return (
    <>
      <div className="sheet-back" onClick={cancel} />
      <div className="sheet mx-ed" role="dialog" aria-label={init ? 'Edit exercise' : 'New exercise'}>
        <span className="label">{init ? 'Edit your exercise' : 'New exercise'}</span>
        <label>Name<input value={d.n} maxLength={40} placeholder="e.g. Sled push, Cable kickback" onChange={e => set('n', e.target.value)} autoFocus={!init} /></label>

        <div className="mx-video">
          {clip.v ? (
            <div className="mx-prev">
              <Clip v={clip.v} />
              <div className="mx-prev-a">
                <button className="chip" disabled={busy} onClick={() => fileRef.current?.click()}>Replace</button>
                <button className="chip" disabled={busy} onClick={() => { haptic(); setClip(c => ({ ...c, v: null })) }}>Remove</button>
              </div>
            </div>
          ) : (
            <button className={'mx-add' + (locked ? ' locked' : '')} disabled={busy}
              onClick={() => { haptic(); if (locked) pro.open('video'); else fileRef.current?.click() }}>
              <Ic n="cam" className="solid" />
              <b>{busy ? (clip.state === 'shrink' ? `Preparing clip… ${Math.round(clip.p * 100)}%` : 'Uploading…') : 'Record or pick a demo'}</b>
              <small>{locked ? 'PRO' : `First ${CLIP_SECS} seconds, no sound. Side-on, whole body in frame.`}</small>
              {busy && <i className="mx-bar"><i style={{ transform: `scaleX(${clip.state === 'upload' ? 1 : clip.p})` }} /></i>}
            </button>
          )}
          <input ref={fileRef} type="file" accept="video/*" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; pick(f) }} />
          {clip.err && <p className="mx-err" role="alert">{clip.err}</p>}
        </div>

        <div className="mx-f"><b>Movement</b>
          <div className="chips wrap">{PATS.map(p => <button key={p} className={'chip' + (d.pat === p ? ' on' : '')} onClick={() => { haptic(); set('pat', p) }}>{PATLABEL[p]}</button>)}</div>
        </div>
        <div className="mx-f"><b>Equipment</b>
          <div className="chips wrap">{EQS.map(e => {
            const on = d.eq.includes(e)
            return <button key={e} aria-pressed={on} className={'chip' + (on ? ' on' : '')} onClick={() => { haptic(); set('eq', on ? d.eq.filter(x => x !== e) : [...d.eq.filter(x => e === 'none' ? false : x !== 'none'), e]) }}>{EQLABEL[e]}</button>
          })}</div>
        </div>
        <div className="set-row">
          <span className="set-l">Counted in</span>
          <div className="seg">
            <button className={!hold ? 'on' : ''} onClick={() => { haptic(); setD(x => ({ ...x, type: 'reps', reps: /s$/.test(x.reps) ? '10' : x.reps })) }}>Reps</button>
            <button className={hold ? 'on' : ''} onClick={() => { haptic(); setD(x => ({ ...x, type: 'hold', reps: /s$/.test(x.reps) ? x.reps : '30s' })) }}>Seconds</button>
          </div>
        </div>
        <div className="mx-grid">
          <label>Sets
            <div className="fc-step mini">
              <button onClick={() => set('sets', Math.max(1, d.sets - 1))} aria-label="Fewer sets">−</button>
              <span className="num">{d.sets}</span>
              <button onClick={() => set('sets', Math.min(10, d.sets + 1))} aria-label="More sets">+</button>
            </div>
          </label>
          <label>{hold ? 'Hold' : 'Reps'}<input value={d.reps} maxLength={24} placeholder={hold ? '30s' : '8-12'} onChange={e => set('reps', e.target.value)} /></label>
          <label>Rest<select value={d.rest} onChange={e => set('rest', +e.target.value)}>{RESTS.map(r => <option key={r} value={r}>{r % 60 ? `${r}s` : `${r / 60} min`}</option>)}</select></label>
          <label>Weight, kg<input type="number" inputMode="decimal" value={d.weight || ''} placeholder="0" onChange={e => set('weight', +e.target.value || 0)} /></label>
        </div>
        <label>Coaching cue<textarea rows={2} maxLength={140} value={d.cue} placeholder="What to watch for: one or two short lines" onChange={e => set('cue', e.target.value)} /></label>

        {err && d.n.trim().length > 1 && <p className="mx-err">{err}</p>}
        <button className="btn" disabled={!!err || busy} onClick={save}>{init ? 'Save' : onSaved ? 'Save and add to this day' : 'Save exercise'}</button>
        <div className={init ? 'grid2' : ''}>
          <button className="btn secondary" style={!init ? { width: '100%' } : undefined} onClick={cancel}>Cancel</button>
          {init && <button className={'btn ' + (arm ? 'danger' : 'secondary')} onClick={remove}>{arm ? 'Tap again to delete' : 'Delete'}</button>}
        </div>
      </div>
    </>
  )
}

// "+ Add exercise" for one plan day: your own exercises first, then the library that fits your setup.
export function AddExSheet({ state, update, dayIdx, pro, onClose }) {
  useBackClose(true, onClose)
  const it = state.intake || DEFAULT_INTAKE
  const mine = myExOf(state)
  const [tab, setTab] = useState(mine.length ? 'mine' : 'lib')
  const [q, setQ] = useState('')
  const [editor, setEditor] = useState(false)
  const day = programOf(state).days[dayIdx]
  const has = new Set(day?.exercises.map(e => e.name))
  const lib = useMemo(() => exPool(it).filter(L => !q || L.n.toLowerCase().includes(q.toLowerCase()) || L.pri.toLowerCase().includes(q.toLowerCase())), [it, q])
  const put = ex => {
    hapticSuccess()
    update(prev => ({ program: addToDay(prev.program?.length ? prev.program : programOf(prev).days, dayIdx, ex) }))
    history.back()
  }
  return (
    <>
      <div className="sheet-back" onClick={() => history.back()} />
      <div className="sheet mx-pick">
        <span className="label">Add to {day?.name.split('—')[0].trim()}</span>
        <div className="seg mx-tabs">
          <button className={tab === 'mine' ? 'on' : ''} onClick={() => { haptic(); setTab('mine') }}>Mine <span className="num">{mine.length}</span></button>
          <button className={tab === 'lib' ? 'on' : ''} onClick={() => { haptic(); setTab('lib') }}>Library</button>
        </div>
        {tab === 'mine' ? (
          <div className="mx-list">
            <button className="mx-new" onClick={() => { haptic(); setEditor(true) }}><Ic n="plus" /><b>New exercise</b><small>Your name, your cue, your demo clip</small></button>
            {mine.map(c => {
              const ex = customToEx(c), in_ = has.has(ex.name)
              return (
                <button key={c.id} className="lib-item" disabled={in_} onClick={() => put(ex)}>
                  <span className="lib-thumb mx-lt">{c.video ? <Clip v={c.video} /> : <i className="lib-pat">{ABBR[c.pat] || '★'}</i>}</span>
                  <div style={{ flex: 1, minWidth: 0 }}><b>{c.n}</b><span className="sub num">{c.sets} × {c.reps}{in_ ? ' · already in this day' : ''}</span></div>
                </button>
              )
            })}
            {!mine.length && <p className="hint">Exercises you make show up here, ready for any day of your plan.</p>}
          </div>
        ) : (
          <div className="mx-list">
            <input className="mx-q" value={q} placeholder="Search: row, glutes, press…" onChange={e => setQ(e.target.value)} />
            {!mine.length && <button className="mx-new" onClick={() => { haptic(); setEditor(true) }}><Ic n="plus" /><b>New exercise</b><small>Not in the list? Make your own, with a demo clip</small></button>}
            {lib.map(L => {
              const in_ = has.has(L.n)
              return (
                <button key={L.id} className="lib-item" disabled={in_} onClick={() => put(libToEx(L, it))}>
                  <span className="lib-thumb"><i className="lib-pat">{ABBR[L.pat]}</i></span>
                  <div style={{ flex: 1, minWidth: 0 }}><b>{L.n}</b><span className="sub">{L.pri}{in_ ? ' · already in this day' : ''}</span></div>
                </button>
              )
            })}
            {!lib.length && <p className="hint">Nothing matches. Make it your own exercise under Mine.</p>}
          </div>
        )}
      </div>
      {editor && <ExEditor state={state} update={update} pro={pro} onClose={() => setEditor(false)}
        onSaved={c => { update(prev => ({ program: addToDay(prev.program?.length ? prev.program : programOf(prev).days, dayIdx, customToEx(c)) })); onClose() }} />}
    </>
  )
}
