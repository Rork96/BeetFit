// "Add to Home Screen": installed web apps keep storage, get push on iOS and open full-screen.
import { isNative } from './platform.js'

let deferred = null
const subs = new Set()
if (typeof window !== 'undefined') {
  // Chrome / Edge / Samsung fire this once, early. Keep it for the install button.
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; subs.forEach(f => f()) })
  window.addEventListener('appinstalled', () => { deferred = null; subs.forEach(f => f()) })
}
export const onInstallChange = f => { subs.add(f); return () => subs.delete(f) }

export function installed() {
  if (isNative()) return true
  try { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true } catch { return false }
}

const ua = () => (typeof navigator === 'undefined' ? '' : navigator.userAgent || '')
export const isIOS = () => /iPhone|iPad|iPod/.test(ua()) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
// In-app browsers (Instagram, Facebook, TikTok, Snapchat, LINE…) can't install. Send people to the real browser.
export const inAppBrowser = () => /Instagram|FBAN|FBAV|FB_IAB|Line\/|musical_ly|Bytedance|Snapchat|Twitter|LinkedInApp|Pinterest/i.test(ua())

// What the card should offer: 'prompt' (one-tap install), 'ios' (Share → Add to Home Screen), 'inapp', or null.
export function installMode() {
  if (installed()) return null
  if (inAppBrowser()) return 'inapp'
  if (deferred) return 'prompt'
  if (isIOS()) return 'ios'
  return null
}

export async function promptInstall() {
  if (!deferred) return 'unavailable'
  deferred.prompt()
  const { outcome } = await deferred.userChoice
  deferred = null
  subs.forEach(f => f())
  return outcome
}

const KEY = 'beetfit_install_snooze'
export const snoozed = () => { try { return +localStorage.getItem(KEY) > Date.now() } catch { return false } }
export const snooze = (days = 14) => { try { localStorage.setItem(KEY, String(Date.now() + days * 864e5)) } catch { /* ignore */ } }
