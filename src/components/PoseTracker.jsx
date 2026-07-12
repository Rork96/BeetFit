import React, { useEffect, useRef, useState } from 'react'
import { TRACKERS } from '../data/workouts.js'

const MP_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14'
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

function angle(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y }
  const v2 = { x: c.x - b.x, y: c.y - b.y }
  const dot = v1.x * v2.x + v1.y * v2.y
  const m1 = Math.hypot(v1.x, v1.y), m2 = Math.hypot(v2.x, v2.y)
  if (!m1 || !m2) return 180
  return (Math.acos(Math.min(1, Math.max(-1, dot / (m1 * m2)))) * 180) / Math.PI
}

const CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]
]

export default function PoseTracker({ trackerId, onClose, onFinish }) {
  const cfg = TRACKERS[trackerId]
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const stateRef = useRef({ phase: 'up', reps: 0 })
  const [reps, setReps] = useState(0)
  const [phase, setPhase] = useState('—')
  const [status, setStatus] = useState('Loading model…')
  const [error, setError] = useState(null)

  useEffect(() => {
    let stream, landmarker, raf, cancelled = false

    async function start() {
      try {
        const vision = await import(/* @vite-ignore */ `${MP_URL}/vision_bundle.mjs`)
        const files = await vision.FilesetResolver.forVisionTasks(`${MP_URL}/wasm`)
        landmarker = await vision.PoseLandmarker.createFromOptions(files, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numPoses: 1
        })
        if (cancelled) return
        setStatus('Requesting camera…')
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
        })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        const video = videoRef.current
        video.srcObject = stream
        await video.play()
        setStatus(null)
        loop()
      } catch (e) {
        if (!cancelled) setError(e.name === 'NotAllowedError'
          ? 'Camera access denied. Allow camera in Telegram settings.'
          : `Failed to start: ${e.message}`)
      }
    }

    function countRep(lm) {
      const pick = idx => lm[idx]
      const primary = cfg.joints.map(pick)
      const alt = cfg.altJoints.map(pick)
      const vis = pts => Math.min(...pts.map(p => p.visibility ?? 1))
      const pts = vis(primary) >= vis(alt) ? primary : alt
      if (vis(pts) < 0.5) return
      const a = angle(pts[0], pts[1], pts[2])
      const st = stateRef.current
      if (st.phase === 'up' && a < cfg.down) {
        st.phase = 'down'
        setPhase('down')
      } else if (st.phase === 'down' && a > cfg.up) {
        st.phase = 'up'
        st.reps += 1
        setReps(st.reps)
        setPhase('up')
        try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('medium') } catch { /* old client */ }
      }
    }

    function draw(lm) {
      const video = videoRef.current, canvas = canvasRef.current
      if (!video || !canvas) return
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (!lm) return
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 3
      for (const [i, j] of CONNECTIONS) {
        ctx.beginPath()
        ctx.moveTo(lm[i].x * canvas.width, lm[i].y * canvas.height)
        ctx.lineTo(lm[j].x * canvas.width, lm[j].y * canvas.height)
        ctx.stroke()
      }
      ctx.fillStyle = '#22c55e'
      for (const p of lm) {
        ctx.beginPath()
        ctx.arc(p.x * canvas.width, p.y * canvas.height, 4, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    let lastTime = -1
    function loop() {
      raf = requestAnimationFrame(loop)
      const video = videoRef.current
      if (!video || video.currentTime === lastTime || video.readyState < 2) return
      lastTime = video.currentTime
      const res = landmarker.detectForVideo(video, performance.now())
      const lm = res.landmarks?.[0]
      draw(lm)
      if (lm) countRep(lm)
    }

    start()
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach(t => t.stop())
      landmarker?.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackerId])

  return (
    <div className="page">
      <div className="row">
        <h1>{cfg.name}</h1>
        <button className="btn small secondary" onClick={onClose}>✕ Close</button>
      </div>
      <p className="hint">{cfg.hint}</p>

      {error && <div className="card"><p style={{ color: 'var(--danger)' }}>{error}</p></div>}
      {status && !error && <div className="card"><p className="hint">{status}</p></div>}

      <div className="tracker-video">
        <video ref={videoRef} playsInline muted />
        <canvas ref={canvasRef} />
        <div className="rep-counter">{reps}</div>
        <div className="phase-badge">{phase}</div>
      </div>

      <button className="btn" onClick={() => onFinish(reps)}>Finish set ({reps} reps)</button>
    </div>
  )
}
