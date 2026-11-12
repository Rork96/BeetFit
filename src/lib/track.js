// Funnel counters (open → welcome → plan_built → paywall_view → trial_start → paid). No content, no identity beyond the random device id,
// once per event per day per device. The server only counts them.
import { api } from './api.js'

const seen = new Set()
export function track(name) {
  if (seen.has(name)) return
  seen.add(name)
  try {
    const k = 'beetfit_evt_' + name, d = new Date().toISOString().slice(0, 10)
    if (localStorage.getItem(k) === d) return
    localStorage.setItem(k, d)
  } catch { /* storage blocked: the server still counts a device once a day */ }
  api('/api/evt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) }).catch(() => {})
}
