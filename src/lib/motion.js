// Beat grid shared by CSS (tokens.css) and JS timers. 128 BPM → s16 = 117.1875 ms.
export const BPM = 128
export const BEAT = 60000 / BPM
export const S16 = BEAT / 4

// Named timings, all on the grid. Seconds-based countdowns stay at 1000ms on purpose.
export const T = {
  sec: 1000,
  repPop: S16 * 3,       // counter bounce
  setDoneHold: S16 * 24, // checkmark + RPE window before auto-advance (2.8s)
  upNext: S16 * 21,      // "Up next" card (2.46s)
  lookup: S16 * 9,
  toast: S16 * 17
}

const KEY = 'bf_motion'

// 'auto' follows prefers-reduced-motion; 'full' | 'lite' | 'off' override it.
export function getMotionLevel() {
  try { return localStorage.getItem(KEY) || 'auto' } catch { return 'auto' }
}

export function applyMotionLevel(level = getMotionLevel()) {
  const el = document.documentElement
  if (level === 'auto') el.removeAttribute('data-motion')
  else el.setAttribute('data-motion', level)
  try { localStorage.setItem(KEY, level) } catch { /* private mode */ }
}

export function reducedMotion() {
  const lvl = document.documentElement.getAttribute('data-motion')
  if (lvl === 'off') return true
  if (lvl === 'full' || lvl === 'lite') return false
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}
