// PRO on the client: price list, my status, Stripe checkout / portal (web). Store purchases (RevenueCat)
// arrive with the native release; the server already understands them.
import { useEffect, useState } from 'react'
import { api, API_URL } from './api.js'
import { isNative } from './platform.js'

const KEY = 'beetfit_pro'
export const cachedStatus = () => { try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null } }
const cache = s => { try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY) } catch { /* ignore */ } }

let cfgP = null
export function billingConfig(force = false) {
  if (force) cfgP = null
  cfgP ??= fetch(API_URL + '/api/billing/config').then(r => (r.ok ? r.json() : null)).catch(() => null)
  return cfgP
}

// Daily usage meters ("2 of 3 photo estimates left"). Only valid for the day they were read.
const today = () => new Date().toISOString().slice(0, 10)
let usage = (() => { const u = cachedStatus()?.usage; return u && u.day === today() ? u : null })()
const subs = new Set()
const setUsage = u => { usage = u ? { ...u, day: today() } : null; subs.forEach(f => f()) }
export const usageOf = () => (usage && usage.day === today() ? usage : null)
export function useUsage() {
  const [, tick] = useState(0)
  useEffect(() => { const f = () => tick(n => n + 1); subs.add(f); return () => subs.delete(f) }, [])
  return usageOf()
}
export const usageLeft = (u, key) => (u?.[key] ? Math.max(0, u[key].limit - u[key].used) : null)

export async function fetchStatus() {
  const r = await api('/api/billing/status')
  if (r.status === 200) { const { status, ...s } = r; setUsage(s.usage); cache({ ...s, usage: usageOf() }); return s }
  return cachedStatus()
}

const post = (path, body) => api(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) })

// Leaves the app for Stripe's hosted page; it comes back to /?billing=success|cancel.
export async function startCheckout(plan) {
  const r = await post('/api/billing/checkout', { plan })
  if (r.url) location.assign(r.url)
  return r
}
export async function openPortal() {
  const r = await post('/api/billing/portal')
  if (r.url) location.assign(r.url)
  return r
}

export const canBuyHere = cfg => !isNative() && !!cfg?.web

export function fmtMoney(p, per) {
  if (!p) return ''
  const v = new Intl.NumberFormat('en-US', { style: 'currency', currency: p.currency.toUpperCase(), minimumFractionDigits: p.amount % 100 ? 2 : 0 }).format((per ? p.amount / per : p.amount) / 100)
  return v
}
// Yearly vs 12 monthly payments, rounded down so we never overstate it.
export const yearSaving = pr => (pr?.month && pr?.year ? Math.floor((1 - pr.year.amount / (pr.month.amount * 12)) * 100) : 0)

export const BILLING_ERR = {
  sign_in_first: 'Sign in first, so PRO follows you to a new phone.',
  already_pro: 'You already have PRO.',
  billing_not_configured: 'Payments aren’t switched on yet.',
  no_customer: 'No subscription to manage yet.',
  offline: 'No connection.'
}
