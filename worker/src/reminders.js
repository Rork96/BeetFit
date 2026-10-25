// Daily reminders: when each one is next due in the user's own time zone, and what it says
// (or whether to stay quiet because the thing is already done today).

export const KINDS = ['meals', 'workout', 'water', 'weigh', 'streak']
export const DEFAULT_PREFS = {
  meals: { on: true, h: 12, m: 30 },
  workout: { on: true, h: 18, m: 0 },
  water: { on: false, h: 15, m: 0 },
  weigh: { on: false, h: 7, m: 30 },
  streak: { on: true, h: 20, m: 30 },
  coach: true
}

// One-off reminders from the user's calendar, timed on their phone. Kept small and near-term.
const EV_KINDS = ['workout', 'weigh', 'note']
const clip = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n)
export function cleanEvents(list, now = Date.now()) {
  if (!Array.isArray(list)) return []
  return list
    .filter(e => e && Number.isFinite(+e.at) && +e.at > now - 3600e3 && +e.at < now + 16 * 864e5 && EV_KINDS.includes(e.kind))
    .map(e => ({ at: Math.round(+e.at), kind: e.kind, title: clip(e.title, 80) || 'BeetFit', body: clip(e.body, 160), url: /^\/\?[a-z]+=[\w-]+$/.test(e.url || '') ? e.url : '/', tag: clip(e.tag, 40).replace(/[^\w-]/g, '') || 'plan' }))
    .sort((a, b) => a.at - b.at).slice(0, 40)
}

export function cleanPrefs(p = {}) {
  const out = { coach: p.coach !== false }
  for (const k of KINDS) {
    const v = p[k] || DEFAULT_PREFS[k]
    const h = Math.min(23, Math.max(0, Math.round(+v.h))), m = Math.min(59, Math.max(0, Math.round(+v.m)))
    out[k] = { on: !!v.on, h: Number.isFinite(h) ? h : DEFAULT_PREFS[k].h, m: Number.isFinite(m) ? m : DEFAULT_PREFS[k].m }
  }
  return out
}

export function validTz(tz) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return typeof tz === 'string' && tz.length < 64 } catch { return false }
}

const fmtCache = new Map()
function parts(ts, tz) {
  let f = fmtCache.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    fmtCache.set(tz, f)
  }
  const o = {}
  for (const p of f.formatToParts(new Date(ts))) if (p.type !== 'literal') o[p.type] = +p.value
  return o // { year, month, day, hour, minute, second }
}

const offsetMs = (ts, tz) => { const p = parts(ts, tz); return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ts / 1000) * 1000 }

// Local wall time in `tz` → UTC ms (DST-safe: re-checks the offset at the result).
export function localToUtc(y, mo, d, h, mi, tz) {
  const guess = Date.UTC(y, mo - 1, d, h, mi)
  let ts = guess - offsetMs(guess, tz)
  const again = guess - offsetMs(ts, tz)
  if (again !== ts) ts = again
  return ts
}

export function localDay(ts, tz) {
  const p = parts(ts, tz)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

// Next reminder strictly after `from` → { at, kind } or null when everything is off.
// Calendar events count too: kind 'event', matched back by time when it fires.
export function nextDue(prefs, tz, from = Date.now(), events = []) {
  let best = null
  for (const e of events) if (e.at > from && (!best || e.at < best.at)) best = { at: e.at, kind: 'event' }
  const p = parts(from, tz)
  for (let add = 0; add < 3; add++) {
    const day = new Date(Date.UTC(p.year, p.month - 1, p.day + add))
    for (const k of KINDS) {
      const r = prefs[k]
      if (!r?.on) continue
      const at = localToUtc(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), r.h, r.m, tz)
      if (at > from && (!best || at < best.at)) best = { at, kind: k }
    }
  }
  return best
}

const setsOn = day => Object.values(day || {}).reduce((n, e) => n + (e === true || typeof e === 'number' ? 1 : (e?.sets?.length || 0)), 0)
const addDays = (key, n) => { const d = new Date(key + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }

// What to send for `kind` today, given the user's synced doc (may be null) — or null to stay quiet.
export function message(kind, doc, today) {
  const name = doc?.settings?.name ? doc.settings.name.split(' ')[0] : ''
  const hi = name ? `${name}, ` : ''
  if (kind === 'meals') {
    if (doc?.foodLog?.[today]?.length) return null
    return { title: 'Log what you ate', body: `${hi}nothing logged yet today. A photo or a barcode takes ten seconds.`, url: '/?tab=meals', tag: 'meals' }
  }
  if (kind === 'workout') {
    if (setsOn(doc?.workoutLog?.[today]) > 0) return null
    const planned = doc?.program?.length || 3
    const done = Array.from({ length: 7 }, (_, i) => addDays(today, -i)).filter(k => setsOn(doc?.workoutLog?.[k]) > 0).length
    if (doc && done >= planned) return null // week's sessions already done: rest is part of the plan
    const left = Math.max(1, planned - done)
    return { title: 'Training today?', body: `${hi}${left} session${left > 1 ? 's' : ''} left this week. Start with the warm-up.`, url: '/?tab=workout', tag: 'workout' }
  }
  if (kind === 'water') {
    const target = doc?.settings?.waterTarget || 8
    const had = doc?.water?.[today] || 0
    if (had >= target) return null
    return { title: 'Water check', body: `${had} of ${target} glasses so far. Have one now.`, url: '/', tag: 'water' }
  }
  if (kind === 'weigh') {
    if ((doc?.weightLog || []).some(w => w.date === today)) return null
    return { title: 'Morning weigh-in', body: 'Same time, before breakfast. The weekly average is what counts.', url: '/?tab=progress', tag: 'weigh' }
  }
  if (kind === 'streak') {
    // Only with a synced doc (we must know what's done), only when there's a streak to keep.
    if (!doc) return null
    const now = tasks(doc, today), before = tasks(doc, addDays(today, -1))
    if (now.n >= 2 || before.n < 2) return null
    const body = now.n === 1 ? `Today isn’t counted yet. ${cap(now.todo.join(' or '))} and it is.`
      : `Today isn’t counted yet. Two of these keep it: ${now.todo.join(', ')}.`
    return { title: 'Keep your streak', body, url: '/', tag: 'streak' }
  }
  return null
}

const cap = s => s.charAt(0).toUpperCase() + s.slice(1)
// The app's daily tasks: food logged, water target, trained. 2 of 3 counts the day.
function tasks(doc, key) {
  const food = (doc.foodLog?.[key]?.length || 0) > 0 || doc.mealPlan?.date === key
  const water = (doc.water?.[key] || 0) >= (doc.settings?.waterTarget || 8)
  const train = setsOn(doc.workoutLog?.[key]) > 0
  const todo = [!food && 'log a meal', !water && 'finish your water', !train && 'do a short session'].filter(Boolean)
  return { n: [food, water, train].filter(Boolean).length, todo }
}

// A calendar reminder, unless the thing is already done that day.
export function eventMessage(ev, doc, today) {
  if (!ev) return null
  if (ev.kind === 'workout' && setsOn(doc?.workoutLog?.[today]) > 0) return null
  if (ev.kind === 'weigh' && (doc?.weightLog || []).some(w => w.date === today)) return null
  return { title: ev.title, body: ev.body, url: ev.url, tag: ev.tag }
}
