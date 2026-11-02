// Persistence: one JSON blob in localStorage (web + Capacitor WebView).
// Native builds also mirror it to Capacitor Preferences, because iOS may evict WebView storage under pressure.
import { isNative } from './platform.js'

const KEY = 'beetfit_state_v1'
const LEGACY = 'fittrack_state_v1'

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY)
    return raw ? migrate(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

let timer = null
let pending = null
function write(state) {
  const raw = JSON.stringify(state)
  try { localStorage.setItem(KEY, raw) } catch { /* quota / private mode */ }
  if (isNative()) import('@capacitor/preferences').then(({ Preferences }) => Preferences.set({ key: KEY, value: raw })).catch(() => {})
}
export function saveState(state) {
  clearTimeout(timer)
  pending = state
  // Debounced: camera logging can write several times a second.
  timer = setTimeout(flushState, 250)
}
// Write now. Runs when the page hides (screen lock, app switch, tab close) so the last set is never lost.
export function flushState() {
  clearTimeout(timer)
  if (pending) { write(pending); pending = null }
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushState)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushState() })
}

// Ask the browser not to evict our storage (granted more readily to installed apps). Cloud sync stays the backup.
export async function persistStorage() {
  try {
    if (!navigator.storage?.persist) return null
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch { return null }
}

// The workout in progress: which day, when it started. Survives reload, screen lock and app kill.
const LIVE = 'beetfit_live_session'
export function liveSession() {
  try {
    const s = JSON.parse(localStorage.getItem(LIVE))
    // A session left open for more than 6 hours is over.
    return s && Date.now() - s.startedAt < 6 * 3600e3 ? s : null
  } catch { return null }
}
export function setLiveSession(s) {
  try { s ? localStorage.setItem(LIVE, JSON.stringify(s)) : localStorage.removeItem(LIVE) } catch { /* ignore */ }
}

// On native cold start, recover from Preferences if the WebView storage was wiped.
export async function loadNativeBackup() {
  if (!isNative()) return null
  try {
    const { Preferences } = await import('@capacitor/preferences')
    const { value } = await Preferences.get({ key: KEY })
    return value ? migrate(JSON.parse(value)) : null
  } catch {
    return null
  }
}

export function clearState() {
  try { localStorage.removeItem(KEY); localStorage.removeItem(LEGACY) } catch { /* ignore */ }
  if (isNative()) import('@capacitor/preferences').then(({ Preferences }) => Preferences.remove({ key: KEY })).catch(() => {})
}

export function migrate(s) {
  if (!s || typeof s !== 'object') return null
  return {
    foodLog: {}, workoutLog: {}, water: {}, settings: {},
    ...s,
    settings: { units: 'kg', waterTarget: 8, name: '', ...(s.settings || {}) }
  }
}

export function exportState(state) {
  const blob = new Blob([JSON.stringify({ app: 'BeetFit', exported: new Date().toISOString(), state }, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `beetfit-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
