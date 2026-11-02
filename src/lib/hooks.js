import { useEffect, useRef, useState } from 'react'
import { reducedMotion } from './motion.js'

// Overlays (camera, settings, sheets) push a history entry, so the browser / Android back button closes them.
// A single stack makes nested overlays close one at a time, top first.
const stack = []
let ignorePops = 0
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (ignorePops > 0) { ignorePops--; return }
    const top = stack.pop()
    if (top) { top.popped = true; top.close() }
  })
}

export function useBackClose(open, close) {
  const closeRef = useRef(close)
  closeRef.current = close
  useEffect(() => {
    if (!open) return
    const entry = { close: () => closeRef.current(), popped: false }
    stack.push(entry)
    history.pushState({ bfOverlay: stack.length }, '')
    return () => {
      if (entry.popped) return
      // Closed without the back button (unmount / state change): drop our entry and its history step.
      const i = stack.indexOf(entry)
      if (i !== -1) stack.splice(i, 1)
      ignorePops++
      history.back()
    }
  }, [open])
}

// Animated number: eases from the previous value to the new one (586 ms, on the beat grid).
export function useCountUp(value, ms = 586) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    if (reducedMotion() || from.current === value) { from.current = value; setShown(value); return }
    const a = from.current, t0 = performance.now()
    let raf
    const step = now => {
      const p = Math.min(1, (now - t0) / ms)
      const e = 1 - Math.pow(1 - p, 4)
      setShown(Math.round(a + (value - a) * e))
      if (p < 1) raf = requestAnimationFrame(step)
      else from.current = value
    }
    raf = requestAnimationFrame(step)
    return () => { cancelAnimationFrame(raf); from.current = value }
  }, [value, ms])
  return shown
}

// Keeps the screen awake while `on` (Screen Wake Lock: Chrome, Safari 18.4+). Re-acquired when the app
// comes back, because the browser drops the lock whenever the page is hidden.
export function useWakeLock(on) {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return
    let lock = null, alive = true
    const get = async () => {
      if (!alive || document.visibilityState !== 'visible') return
      try { lock = await navigator.wakeLock.request('screen') } catch { /* low battery / denied */ }
    }
    get()
    const vis = () => { if (document.visibilityState === 'visible') get() }
    document.addEventListener('visibilitychange', vis)
    return () => { alive = false; document.removeEventListener('visibilitychange', vis); lock?.release?.().catch(() => {}) }
  }, [on])
}

// Live connectivity flag.
export function useOnline() {
  const [online, set] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false))
  useEffect(() => {
    const on = () => set(true), off = () => set(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return online
}
