import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'motion/react'
import { LIB, PATLABEL } from '../data/library.js'
import { HOWTO } from '../data/howto.js'
import { poseBetween, legs, bounds, ease, LEN } from '../lib/pose2d.js'
import { solveFront, solveFront2, FRONT_BOX } from '../lib/front2d.js'
import { haptic } from '../lib/platform.js'
import { useBackClose } from '../lib/hooks.js'
import './howto.css'

const solve = (spec, a, b, t) => (spec.view === 'front' ? solveFront(spec, a, b, t) : spec.view === 'front2' ? solveFront2(spec, a, b, t) : poseBetween(spec, a, b, t))
const isFront = spec => spec.view === 'front' || spec.view === 'front2'

const BYID = Object.fromEntries(LIB.map(l => [l.id, l]))
export const howtoFor = idOrName => {
  const L = BYID[idOrName] || LIB.find(l => l.n === idOrName)
  return L && HOWTO[L.id] ? { L, H: HOWTO[L.id] } : null
}

const seenKey = 'beetfit_howto_seen'
const readSeen = () => { try { return JSON.parse(localStorage.getItem(seenKey) || '{}') } catch { return {} } }
export const isSeen = id => !!readSeen()[id]
export const markSeen = id => { try { const s = readSeen(); s[id] = 1; localStorage.setItem(seenKey, JSON.stringify(s)) } catch { /* private mode */ } }

const LEN_T = LEN.torso
const ln = (a, b) => ({ x1: a[0], y1: -a[1], x2: b[0], y2: -b[1] })

// One drawn figure for joints `j`. y is flipped here (the maths is y-up).
export function Figure({ j, spec, box }) {
  const hl = new Set(spec.hl || [])
  const seg = (name, a, b, w = 3.6) => <line key={name} {...ln(a, b)} className={'ht-seg' + (hl.has(name) ? ' hl' : '')} strokeWidth={name === 'torso' ? 5.2 : w} />
  const dim = (a, b, k) => <line key={k} {...ln(a, b)} className="ht-seg dim" strokeWidth={3.2} />
  const gy = spec.gy ?? 0
  const eq = (spec.eq || []).map((e, i) => <Equip key={i} e={e} j={j} spec={spec} box={box} />)
  return (
    <>
      {spec.ground !== false && <line x1={box.x0 - 6} x2={box.x1 + 6} y1={-gy} y2={-gy} className="ht-ground" />}
      {eq}
      {j.knee2 && <>{dim(j.hip, j.knee2, 'k2')}{dim(j.knee2, j.ankle2, 'a2')}{dim(j.ankle2, j.toe2, 't2')}</>}
      {j.elbow2 && <>{dim(j.shoulder, j.elbow2, 'e2')}{dim(j.elbow2, j.wrist2, 'w2')}</>}
      {seg('shin', j.ankle, j.knee)}
      {seg('thigh', j.knee, j.hip)}
      {seg('foot', j.ankle, j.toe, 3)}
      {j.arch?.[0] ? <path d={`M${j.hip[0]} ${-j.hip[1]} Q${(j.hip[0] + j.shoulder[0]) / 2 - (j.shoulder[1] - j.hip[1]) / (LEN_T) * j.arch[0] * 2} ${-(j.hip[1] + j.shoulder[1]) / 2 - (j.shoulder[0] - j.hip[0]) / (LEN_T) * j.arch[0] * 2} ${j.shoulder[0]} ${-j.shoulder[1]}`} className={'ht-seg' + (hl.has('torso') ? ' hl' : '')} strokeWidth={5.2} /> : seg('torso', j.hip, j.shoulder)}
      {seg('ua', j.shoulder, j.elbow)}
      {seg('fa', j.elbow, j.wrist)}
      <circle cx={j.head[0]} cy={-j.head[1]} r={6.2} className="ht-head" />
    </>
  )
}

export function FrontFigure({ j, wall, hl = 'arms' }) {
  const L = (a, b, c = 'ht-seg', w = 3.6) => <line {...ln(a, b)} className={c} strokeWidth={w} />
  return (
    <>
      <line x1={-44} x2={44} y1={0} y2={0} className="ht-ground" />
      {wall && <rect x={-46} y={-114} width={92} height={114} className="ht-eq bench" />}
      {L(j.hipL, j.kneeL)}{L(j.kneeL, j.ankleL)}{L(j.hipR, j.kneeR)}{L(j.kneeR, j.ankleR)}
      {L(j.hipC, j.neck, 'ht-seg', 5.2)}
      {L(j.shL, j.shR, 'ht-seg', 4)}{L(j.hipL, j.hipR, 'ht-seg', 4)}
      {(() => { const c = hl === 'arms' ? 'ht-seg hl' : 'ht-seg'; return <>{L(j.shL, j.elL, c)}{L(j.elL, j.wrL, c)}{L(j.shR, j.elR, c)}{L(j.elR, j.wrR, c)}</> })()}
      {hl === 'hips' && L(j.hipL, j.hipR, 'ht-seg hl', 5)}
      <circle cx={j.wrL[0]} cy={-j.wrL[1]} r={4.4} className="ht-eq fill" /><circle cx={j.wrR[0]} cy={-j.wrR[1]} r={4.4} className="ht-eq fill" />
      <circle cx={j.head[0]} cy={-j.head[1]} r={6.2} className="ht-head" />
    </>
  )
}

function Equip({ e, j, spec, box }) {
  const [kind, at] = e.split('@')
  const P = j[at] || (at === 'ankle2' && j.ankle2) || j.wrist
  if (kind === 'db') return <circle cx={P[0]} cy={-P[1]} r={4.6} className="ht-eq fill" />
  if (kind === 'bell') return <><circle cx={P[0]} cy={-P[1] - 1} r={5.6} className="ht-eq fill" /><path d={`M${P[0] - 3} ${-P[1] - 6}a3 3 0 0 1 6 0`} className="ht-eq line" fill="none" /></>
  if (kind === 'bar') return <circle cx={P[0]} cy={-P[1]} r={7} className="ht-eq fill" />
  if (kind === 'dbh') return <line x1={P[0] - 6} x2={P[0] + 6} y1={-P[1]} y2={-P[1]} className="ht-eq thick" />
  if (kind === 'grip') return <circle cx={P[0]} cy={-P[1]} r={3} className="ht-eq fill" />
  if (kind === 'bench') {
    // flat bench under the back, or only under the shoulders (hip thrust)
    const top = (spec.benchTop ?? 24)
    const x0 = at === 'shoulder' ? j.shoulder[0] - 10 : Math.min(j.hip[0], j.shoulder[0]) - 8
    const x1 = at === 'shoulder' ? j.shoulder[0] + 10 : Math.max(j.hip[0], j.shoulder[0]) + 12
    return <rect x={x0} y={-top} width={x1 - x0} height={top} rx={2} className="ht-eq bench" />
  }
  if (kind === 'step') {
    const top = spec.stepTop ?? 33
    return <rect x={P[0] - 10} y={-top} width={20} height={top} rx={2} className="ht-eq bench" />
  }
  if (kind === 'wall') return <line x1={P[0] + (spec.wallX ?? -8)} x2={P[0] + (spec.wallX ?? -8)} y1={-70} y2={4} className="ht-eq thick" />
  if (kind === 'plate') return <line x1={P[0] + 3 - 12} x2={P[0] + 3 + 12} y1={-P[1] - 3 + 12} y2={-P[1] - 3 - 12} className="ht-eq thick" />
  if (kind === 'band' && spec.band) { const a = j.ankle; return <line x1={a[0]} y1={-a[1]} x2={j.wrist[0]} y2={-j.wrist[1]} className="ht-eq line" /> }
  if (kind === 'cable' && spec.cable) {
    const s0 = spec.cable
    return <line x1={j.wrist[0]} y1={-j.wrist[1]} x2={s0[0]} y2={-s0[1]} className="ht-eq line" />
  }
  if (kind === 'ledge') { const top = spec.ledgeTop ?? 41; const x = spec.ledgeX ?? 76; return <><line x1={x - 2} x2={x + 30} y1={-top} y2={-top} className="ht-eq thick" /><line x1={x + 28} x2={x + 28} y1={-top} y2={0} className="ht-eq line" /></> }
  if (kind === 'seat') return <line x1={j.hip[0] - 12} x2={j.hip[0] + 8} y1={-j.hip[1] + 7} y2={-j.hip[1] + 7} className="ht-eq thick" />
  if (kind === 'pad') {
    const [sx, sy] = j.shoulder, [hx, hy] = j.hip
    const nx = hy - sy, ny = sx - hx, nl = Math.hypot(nx, ny) || 1
    const o = 7
    return <line x1={hx - (nx / nl) * o} y1={-hy + (ny / nl) * o * -1} x2={sx - (nx / nl) * o} y2={-sy + (ny / nl) * o * -1} className="ht-eq thick" />
  }
  if (kind === 'rail') return <line x1={box.x0 - 4} x2={box.x1 + 8} y1={-(spec.gy ?? 0) + 3} y2={-(spec.gy ?? 0) + 3} className="ht-eq line" />
  return null
}

// Plays the exercise. `pin` (frame index) freezes it on that key frame; `onFrame` reports the nearest key frame.
export function ExerciseAnim({ H, size = 'lg', pin = null, onFrame, play = true }) {
  const reduce = useReducedMotion()
  const spec = H
  const box = useMemo(() => (isFront(spec) ? (spec.view === 'front2' ? { x0: -46, x1: 46, y0: 0, y1: 114 } : FRONT_BOX) : bounds(spec)), [spec])
  const seq = useMemo(() => legs(spec), [spec])
  const [j, setJ] = useState(() => solve(spec, 0, 0, 0))
  const last = useRef(-1)
  const vis = useRef(true)
  const host = useRef(null)

  useEffect(() => {
    if (!host.current || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => { vis.current = e.isIntersecting })
    io.observe(host.current)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (pin != null) { setJ(solve(spec, pin, pin, 0)); return }
    if (reduce || !play || seq.length === 1 && spec.f.length === 1) { setJ(solve(spec, 0, 0, 0)); return }
    const move = spec.ms || 1100, hold = spec.hold || 280
    const leg = move + hold
    const total = leg * seq.length
    let raf, t0
    const tick = ts => {
      raf = requestAnimationFrame(tick)
      if (!vis.current) { t0 = undefined; return }
      if (t0 === undefined) t0 = ts - (last.current >= 0 ? 0 : 0)
      const t = (ts - t0) % total
      const li = Math.floor(t / leg)
      const lt = t - li * leg
      const [a, b] = seq[li]
      const u = Math.min(1, lt / move)
      setJ(solve(spec, a, b, ease(u)))
      const nf = u < 0.5 ? a : b
      if (nf !== last.current) { last.current = nf; onFrame && onFrame(nf) }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [spec, seq, pin, reduce, play]) // eslint-disable-line react-hooks/exhaustive-deps

  const pad = 7
  const vb = `${box.x0 - pad} ${-box.y1 - pad} ${box.x1 - box.x0 + pad * 2} ${box.y1 - box.y0 + pad * 2}`
  return (
    <div ref={host} className={'ht-anim ' + size}>
      <svg viewBox={vb} role="img" aria-label="Exercise animation" preserveAspectRatio="xMidYMid meet">
        {isFront(spec) ? <FrontFigure j={j} wall={spec.wallF} hl={spec.hlF} /> : <Figure j={j} spec={spec} box={box} />}
      </svg>
    </div>
  )
}

export function HowToThumb({ id, onOpen }) {
  const h = howtoFor(id)
  const [seen, setSeen] = useState(() => (h ? isSeen(h.L.id) : true))
  if (!h) return null
  return (
    <button className="ht-thumb" onClick={() => { haptic(); markSeen(h.L.id); setSeen(true); onOpen(h.L.id) }} aria-label={`How to do ${h.L.n}`}>
      <ExerciseAnim H={h.H} size="sm" />
      {!seen && <i className="ht-new">How</i>}
    </button>
  )
}

export default function HowToSheet({ id, onClose, onOpen }) {
  useBackClose(true, onClose)
  const h = howtoFor(id)
  const [cur, setCur] = useState(0)
  const [pin, setPin] = useState(null)
  const [pinStep, setPinStep] = useState(null)
  useEffect(() => { markSeen(id); setPin(null); setPinStep(null); setCur(0) }, [id])
  if (!h) return null
  const { L, H } = h
  const easy = H.easy && BYID[H.easy], hard = H.hard && BYID[H.hard]
  const stepOn = i => (pinStep != null ? i === pinStep : i === H.steps.findIndex(x => x.f === cur))
  return createPortal(
    <>
      <div className="sheet-back" onClick={() => history.back()} />
      <motion.div className="sheet ht-sheet" role="dialog" aria-label={L.n} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 36 }}>
        <span className="label">{L.cat} · {PATLABEL[L.pat]}{H.hold ? ' · hold' : ''}</span>
        <h2>{L.n}</h2>
        <ExerciseAnim H={H} size="lg" pin={pin} onFrame={setCur} />
        <div className="ht-play">
          <button className={'chip' + (pin == null ? ' on' : '')} onClick={() => { haptic(); setPin(null); setPinStep(null) }}>▶ Play</button>
          <span className="td-small">Tap a step to freeze on it</span>
        </div>

        <ol className="ht-steps">
          {H.steps.map((s, i) => (
            <li key={i} className={stepOn(i) ? 'on' : ''}>
              <button onClick={() => { haptic(); if (pinStep === i) { setPin(null); setPinStep(null) } else { setPin(s.f); setPinStep(i) } }}><b className="num">{i + 1}</b><span>{s.t}</span></button>
            </li>
          ))}
        </ol>

        <div className="ht-feel"><span className="label">You should feel it in</span><p>{H.feel}</p></div>

        <span className="label">Common mistakes</span>
        <ul className="ht-mist">
          {H.err.map(([bad, fix], i) => <li key={i}><b>{bad}</b><span>{fix}</span></li>)}
        </ul>

        <div className="ht-breath"><span className="label">Breathing</span><p>{H.breath}</p></div>

        {(easy || hard) && (
          <div className="ht-prog">
            {easy && <button className="chip" onClick={() => { haptic(); onOpen && onOpen(easy.id) }}>↓ Easier: {easy.n}</button>}
            {hard && <button className="chip" onClick={() => { haptic(); onOpen && onOpen(hard.id) }}>↑ Harder: {hard.n}</button>}
          </div>
        )}
        <button className="btn secondary" onClick={() => history.back()}>Close</button>
      </motion.div>
    </>,
    document.body
  )
}
