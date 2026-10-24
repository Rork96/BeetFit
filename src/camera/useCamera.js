import { useCallback, useEffect, useRef, useState } from 'react'

// Camera lifecycle shared by the rep tracker, barcode scanner and meal snap.
// status: 'idle' | 'starting' | 'live' | 'denied' | 'unavailable' | 'error'
export function useCamera({ facing = 'user', width = 640, height = 480, autoStart = true } = {}) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [facingMode, setFacingMode] = useState(facing)
  const [torch, setTorchState] = useState({ supported: false, on: false })

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const start = useCallback(async (mode = facingMode) => {
    stop()
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unavailable')
      setError('This browser has no camera API. Open the app over HTTPS (or install it from the store).')
      return
    }
    setStatus('starting'); setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: width }, height: { ideal: height } },
        audio: false
      })
      streamRef.current = stream
      const v = videoRef.current
      if (v) {
        v.srcObject = stream
        v.muted = true
        v.playsInline = true
        await v.play().catch(() => {})
      }
      const track = stream.getVideoTracks()[0]
      const caps = track?.getCapabilities?.() || {}
      setTorchState({ supported: !!caps.torch, on: false })
      setStatus('live')
    } catch (e) {
      if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') setStatus('denied')
      else if (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError') setStatus('unavailable')
      else setStatus('error')
      setError(e?.message || String(e))
    }
  }, [facingMode, width, height, stop])

  const flip = useCallback(() => {
    const next = facingMode === 'user' ? 'environment' : 'user'
    setFacingMode(next)
    start(next)
  }, [facingMode, start])

  const setTorch = useCallback(async on => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    try {
      await track.applyConstraints({ advanced: [{ torch: on }] })
      setTorchState(s => ({ ...s, on }))
    } catch { /* torch not supported on this device */ }
  }, [])

  // Grab the current frame as a JPEG Blob (meal snap).
  const capture = useCallback(async (maxSide = 1024, quality = 0.82) => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return null
    const k = Math.min(1, maxSide / Math.max(v.videoWidth, v.videoHeight))
    const c = document.createElement('canvas')
    c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k)
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height)
    return new Promise(res => c.toBlob(res, 'image/jpeg', quality))
  }, [])

  useEffect(() => {
    if (autoStart) start(facing)
    // Stop the camera when the Mini App goes to background — iOS kills the stream anyway.
    const onVis = () => { if (document.hidden) stop() }
    document.addEventListener('visibilitychange', onVis)
    return () => { document.removeEventListener('visibilitychange', onVis); stop() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { videoRef, status, error, facingMode, start, stop, flip, torch, setTorch, capture }
}
