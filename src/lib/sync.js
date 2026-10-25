// Cross-device sync. The whole app state is one JSON document per user on the Worker (D1).
// Merging is data-aware so two phones logging on the same day don't overwrite each other:
//   • dated logs are unioned day by day (food items by id, workout sets by count, water by max)
//   • singletons (profile, settings, program…) take the side edited most recently (state._t[key])
import { api } from './api.js'

const REV_KEY = 'beetfit_sync_rev'
const SINGLETONS = ['profile', 'settings', 'intake', 'program', 'mealPlan']

export const syncRev = () => { try { return +localStorage.getItem(REV_KEY) || 0 } catch { return 0 } }
const setRev = r => { try { localStorage.setItem(REV_KEY, String(r)) } catch { /* ignore */ } }

const byKey = (arr = [], k) => Object.fromEntries((arr || []).map(x => [x[k], x]))

function mergeDated(a = {}, b = {}, mergeDay) {
  const out = { ...a }
  for (const [d, v] of Object.entries(b || {})) out[d] = d in out ? mergeDay(out[d], v) : v
  return out
}

const mergeFoodDay = (x = [], y = []) => Object.values({ ...byKey(x, 'at'), ...byKey(y, 'at') }).sort((p, q) => p.at - q.at)

function mergeWorkoutDay(x = {}, y = {}) {
  const out = { ...x }
  for (const [name, e] of Object.entries(y)) {
    if (!(name in out)) { out[name] = e; continue }
    if (name.startsWith('__')) { out[name] = out[name] || e; continue }
    const a = out[name], b = e
    const n = v => (v && typeof v === 'object' ? (v.sets || []).filter(Boolean).length + (v.skipped ? 100 : 0) : v ? 1 : 0)
    out[name] = n(b) > n(a) ? b : a
  }
  return out
}

export function mergeStates(local, remote) {
  if (!local) return remote
  remote = remote || {} // still normalize, so the next round compares like with like
  const lt = local._t || {}, rt = remote._t || {}
  const out = { ...remote, ...local }
  for (const k of SINGLETONS) {
    if (!(k in local)) out[k] = remote[k]
    else if (!(k in remote)) out[k] = local[k]
    else out[k] = (rt[k] || 0) > (lt[k] || 0) ? remote[k] : local[k]
  }
  out.foodLog = mergeDated(local.foodLog, remote.foodLog, mergeFoodDay)
  out.workoutLog = mergeDated(local.workoutLog, remote.workoutLog, mergeWorkoutDay)
  out.water = mergeDated(local.water, remote.water, (a, b) => Math.max(a || 0, b || 0))
  out.checkins = mergeDated(local.checkins, remote.checkins, (a, b) => ({ ...a, ...b }))
  const wl = { ...byKey(remote.weightLog, 'date'), ...byKey(local.weightLog, 'date') }
  out.weightLog = Object.values(wl).sort((a, b) => a.date.localeCompare(b.date))
  const ms = byKey(remote.measurements, 'date')
  for (const m of local.measurements || []) ms[m.date] = { ...(ms[m.date] || {}), ...m }
  out.measurements = Object.values(ms).sort((a, b) => a.date.localeCompare(b.date))
  const pf = {}
  for (const f of [...(remote.painFlags || []), ...(local.painFlags || [])]) pf[`${f.date}|${f.exercise}|${f.area}`] = f
  out.painFlags = Object.values(pf)
  const t = { ...rt }
  for (const [k, v] of Object.entries(lt)) t[k] = Math.max(v, t[k] || 0)
  out._t = t
  return out
}

// Key-order independent JSON, so "nothing changed" checks don't trip over object key order.
export function stable(v) {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']'
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}'
  return JSON.stringify(v ?? null)
}
const same = (a, b) => stable(a) === stable(b)

const ON_KEY = 'beetfit_sync_on'
export const syncEnabled = () => { try { return localStorage.getItem(ON_KEY) === '1' } catch { return false } }
export const setSyncEnabled = v => { try { v ? localStorage.setItem(ON_KEY, '1') : localStorage.removeItem(ON_KEY) } catch { /* ignore */ } }

// Pull → merge → push. Returns { state, status } — state is the merged one if anything came from the server.
// `summarize(state)` → small object stored beside the doc for the coach's client list; pushed when it changes.
const SUM_KEY = 'beetfit_sync_summary'
const lastSum = () => { try { return localStorage.getItem(SUM_KEY) || '' } catch { return '' } }

export async function syncNow(local, summarize) {
  let r = await api('/api/sync')
  if (r.status !== 200) return { state: local, status: r.error || `http_${r.status}` }
  for (let attempt = 0; attempt < 2; attempt++) {
    const merged = mergeStates(local, r.data)
    const summary = summarize ? summarize(merged) : null
    const sumJs = summary ? stable(summary) : ''
    if (r.data && same(merged, r.data) && sumJs === lastSum()) { setRev(r.rev); return { state: merged, status: 'ok', devices: r.devices } }
    const put = await api('/api/sync', { method: 'PUT', body: JSON.stringify({ data: merged, baseRev: r.rev, summary }), headers: { 'content-type': 'application/json' } })
    if (put.status === 200) {
      setRev(put.rev)
      try { localStorage.setItem(SUM_KEY, sumJs) } catch { /* ignore */ }
      return { state: merged, status: 'ok', devices: put.devices }
    }
    if (put.status !== 409) return { state: merged, status: put.error || `http_${put.status}` }
    r = put // conflict: server copy came back, merge again
    local = merged
  }
  return { state: local, status: 'conflict' }
}

export const createPairCode = () => api('/api/pair', { method: 'POST' })

export async function claimPairCode(code) {
  const r = await api('/api/pair/claim', { method: 'POST', body: JSON.stringify({ code }), headers: { 'content-type': 'application/json' } })
  if (r.status === 200) { setRev(r.rev); setSyncEnabled(true) }
  return r
}

export async function leaveSync() {
  const r = await api('/api/sync/leave', { method: 'POST' })
  setRev(0); setSyncEnabled(false)
  try { localStorage.removeItem(SUM_KEY) } catch { /* ignore */ }
  return r
}
