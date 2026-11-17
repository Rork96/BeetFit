import React, { useEffect, useRef, useState } from 'react'
import { useCamera } from './useCamera.js'
import { loadObjectDetector, detect } from './pose/objects.js'
import { seen, habitIcon, habitLink } from '../lib/habits.js'
import { haptic, hapticSuccess } from '../lib/platform.js'
import { useBackClose } from '../lib/hooks.js'
import './camera.css'
import './habit.css'

const NEED = 3 // consecutive frames with the object, so a passing glance doesn't count

// Full-screen: show the camera the object that belongs to the habit and it ticks itself off.
// Reachable without the camera: after a few seconds (or when the camera or model fail) "Mark done" appears.
// `water` = { amount(label) → { glasses, ml }, left(ml) → text } for water habits; `onAction` runs the linked next step (log food, start workout).
export default function HabitCheck({ habit, streak: streakIn, onDone, onClose, water, onAction }) {
  const link = habitLink(habit)
  // Frozen at open: after the tick lands the parent recomputes a streak that already includes today.
  const [streak] = useState(streakIn || 0)
  useBackClose(true, onClose)
  const cam = useCamera({ facing: 'environment', width: 1280, height: 720, wide: true })
  const [model, setModel] = useState('loading') // loading | ready | failed
  const [best, setBest] = useState(null)
  const [done, setDone] = useState(false)
  const [late, setLate] = useState(false)
  const [box, setBox] = useState(null)
  const rootRef = useRef(null)
  const detRef = useRef(null)
  const hits = useRef(0)
  const finished = useRef(false)

  const camFailed = ['denied', 'unavailable', 'error'].includes(cam.status)
  const [drink, setDrink] = useState(null) // water habits: seen (or marked by hand), waiting for "Drank it"
  const [added, setAdded] = useState(null)
  const finish = (how, info) => {
    if (finished.current) return
    finished.current = true
    hapticSuccess(); setDone(how); setAdded(info || null); onDone(how, info)
    if (link !== 'food' && link !== 'train') setTimeout(onClose, info ? 2200 : 1500) // linked habits wait for the next-step choice
  }
  // The camera can see a glass, not that it was drunk. So a water habit asks once: drank it?
  const proved = (how, label) => {
    if (link === 'water' && water) { if (!finished.current && !drinkRef.current) { drinkRef.current = true; haptic(); setDrink({ how, ...water.amount(label) }) } }
    else finish(how)
  }
  const drinkRef = useRef(false)

  useEffect(() => { const t = setTimeout(() => setLate(true), 8000); return () => clearTimeout(t) }, [])
  useEffect(() => {
    let alive = true
    loadObjectDetector().then(d => { if (alive) { detRef.current = d; setModel('ready') } }).catch(() => alive && setModel('failed'))
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (model !== 'ready' || cam.status !== 'live') return
    const video = cam.videoRef.current
    let stopped = false, last = 0, lastVT = -1, raf
    const step = () => {
      if (stopped || drinkRef.current) return
      raf = requestAnimationFrame(step)
      const now = performance.now()
      if (!video || video.readyState < 2 || now - last < 180 || video.currentTime === lastVT) return
      last = now; lastVT = video.currentTime
      let dets
      try { dets = detect(detRef.current, video, now) } catch { return }
      const top = dets[0] || null
      setBest(top)
      // Frame the object where the picture actually is (the video is letterboxed, not cropped, so nothing the model sees is off-screen).
      const root = rootRef.current
      if (top?.box && root && video.videoWidth) {
        const cw = root.clientWidth, ch = root.clientHeight, k = Math.min(cw / video.videoWidth, ch / video.videoHeight)
        const ox = (cw - video.videoWidth * k) / 2, oy = (ch - video.videoHeight * k) / 2
        setBox({ l: ox + top.box.x * k, t: oy + top.box.y * k, w: top.box.w * k, h: top.box.h * k, hit: habit.labels.includes(top.label) && top.score >= 0.45 })
      } else setBox(null)
      if (seen(dets, habit.labels)) { hits.current += 1; if (hits.current >= NEED) proved('camera', dets.find(d => habit.labels.includes(d.label))?.label) } else hits.current = 0
    }
    raf = requestAnimationFrame(step)
    return () => { stopped = true; cancelAnimationFrame(raf) }
  }, [model, cam.status]) // eslint-disable-line react-hooks/exhaustive-deps

  const noCam = camFailed || model === 'failed'
  return (
    <div className="ct hc" role="dialog" aria-label={habit.n} ref={rootRef}>
      <video ref={cam.videoRef} className="ct-video" playsInline muted />
      <div className="ct-vignette" />
      {!done && !box && <div className="hc-finder" aria-hidden="true"><i /><i /><i /><i /></div>}
      {box && !done && <i className={'hc-box' + (box.hit ? ' hit' : '')} style={{ left: box.l, top: box.t, width: box.w, height: box.h }} aria-hidden="true" />}
      <header className="ct-top">
        <div className="ct-title">{habit.n}</div>
        <div className="ct-actions"><button className="ct-btn ghost" onClick={onClose}>Close</button></div>
      </header>
      {done ? (
        <div className="hc-ok" role="status">
          <div className="hc-tick">✓</div>
          <b>{done === 'manual' ? 'Ticked' : 'Proved'}</b>
          <span className="hc-ok-n">{habitIcon(habit)} {habit.n}</span>
          {added && <span className="hc-ok-w">💧 +{added.text}{added.left ? ` · ${added.left}` : ''}</span>}
          {streak + 1 > 1 && <span className="hc-ok-s">🔥 {streak + 1}-day streak</span>}
          {(link === 'food' || link === 'train') && (
            <div className="hc-next">
              <button className="ct-btn" onClick={() => { haptic(); onClose(); onAction?.(link) }}>{link === 'food' ? 'Log it now' : 'Start workout'}</button>
              <button className="ct-btn ghost" onClick={onClose}>Later</button>
            </div>
          )}
        </div>
      ) : drink ? (
        <div className="ct-sheet stk hc-sheet">
          <div className="ct-h"><span className="hc-want" aria-hidden="true">💧</span>Got it. Now drink it.</div>
          <p className="ct-p hc-sub">Tap when it’s gone. It goes into today’s water.</p>
          <button className="ct-btn hc-manual" onClick={() => finish(drink.how, { glasses: drink.glasses, text: water.text(drink.glasses), left: water.left(drink.glasses) })}>Drank it · +{water.text(drink.glasses)}</button>
          <button className="ct-btn ghost hc-manual" onClick={onClose}>Not yet</button>
        </div>
      ) : (
        <div className="ct-sheet stk hc-sheet">
          <div className="ct-h"><span className="hc-want" aria-hidden="true">{habitIcon(habit)}</span>Show me {habit.ask}</div>
          <p className="ct-p hc-sub" aria-live="polite">
            {noCam ? (cam.status === 'denied' ? 'Camera access is off for BeetFit.' : 'The camera check isn’t available right now.')
              : model === 'loading' ? 'Getting ready…'
              : best ? `I see: ${best.label} ${Math.round(best.score * 100)}%` : 'Point the camera at it.'}
          </p>
          {(noCam || late) && <button className="ct-btn ghost hc-manual" onClick={() => { haptic(); proved('manual', 'cup') }}>{noCam ? 'Mark done' : 'Can’t find it? Mark done'}</button>}
          {camFailed && cam.status === 'denied' && <button className="ct-btn" onClick={() => cam.start()}>Try camera again</button>}
        </div>
      )}
    </div>
  )
}
