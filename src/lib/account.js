// Accounts on the client: which sign-ins the server offers, the current account, and the sign-in calls.
// Google and Apple run their own web scripts (loaded on demand); email is a 6-digit code.
import { api, API_URL } from './api.js'
import { isNative } from './platform.js'
import { setSyncEnabled } from './sync.js'

const KEY = 'beetfit_account'
export const cachedAccount = () => { try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null } }
const cache = a => { try { a ? localStorage.setItem(KEY, JSON.stringify(a)) : localStorage.removeItem(KEY) } catch { /* ignore */ } }

let configP = null
export function authConfig() {
  configP ??= fetch(API_URL + '/api/auth/config').then(r => (r.ok ? r.json() : {})).catch(() => ({}))
  return configP.then(c => ({
    email: !!c.email,
    // Google blocks its web sign-in inside app WebViews; native builds need a plugin (store release phase).
    google: !isNative() && c.google ? c.google : null,
    apple: !isNative() && c.apple ? c.apple : null
  }))
}

export async function fetchAccount() {
  const r = await api('/api/auth/me')
  if (r.status === 200) cache(r.account)
  return r.status === 200 ? r.account : cachedAccount()
}

const post = (path, body) => api(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) })

export const emailStart = email => post('/api/auth/email/start', { email })

// All sign-ins end here: account cached, sync on. r.result is 'linked' | 'switched' | 'same';
// `doc` comes back when this phone joined an existing account.
function done(r) {
  if (r.status === 200 && r.account) { cache(r.account); setSyncEnabled(true) }
  return r
}
export const emailVerify = (email, code) => post('/api/auth/email/verify', { email, code }).then(done)
export const googleSignIn = credential => post('/api/auth/google', { credential }).then(done)
export const appleSignIn = idToken => post('/api/auth/apple', { idToken }).then(done)

export async function signOut() {
  const r = await post('/api/auth/signout')
  if (r.status === 200) cache(null)
  return r
}
export async function deleteAccount() {
  const r = await post('/api/auth/delete', { confirm: 'DELETE' })
  if (r.status === 200) cache(null)
  return r
}

// ----- provider scripts -----
const scripts = {}
function load(src) {
  scripts[src] ??= new Promise((res, rej) => {
    const s = Object.assign(document.createElement('script'), { src, async: true, onload: res, onerror: () => { delete scripts[src]; rej(new Error('script')) } })
    document.head.appendChild(s)
  })
  return scripts[src]
}

// Renders Google's own button into `el` (their rules: no custom Google buttons). Calls back with the ID token.
export async function mountGoogle(el, clientId, onCredential, width = 320) {
  await load('https://accounts.google.com/gsi/client')
  const g = window.google?.accounts?.id
  if (!g) throw new Error('google')
  g.initialize({ client_id: clientId, callback: r => onCredential(r.credential), ux_mode: 'popup', auto_select: false, itp_support: true })
  g.renderButton(el, { theme: 'filled_black', size: 'large', shape: 'rectangular', text: 'continue_with', width, logo_alignment: 'center' })
}

export async function appleIdToken(clientId) {
  await load('https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js')
  window.AppleID.auth.init({ clientId, scope: 'email', redirectURI: location.origin + '/', usePopup: true })
  const r = await window.AppleID.auth.signIn()
  return r?.authorization?.id_token
}

export const ACCOUNT_ERR = {
  bad_email: 'That email doesn’t look right.',
  bad_code: 'Wrong code. Check the latest email.',
  code_expired: 'That code has expired. Send a new one.',
  too_many_tries: 'Too many tries. Wait a bit and send a new code.',
  email_failed: 'The email didn’t go out. Try again in a minute.',
  email_not_configured: 'Email sign-in isn’t set up on the server yet.',
  google_not_configured: 'Google sign-in isn’t set up on the server yet.',
  apple_not_configured: 'Apple sign-in isn’t set up on the server yet.',
  bad_token: 'Sign-in didn’t go through. Try again.',
  sync_not_configured: 'Accounts need the database on the server.',
  unauthorized: 'Server key missing (DEVICE_SECRET).',
  offline: 'No connection.'
}
