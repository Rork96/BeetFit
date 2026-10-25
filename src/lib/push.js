// Reminders. Web: Web Push through the Worker (it knows what you already logged, and also delivers
// coach messages). Native shells: on-device scheduled notifications (no server needed).
import { api, API_URL } from './api.js'
import { isNative } from './platform.js'

export const REMINDERS = [
  { id: 'meals', label: 'Log meals', hint: 'Only if nothing is logged yet' },
  { id: 'workout', label: 'Workout', hint: 'Skipped once the week’s sessions are done' },
  { id: 'water', label: 'Water', hint: 'Only if you’re behind' },
  { id: 'weigh', label: 'Weigh-in', hint: 'Skipped if you already weighed in' }
]
export const DEFAULT_REMINDERS = {
  meals: { on: true, h: 12, m: 30 },
  workout: { on: true, h: 18, m: 0 },
  water: { on: false, h: 15, m: 0 },
  weigh: { on: false, h: 7, m: 30 },
  coach: true
}
export const remindersOf = state => ({ ...DEFAULT_REMINDERS, ...(state.settings?.reminders || {}) })

const ON_KEY = 'beetfit_push_on'
export const pushOn = () => { try { return localStorage.getItem(ON_KEY) === '1' } catch { return false } }
const setOn = v => { try { v ? localStorage.setItem(ON_KEY, '1') : localStorage.removeItem(ON_KEY) } catch { /* ignore */ } }

const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

// 'native' | 'web' | 'install' (iOS Safari: works only from the Home Screen app) | 'unsupported'
export function pushSupport() {
  if (isNative()) return 'native'
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return isIOS() && !standalone() ? 'install' : 'unsupported'
  if (!('PushManager' in window)) return isIOS() && !standalone() ? 'install' : 'unsupported'
  return 'web'
}
export const permission = () => (typeof Notification !== 'undefined' ? Notification.permission : 'default')

const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch { return 'UTC' } }
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0))

async function registration() {
  const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((_, rej) => setTimeout(() => rej(new Error('no_sw')), 8000))])
  return reg
}

async function currentSub() {
  if (pushSupport() !== 'web') return null
  try { return await (await registration()).pushManager.getSubscription() } catch { return null }
}

// Turn reminders on for this device. Must be called from a tap (permission prompt).
export async function enablePush(prefs) {
  const kind = pushSupport()
  if (kind === 'native') return enableNative(prefs)
  if (kind !== 'web') return { ok: false, error: kind }
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return { ok: false, error: 'denied' }
  let reg
  try { reg = await registration() } catch { return { ok: false, error: 'no_sw' } }
  const keyRes = await fetch(API_URL + '/api/push/key').then(r => r.json()).catch(() => ({}))
  if (!keyRes.key) return { ok: false, error: keyRes.error || 'offline' }
  let sub
  try {
    sub = await reg.pushManager.getSubscription()
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(keyRes.key) })
  } catch (e) { return { ok: false, error: 'subscribe_failed', detail: String(e?.message || e) } }
  const r = await save(sub, prefs)
  if (r.status !== 200) return { ok: false, error: r.error || 'offline' }
  setOn(true)
  return { ok: true, next: r.next }
}

const save = (sub, prefs) => api('/api/push/subscribe', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ sub: sub.toJSON(), tz: tz(), prefs })
})

// Times changed (here or on another synced phone): reschedule on this device.
export async function updatePush(prefs) {
  if (!pushOn()) return { ok: false }
  if (isNative()) return enableNative(prefs, false)
  const sub = await currentSub()
  if (!sub) { setOn(false); return { ok: false, error: 'gone' } }
  const r = await save(sub, prefs)
  return { ok: r.status === 200, next: r.next }
}

export async function disablePush() {
  setOn(false)
  if (isNative()) {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const { notifications } = await LocalNotifications.getPending()
    if (notifications.length) await LocalNotifications.cancel({ notifications: notifications.map(n => ({ id: n.id })) })
    return { ok: true }
  }
  const sub = await currentSub()
  if (sub) {
    await api('/api/push/unsubscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) })
    await sub.unsubscribe().catch(() => {})
  }
  return { ok: true }
}

export async function testPush() {
  if (isNative()) {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.schedule({ notifications: [{ id: 999, title: 'BeetFit', body: 'Notifications are on.', schedule: { at: new Date(Date.now() + 2000) } }] })
    return { ok: true }
  }
  const sub = await currentSub()
  if (!sub) return { ok: false, error: 'not_subscribed' }
  return api('/api/push/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) })
}

// ----- native: daily repeating local notifications -----
const NATIVE_TEXT = {
  meals: ['Log what you ate', 'A photo or a barcode takes ten seconds.'],
  workout: ['Training today?', 'Start with the warm-up. The camera counts your reps.'],
  water: ['Water check', 'Have a glass now.'],
  weigh: ['Morning weigh-in', 'Same time, before breakfast.']
}
async function enableNative(prefs, ask = true) {
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  if (ask) {
    const p = await LocalNotifications.requestPermissions()
    if (p.display !== 'granted') return { ok: false, error: 'denied' }
  }
  const { notifications } = await LocalNotifications.getPending()
  if (notifications.length) await LocalNotifications.cancel({ notifications: notifications.map(n => ({ id: n.id })) })
  const list = REMINDERS.map((r, i) => ({ r, i })).filter(({ r }) => prefs[r.id]?.on).map(({ r, i }) => ({
    id: 100 + i, title: NATIVE_TEXT[r.id][0], body: NATIVE_TEXT[r.id][1],
    schedule: { on: { hour: prefs[r.id].h, minute: prefs[r.id].m }, repeats: true, allowWhileIdle: true }
  }))
  if (list.length) await LocalNotifications.schedule({ notifications: list })
  setOn(true)
  return { ok: true }
}

export const PUSH_ERR = {
  denied: 'Notifications are blocked. Allow them for BeetFit in your browser or phone settings.',
  install: 'On iPhone, add BeetFit to your Home Screen first (Share → Add to Home Screen), then turn this on from there.',
  unsupported: 'This browser can’t show notifications.',
  no_sw: 'The app is still installing. Reload once and try again.',
  push_not_configured: 'Notifications aren’t set up on the server yet (VAPID_JWK).',
  sync_not_configured: 'Notifications need the database on the server.',
  unauthorized: 'Server key missing (DEVICE_SECRET).',
  subscribe_failed: 'The browser refused to subscribe. Try again, or use another browser.',
  offline: 'No connection.'
}
