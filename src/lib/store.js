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
export function saveState(state) {
  clearTimeout(timer)
  // Debounced: camera logging can write several times a second.
  timer = setTimeout(() => {
    const raw = JSON.stringify(state)
    try { localStorage.setItem(KEY, raw) } catch { /* quota / private mode */ }
    if (isNative()) import('@capacitor/preferences').then(({ Preferences }) => Preferences.set({ key: KEY, value: raw })).catch(() => {})
  }, 250)
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

function migrate(s) {
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
