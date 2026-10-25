// Coach mode: API calls plus the numbers a coach reads about a client.
// Everything here works on a plain state object, so the coach's phone runs the same maths on a
// client's synced document that the client's phone runs on its own state.
import { api } from './api.js'
import { setSyncEnabled } from './sync.js'
import { dayKey, addDays, targets, eaten, setsLogged, dayScore, program, weeklyRate, weightSeries, currentWeight } from './day.js'

const post = (path, body) => api(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) })

// ----- client side -----
export const coachPeek = code => post('/api/coach/peek', { code })
export async function coachJoin(code) {
  const r = await post('/api/coach/join', { code })
  if (r.status === 200) setSyncEnabled(true) // the coach reads the synced copy
  return r
}
export const coachLink = () => api('/api/coach/link')
export const coachLeave = () => post('/api/coach/leave')
export const coachSend = text => post('/api/coach/msg', { text })
export const coachSeen = () => post('/api/coach/seen')

// ----- coach side -----
export const coachSetup = name => post('/api/coach/setup', { name })
export const coachNewCode = () => post('/api/coach/code')
export const coachClients = () => api('/api/coach/clients')
export const coachClient = id => api(`/api/coach/client/${id}`)
export const coachReply = (id, text) => post(`/api/coach/client/${id}/msg`, { text })
export const coachClientSeen = id => post(`/api/coach/client/${id}/seen`)
export const coachRemove = id => post(`/api/coach/client/${id}/remove`)
export const coachOverride = (id, o) => api(`/api/coach/client/${id}/override`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(o || {}) })

export const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/
export const cleanCode = v => v.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/[01OIL]/g, '').slice(0, 6)

// ----- numbers -----
const avg = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const r1 = v => (v == null ? null : Math.round(v * 10) / 10)

// One week ending on `end` (inclusive).
function weekStats(state, end) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(end, -i))
  const planned = program(state).days.length
  const sessions = days.filter(k => setsLogged(state, k) > 0).length
  const logged = days.filter(k => (state.foodLog?.[k]?.length || 0) > 0)
  const kcal = avg(logged.map(k => eaten(state, k).kcal))
  const prot = avg(logged.map(k => eaten(state, k).p))
  const adh = Math.round((100 * days.reduce((n, k) => n + dayScore(state, k), 0)) / (days.length * 3))
  const w = weightSeries(state, 1, end)[0]?.avg
  const sleep = avg(days.map(k => state.checkins?.[k]?.sleep).filter(v => v != null))
  return { end, sessions, planned, logDays: logged.length, kcal: kcal && Math.round(kcal), protein: prot && Math.round(prot), adh, weight: r1(w), sleep: r1(sleep) }
}

function lastActive(state) {
  const keys = [
    ...Object.keys(state.foodLog || {}).filter(k => state.foodLog[k]?.length),
    ...Object.keys(state.workoutLog || {}).filter(k => setsLogged(state, k) > 0),
    ...Object.keys(state.water || {}).filter(k => state.water[k] > 0),
    ...Object.keys(state.checkins || {}),
    ...(state.weightLog || []).map(w => w.date)
  ]
  return keys.sort().pop() || null
}

const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5)

// Light summary the client sends with every sync; it's what the coach's client list shows.
export function summarize(state, today = dayKey()) {
  if (!state?.profile) return null
  const w = weekStats(state, today)
  const pain = (state.painFlags || []).filter(f => f.date >= addDays(today, -13)).length
  const last = lastActive(state)
  return {
    name: state.settings?.name || '', goal: state.profile.goal,
    adh: w.adh, sessions: w.sessions, planned: w.planned, logDays: w.logDays,
    weight: r1(currentWeight(state)), rate: r1(weeklyRate(state, 14, today)), pain, last, day: today
  }
}

// Full overview for one client: headline numbers, flags, latest check-in, four weeks.
export function overview(state, today = dayKey()) {
  const t = targets(state)
  const weeks = [0, 1, 2, 3].map(i => weekStats(state, addDays(today, -7 * i)))
  const w = weeks[0]
  const rate = weeklyRate(state, 14, today)
  const goal = state.profile.goal
  const alerts = []
  for (const f of (state.painFlags || []).filter(f => f.date >= addDays(today, -13)).slice(-4)) {
    alerts.push({ kind: 'bad', t: `Pain: ${f.area}`, sub: `${f.exercise} · ${f.date}${f.note ? ` · “${f.note}”` : ''}` })
  }
  const last = lastActive(state)
  const quiet = last ? daysBetween(last, today) : null
  if (quiet == null) alerts.push({ kind: 'warn', t: 'No logs yet', sub: 'Nothing logged since they joined.' })
  else if (quiet >= 3) alerts.push({ kind: 'warn', t: `Quiet for ${quiet} days`, sub: `Last activity ${last}.` })
  if (w.planned && w.sessions < w.planned - 1) alerts.push({ kind: 'warn', t: `${w.planned - w.sessions} sessions missed`, sub: `${w.sessions} of ${w.planned} planned in the last 7 days.` })
  if (rate != null && goal === 'lose' && rate > 0.15) alerts.push({ kind: 'warn', t: 'Weight trending up', sub: `+${r1(rate)} kg a week on a fat-loss goal.` })
  if (rate != null && goal === 'lose' && rate < -1.2) alerts.push({ kind: 'warn', t: 'Losing fast', sub: `${r1(rate)} kg a week. Check energy and protein.` })
  if (rate != null && goal === 'gain' && rate < -0.1) alerts.push({ kind: 'warn', t: 'Weight trending down', sub: `${r1(rate)} kg a week on a muscle-gain goal.` })
  if (w.kcal && Math.abs(w.kcal - t.kcal) > t.kcal * 0.2 && w.logDays >= 3) alerts.push({ kind: 'warn', t: `Eating ${w.kcal > t.kcal ? 'over' : 'under'} target`, sub: `${w.kcal} kcal average vs ${t.kcal} target.` })
  if (w.sleep != null && w.sleep < 6) alerts.push({ kind: 'warn', t: 'Short sleep', sub: `${w.sleep} h average this week.` })
  const ciKey = Object.keys(state.checkins || {}).sort().pop()
  return {
    name: state.settings?.name || 'Client', goal, targets: t,
    weight: r1(currentWeight(state)), rate: r1(rate), start: state.profile.weightKg, targetKg: state.profile.targetKg,
    week: w, weeks, alerts, last,
    checkin: ciKey ? { date: ciKey, ...state.checkins[ciKey] } : null,
    plan: program(state)
  }
}
