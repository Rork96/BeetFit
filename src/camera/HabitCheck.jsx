import React, { useEffect, useRef, useState } from 'react'
import { useCamera } from './useCamera.js'
import { loadObjectDetector, detect } from './pose/objects.js'
import { seen } from '../lib/habits.js'
import { haptic, hapticSuccess } from '../lib/platform.js'
import { useBackClose } from '../lib/hooks.js'
import './camera.css'
import './habit.css'

const NEED = 3 // consecutive frames with the object, so a passing glance doesn't count

// Full-screen: show the camera the object that belongs to the habit and it ticks itself off.
// Reachable without the camera: after a few seconds (or when the camera or model fail) "Mark done" appears.
export default function HabitCheck({ habit, streak, onDone, onClose }) {
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
  const finish = how => {
    if (finished.current) return
    finished.current = true
    hapticSuccess(); setDone(true); onDone(how)
    setTimeout(onClose, 1500)
  }

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
      if (stopped) return
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
      if (seen(dets, habit.labels)) { hits.current += 1; if (hits.current >= NEED) finish('camera') } else hits.current = 0
    }
    raf = requestAnimationFrame(step)
    return () => { stopped = true; cancelAnimationFrame(raf) }
  }, [model, cam.status]) // eslint-disable-line react-hooks/exhaustive-deps

  const noCam = camFailed || model === 'failed'
  return (
    <div className="ct hc" role="dialog" aria-label={habit.n} ref={rootRef}>
      <video ref={cam.videoRef} className="ct-video" playsInline muted />
      <div className="ct-vignette" />
      {box && !done && <i className={'hc-box' + (box.hit ? ' hit' : '')} style={{ left: box.l, top: box.t, width: box.w, height: box.h }} aria-hidden="true" />}
      <header className="ct-top">
        <div className="ct-title">{habit.n}</div>
        <div className="ct-actions"><button className="ct-btn ghost" onClick={onClose}>Close</button></div>
      </header>
      {done ? (
        <div className="hc-ok" role="status"><div className="hc-tick">✓</div><b>Done</b>{streak > 0 && <span>{streak + 1} days in a row</span>}</div>
      ) : (
        <div className="ct-sheet stk hc-sheet">
          <div className="ct-h">Show me {habit.ask}</div>
          <p className="ct-p hc-sub" aria-live="polite">
            {noCam ? (cam.status === 'denied' ? 'Camera access is off for BeetFit.' : 'The camera check isn’t available right now.')
              : model === 'loading' ? 'Getting ready…'
              : best ? `I see: ${best.label} ${Math.round(best.score * 100)}%` : 'Point the camera at it.'}
          </p>
          {(noCam || late) && <button className="ct-btn ghost hc-manual" onClick={() => { haptic(); finish('manual') }}>{noCam ? 'Mark done' : 'Can’t find it? Mark done'}</button>}
          {camFailed && cam.status === 'denied' && <button className="ct-btn" onClick={() => cam.start()}>Try camera again</button>}
        </div>
      )}
    </div>
  )
}
