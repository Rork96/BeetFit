import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCamera } from './useCamera.js'
import { loadPoseLandmarker, preloadPose } from './pose/landmarker.js'
import { createHoldEngine, createRepEngine, formReport } from './pose/engine.js'
import { EXERCISES, TRACKER_BY_NAME } from './pose/exercises.js'
import { drawSkeleton } from './pose/skeleton.js'
import { haptic, hapticSuccess } from '../lib/platform.js'
import { cancelVoice, speak, unlockVoice } from '../lib/voice.js'
import { T } from '../lib/motion.js'
import './camera.css'

// Full-screen guided set flow:
//   setup (frame check) → 3-2-1 + cue → track (auto count) → done (RPE) → rest → next set / "Up next" → recap
// Manual counting is reachable from every stage and keeps the progress made so far.

const RPE = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export function parseTarget(reps) {
  const str = String(reps ?? '')
  const secs = str.match(/(\d+)\s*s/)
  if (secs) return { kind: 'hold', value: +secs[1] }
  const nums = str.match(/\d+/g)
  return { kind: 'reps', value: nums ? +nums[nums.length - 1] : 10 }
}

export function trackerFor(ex) {
  return ex.trackerId || TRACKER_BY_NAME[ex.name] || null
}

export default function RepTracker({ exercises, startAt = 0, startSet = 0, restSec = 45, onLog, onClose }) {
  const cam = useCamera({ facing: 'user' })
  const canvasRef = useRef(null)
  const landmarkerRef = useRef(null)
  const engineRef = useRef(null)
  const timers = useRef({})
  const frameSince = useRef(null)

  const [ei, setEi] = useState(startAt)
  const [si, setSi] = useState(startSet)
  const [stage, setStage] = useState('setup')
  const [model, setModel] = useState('loading')
  const [framed, setFramed] = useState(false)
  const [inFrame, setInFrame] = useState(false)
  const [manual, setManual] = useState(false)
  const [cd, setCd] = useState(3)
  const [elapsed, setElapsed] = useState(0)
  const [reps, setReps] = useState(0)
  const [heldMs, setHeldMs] = useState(0)
  const [progress, setProgress] = useState(0)
  const [target, setTarget] = useState(10)
  const [rpe, setRpe] = useState(null)
  const [restLeft, setRestLeft] = useState(restSec)
  const [report, setReport] = useState(null)
  const [totals, setTotals] = useState({ reps: 0, sets: 0, secs: 0 })
  const startedAt = useRef(Date.now())

  const ex = exercises[ei]
  const trackerId = ex ? trackerFor(ex) : null
  const cfg = trackerId ? EXERCISES[trackerId] : null
  const goal = useMemo(() => parseTarget(ex?.reps), [ex])
  const isHold = goal.kind === 'hold'
  const camOk = cam.status === 'live'
  const autoMode = !manual && !!cfg && camOk && model === 'ready'
  const cue = ex?.cue || cfg?.cue || ''

  const stageRef = useRef(stage); stageRef.current = stage
  const autoRef = useRef(autoMode); autoRef.current = autoMode
  const targetRef = useRef(target); targetRef.current = target

  const clearTimers = useCallback(() => {
    Object.values(timers.current).forEach(id => { clearInterval(id); clearTimeout(id) })
    timers.current = {}
  }, [])

  // Load the model in parallel with the camera permission prompt.
  useEffect(() => {
    let alive = true
    preloadPose()
    loadPoseLandmarker()
      .then(lm => { if (alive) { landmarkerRef.current = lm; setModel('ready') } })
      .catch(() => { if (alive) setModel('failed') })
    return () => { alive = false; clearTimers(); cancelVoice() }
  }, [clearTimers])

  // Per-set reset.
  useEffect(() => {
    if (!ex) return
    setTarget(goal.value)
    setReps(0); setHeldMs(0); setElapsed(0); setRpe(null); setProgress(0); setReport(null)
    engineRef.current = cfg ? (cfg.mode === 'hold' ? createHoldEngine(cfg) : createRepEngine(cfg)) : null
    if (!cfg) setManual(true)
  }, [ei, si]) // eslint-disable-line react-hooks/exhaustive-deps

  // Detection loop — runs while the camera is live; only counts during `track`.
  useEffect(() => {
    if (!camOk || model !== 'ready' || !cfg) return
    const video = cam.videoRef.current
    let raf, lastVT = -1, stopped = false
    const step = () => {
      if (stopped) return
      raf = requestAnimationFrame(step)
      const st = stageRef.current
      if (!video || video.readyState < 2 || video.currentTime === lastVT) return
      if (!['setup', 'count', 'track'].includes(st)) { drawSkeleton(canvasRef.current, video, null); return }
      lastVT = video.currentTime
      const now = performance.now()
      let res
      try { res = landmarkerRef.current.detectForVideo(video, now) } catch { return }
      const lm = res?.landmarks?.[0] || null
      const eng = engineRef.current
      const out = st === 'track' && eng ? eng.update(lm, now) : null
      const visible = !!lm && (out ? out.inFrame : true)
      setInFrame(visible)
      if (st === 'setup') {
        if (visible) { frameSince.current ??= now; if (now - frameSince.current > 900) setFramed(true) }
        else { frameSince.current = null; setFramed(false) }
      }
      drawSkeleton(canvasRef.current, video, lm, { cfg, side: out?.side ?? (cfg.pick === 'both' ? 'both' : 'L'), progress: out?.progress ?? 0 })
      if (!out || !autoRef.current) return
      setProgress(out.progress)
      if (cfg.mode === 'hold') {
        setHeldMs(out.heldMs)
        if (out.heldMs >= targetRef.current * 1000) live.current.finishSet(Math.round(out.heldMs / 1000))
      } else if (out.rep) {
        live.current.onRep(out.rep.n)
      }
    }
    raf = requestAnimationFrame(step)
    return () => { stopped = true; cancelAnimationFrame(raf) }
  }, [camOk, model, cfg]) // eslint-disable-line react-hooks/exhaustive-deps

  function onRep(n) {
    setReps(n)
    haptic('medium')
    const tgt = targetRef.current
    if (n >= tgt) { finishSet(n); return }
    if (n > tgt - 3) speak(String(n))
    else if (tgt >= 6 && n === Math.ceil(tgt / 2)) speak('Halfway')
  }

  function beginCountdown() {
    unlockVoice() // first utterance must come from a tap on iOS
    clearTimers()
    setStage('count'); setCd(3)
    speak(cue)
    let n = 3
    timers.current.cd = setInterval(() => {
      n -= 1
      if (n <= 0) { clearInterval(timers.current.cd); beginTrack() } else setCd(n)
    }, T.sec)
  }

  function beginTrack() {
    setStage('track')
    engineRef.current?.reset()
    const t0 = Date.now()
    timers.current.el = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 250)
  }

  function finishSet(value) {
    if (stageRef.current !== 'track') return
    stageRef.current = 'done'
    clearTimers()
    hapticSuccess()
    speak('Set done — rest')
    const hist = engineRef.current?.history?.() || []
    const form = !isHold && cfg && hist.length ? formReport(cfg, hist) : null
    setReport(form)
    const logged = isHold ? { secs: value } : { reps: value }
    setStage('done')
    setTotals(t => ({ reps: t.reps + (isHold ? 0 : value), sets: t.sets + 1, secs: t.secs + (isHold ? value : 0) }))
    onLog?.({ ei, si, name: ex.name, ...logged, auto: autoRef.current, form })
    timers.current.done = setTimeout(advance, T.setDoneHold * 2)
  }

  function chooseRpe(v) {
    haptic()
    setRpe(v)
    clearTimeout(timers.current.done)
    onLog?.({ ei, si, name: ex.name, ...(isHold ? { secs: Math.round(heldMs / 1000) } : { reps }), rpe: v, auto: autoMode, form: report })
    timers.current.done = setTimeout(advance, T.setDoneHold)
  }

  function advance() {
    clearTimers()
    if (si + 1 < (ex.sets || 1)) {
      const total = ex.rest || restSec
      setStage('rest'); setRestLeft(total)
      restRef.current = total
      speak('Rest')
      timers.current.rest = setInterval(() => {
        restRef.current -= 1
        const r = restRef.current
        setRestLeft(Math.max(0, r))
        if (r === 3) speak('Get ready')
        if (r <= 0) live.current.endRest()
      }, T.sec)
    } else if (ei + 1 < exercises.length) {
      setStage('next')
      speak('Next: ' + exercises[ei + 1].name)
      timers.current.next = setTimeout(() => { setEi(i => i + 1); setSi(0); setManual(false); setStage('setup'); frameSince.current = null; setFramed(false) }, T.upNext)
    } else {
      setStage('finished')
      speak('Workout complete')
    }
  }

  // After rest the user is already in frame — next set goes straight to 3-2-1.
  function endRest() {
    clearTimers()
    setSi(s => s + 1)
    setStage('count'); setCd(3); speak(cue)
    let n = 3
    timers.current.cd = setInterval(() => { n -= 1; if (n <= 0) { clearInterval(timers.current.cd); beginTrack() } else setCd(n) }, T.sec)
  }

  // Timers and the rAF loop call through this ref so they always see the current set.
  const live = useRef({})
  live.current = { onRep, finishSet, endRest }
  const restRef = useRef(0)

  function goManual() {
    haptic()
    setManual(true)
    if (stage === 'setup') beginCountdown()
  }

  function manualTap() {
    if (stage !== 'track') return
    if (isHold) return
    const n = reps + 1
    onRep(n)
  }

  function stop() {
    clearTimers(); cancelVoice()
    if (stage === 'track' && (reps > 0 || heldMs > 1000)) {
      onLog?.({ ei, si, name: ex.name, ...(isHold ? { secs: Math.round(heldMs / 1000) } : { reps }), auto: autoMode, partial: true })
    }
    onClose?.({ ...totals, mins: Math.round((Date.now() - startedAt.current) / 60000) })
  }

  // Manual hold: a simple stopwatch toward target.
  useEffect(() => {
    if (stage !== 'track' || !isHold || autoMode) return
    const t0 = Date.now() - heldMs
    const id = setInterval(() => {
      const ms = Date.now() - t0
      setHeldMs(ms)
      if (ms >= targetRef.current * 1000) { clearInterval(id); finishSet(targetRef.current) }
    }, 100)
    return () => clearInterval(id)
  }, [stage, isHold, autoMode]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!ex) return null
  const mirrored = cam.facingMode === 'user'
  const setLabel = `Set ${si + 1} of ${ex.sets || 1}`
  const heldS = Math.floor(heldMs / 1000)
  const showVideo = camOk && !manual

  return (
    <div className="ct" data-stage={stage}>
      <video ref={cam.videoRef} className={'ct-video' + (mirrored ? ' mir' : '') + (showVideo ? '' : ' off')} playsInline muted />
      <canvas ref={canvasRef} className={'ct-canvas' + (mirrored ? ' mir' : '') + (showVideo ? '' : ' off')} />
      <div className="ct-vignette" />

      <header className="ct-top">
        <div>
          <div className="ct-title">{ex.name}</div>
          <div className="ct-sub">
            {setLabel}
            {stage === 'track' && <span className="ct-pill num">{fmt(elapsed)}</span>}
            {manual && <span className="ct-tag">manual</span>}
          </div>
        </div>
        <div className="ct-actions">
          {camOk && <button className="ct-icon" onClick={cam.flip} aria-label="Flip camera">⟲</button>}
          <button className="ct-btn ghost" onClick={stop}>Stop</button>
        </div>
      </header>

      {stage === 'track' && autoMode && (
        <div className="ct-range" key={`r${ei}-${si}`}>
          <div className="ct-range-bar"><i style={{ transform: `scaleX(${progress})`, background: progress > 0.9 ? 'var(--ok)' : 'var(--accent)' }} /></div>
          <div className="ct-label">{isHold ? 'position held' : 'range of motion'}</div>
        </div>
      )}
      {stage === 'track' && autoMode && !inFrame && <div className="ct-warn">Step back — I can't see you fully</div>}

      {/* SETUP */}
      {stage === 'setup' && (
        <div className="ct-sheet stk">
          {cam.status === 'denied' || cam.status === 'unavailable' || cam.status === 'error' ? (
            <>
              <div className="ct-h">{cam.status === 'denied' ? 'Camera access is off' : 'Camera unavailable'}</div>
              <p className="ct-p">{cam.status === 'denied'
                ? 'Allow camera access for BeetFit in your browser or phone settings. Video never leaves your device.'
                : cam.error}</p>
              <button className="ct-btn" onClick={() => cam.start()}>Try again</button>
              <button className="ct-link" onClick={goManual}>Count manually instead</button>
            </>
          ) : !cfg ? (
            <>
              <div className="ct-h">Manual counting</div>
              <p className="ct-p">Camera tracking isn't available for {ex.name} yet. Tap once per rep.</p>
              <button className="ct-btn" onClick={beginCountdown}>Start set</button>
            </>
          ) : (
            <>
              <div className="ct-frame">
                <span className={'ct-dot' + (framed ? ' ok' : '')} />
                <span>{cam.status === 'starting' ? 'Starting camera…'
                  : model === 'loading' ? 'Loading pose model…'
                  : model === 'failed' ? 'Pose model failed to load'
                  : framed ? "You're in frame" : inFrame ? 'Hold still…' : 'Step into frame'}</span>
              </div>
              <p className="ct-p">{cfg.setup}</p>
              <button className="ct-btn" disabled={model !== 'ready' || !camOk} onClick={beginCountdown}>
                {framed ? "I'm in frame — start" : 'Start'}
              </button>
              <button className="ct-link" onClick={goManual}>Count manually instead</button>
            </>
          )}
        </div>
      )}

      {/* 3-2-1 */}
      {stage === 'count' && (
        <div className="ct-overlay">
          <div className="ct-label">{ex.name} · {setLabel}</div>
          <div className="ct-cd num" key={cd}>{cd}</div>
          <p className="ct-cue">{cue}</p>
          {!manual && <button className="ct-link" onClick={() => setManual(true)}>Count manually instead</button>}
        </div>
      )}

      {/* TRACK */}
      {stage === 'track' && (
        <>
          {(manual || !autoMode) && !isHold && (
            <button className="ct-tap" onClick={manualTap}>Tap<br />per rep</button>
          )}
          <div className="ct-bottom">
            {isHold ? (
              <HoldRing held={heldS} target={target} active={autoMode ? inFrame : true} />
            ) : (
              <div className="ct-count">
                <span className="ct-glow" />
                <span className="ct-num num" key={reps}>{reps}</span>
                {reps > 0 && <span className="ct-ripple" key={'p' + reps} />}
              </div>
            )}
            <div className="ct-target">
              <button onClick={() => setTarget(t => Math.max(1, t - 1))} aria-label="Lower target">−</button>
              <span>of {target} {isHold ? 'sec' : 'reps'}</span>
              <button onClick={() => setTarget(t => t + 1)} aria-label="Raise target">+</button>
            </div>
            <div className="ct-row">
              {!manual && cfg && <button className="ct-link" onClick={() => setManual(true)}>Count manually</button>}
              <button className="ct-link" onClick={() => finishSet(isHold ? heldS : reps)}>Finish set</button>
            </div>
          </div>
        </>
      )}

      {/* DONE */}
      {stage === 'done' && (
        <div className="ct-overlay solid">
          <div className="ct-check"><svg viewBox="0 0 24 24"><polyline points="5 12.5 10 17 19 7" /></svg></div>
          <div className="ct-big num">{isHold ? `${heldS}s` : reps}</div>
          <div className="ct-p dim">{isHold ? 'held' : 'reps'} · {fmt(elapsed)}{autoMode ? ' · counted by camera' : ''}</div>
          <div className="ct-label">How hard was that? (optional)</div>
          <div className="ct-rpe">
            {RPE.map(v => <button key={v} className={rpe === v ? 'on' : ''} onClick={() => chooseRpe(v)}>{v}</button>)}
          </div>
          <div className="ct-row wide">
            {report && <button className="ct-btn ghost" onClick={() => { clearTimers(); setStage('report') }}>Form report</button>}
            <button className="ct-btn" onClick={advance}>Next</button>
          </div>
          <div className="ct-drain" key={`d${rpe}`} style={{ animationDuration: `${rpe ? T.setDoneHold : T.setDoneHold * 2}ms` }} />
        </div>
      )}

      {/* FORM REPORT */}
      {stage === 'report' && report && (
        <div className="ct-overlay solid scroll">
          <div className="ct-h">Form check · {ex.name}</div>
          <p className="ct-p dim">What the camera measured. It doesn't judge reps as right or wrong.</p>
          <div className="ct-bars stk">
            {report.bars.map(b => (
              <div key={b.label}>
                <div className="ct-bar-l"><span>{b.label}</span><span style={{ color: b.color }}>{b.v}%</span></div>
                <div className="ct-bar"><i style={{ width: b.v + '%', background: b.color }} /></div>
              </div>
            ))}
          </div>
          <ul className="ct-notes stk">{report.notes.map(n => <li key={n}>{n}</li>)}</ul>
          <button className="ct-btn" onClick={advance}>Continue</button>
        </div>
      )}

      {/* REST */}
      {stage === 'rest' && (
        <div className="ct-overlay solid">
          <div className="ct-label">Rest</div>
          <RestRing left={restLeft} total={ex.rest || restSec} />
          <div className="ct-p dim">Next: {setLabel.replace(/Set \d+/, `Set ${si + 2}`)}</div>
          <div className="ct-row wide">
            <button className="ct-btn ghost" onClick={() => { restRef.current += 15; setRestLeft(restRef.current) }}>+15 s</button>
            <button className="ct-btn" onClick={endRest}>Skip rest</button>
          </div>
        </div>
      )}

      {/* UP NEXT */}
      {stage === 'next' && exercises[ei + 1] && (
        <div className="ct-overlay solid">
          <div className="ct-label">Up next</div>
          <div className="ct-next">
            <div className="ct-next-n">{exercises[ei + 1].name}</div>
            <div className="ct-p dim">{exercises[ei + 1].sets} × {exercises[ei + 1].reps}</div>
            {(exercises[ei + 1].cue || EXERCISES[trackerFor(exercises[ei + 1])]?.cue) &&
              <p className="ct-cue">{exercises[ei + 1].cue || EXERCISES[trackerFor(exercises[ei + 1])].cue}</p>}
            <div className="ct-drain static" style={{ animationDuration: `${T.upNext}ms` }} />
          </div>
        </div>
      )}

      {/* RECAP */}
      {stage === 'finished' && (
        <div className="ct-overlay solid">
          <div className="ct-check"><svg viewBox="0 0 24 24"><polyline points="5 12.5 10 17 19 7" /></svg></div>
          <div className="ct-h">Session complete</div>
          <div className="ct-stats stk">
            <div><b className="num">{totals.sets}</b><span>sets</span></div>
            <div><b className="num">{totals.reps}</b><span>reps</span></div>
            <div><b className="num">{Math.max(1, Math.round((Date.now() - startedAt.current) / 60000))}</b><span>min</span></div>
          </div>
          <button className="ct-btn" onClick={stop}>Done</button>
        </div>
      )}
    </div>
  )
}

function HoldRing({ held, target, active }) {
  const r = 70, len = 2 * Math.PI * r
  const p = Math.min(1, held / Math.max(1, target))
  return (
    <div className="ct-hold">
      <svg viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={r} className="trk" />
        <circle cx="80" cy="80" r={r} className="val" style={{ strokeDasharray: len, strokeDashoffset: len * (1 - p) }} />
      </svg>
      <div className="ct-hold-v num">{held}<small>s</small></div>
      <div className={'ct-hold-s' + (active ? ' ok' : '')}>{active ? 'holding' : 'get into position'}</div>
    </div>
  )
}

function RestRing({ left, total }) {
  const r = 70, len = 2 * Math.PI * r
  return (
    <div className="ct-hold">
      <svg viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={r} className="trk" />
        <circle cx="80" cy="80" r={r} className="val" style={{ strokeDasharray: len, strokeDashoffset: len * (1 - left / Math.max(total, left)) }} />
      </svg>
      <div className="ct-hold-v num">{fmt(left)}</div>
    </div>
  )
}
