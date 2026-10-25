// Calendar plans: things the user puts on a day (a workout, a weigh-in, a note), once or weekly,
// with an optional reminder. Stored as state.plans (synced as a whole, newest edit wins).
import { dayKey, addDays, weekday, setsLogged } from './day.js'

export const PLAN_KINDS = [
  { id: 'workout', label: 'Workout' },
  { id: 'weigh', label: 'Weigh-in' },
  { id: 'note', label: 'Note' }
]
export const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
export const plansOf = state => state.plans || []
export const planTitle = p => p.title?.trim() || PLAN_KINDS.find(k => k.id === p.kind)?.label || 'Plan'

export function occursOn(p, key) {
  if (key < p.date || (p.until && key > p.until) || (p.skip || []).includes(key)) return false
  return p.repeat === 'weekly' ? weekday(key) === weekday(p.date) : key === p.date
}

const byTime = (a, b) => (a.time || '99').localeCompare(b.time || '99')
export const plansOn = (state, key) => plansOf(state).filter(p => occursOn(p, key)).sort(byTime)

export function planDone(state, p, key) {
  if (p.kind === 'workout') return setsLogged(state, key) > 0
  if (p.kind === 'weigh') return (state.weightLog || []).some(w => w.date === key)
  return (p.done || []).includes(key)
}

// Remove one occurrence of a weekly plan, or the whole plan.
export function dropPlan(plans, p, key, all) {
  if (p.repeat !== 'weekly' || all) return plans.filter(x => x.id !== p.id)
  return plans.map(x => (x.id === p.id ? { ...x, skip: [...(x.skip || []), key] } : x))
}

export function toggleNote(plans, p, key) {
  return plans.map(x => (x.id !== p.id ? x : { ...x, done: (x.done || []).includes(key) ? x.done.filter(d => d !== key) : [...(x.done || []), key] }))
}

const at = (key, time) => { const [y, m, d] = key.split('-').map(Number); const [h, mi] = time.split(':').map(Number); return new Date(y, m - 1, d, h, mi).getTime() }

// Reminders for the next `days` days, as push payloads with a UTC time (computed on this device,
// so the user's own clock and time zone decide). Done items are left out.
export function planEvents(state, now = Date.now(), days = 14) {
  const today = dayKey(new Date(now))
  const out = []
  for (let i = 0; i <= days; i++) {
    const key = addDays(today, i)
    for (const p of plansOn(state, key)) {
      if (!p.remind || !p.time) continue
      const t = at(key, p.time)
      if (t <= now || planDone(state, p, key)) continue
      const title = planTitle(p)
      out.push(
        p.kind === 'workout' ? { at: t, kind: 'workout', title: `${title} at ${p.time}`, body: 'Start with the warm-up. The camera counts your reps.', url: '/?tab=workout', tag: `plan-${p.id}` }
          : p.kind === 'weigh' ? { at: t, kind: 'weigh', title: 'Weigh-in', body: 'Same time, before breakfast. The weekly average is what counts.', url: '/?tab=progress', tag: `plan-${p.id}` }
            : { at: t, kind: 'note', title, body: 'From your BeetFit calendar.', url: `/?cal=${key}`, tag: `plan-${p.id}` }
      )
    }
  }
  return out.sort((a, b) => a.at - b.at).slice(0, 40)
}

// Weekly training days set in one go ("Plan my week"). Replaces the previous set.
export function weekPlanOf(state) {
  const ps = plansOf(state).filter(p => p.auto === 'week')
  return { days: ps.map(p => weekday(p.date)), time: ps[0]?.time || '18:00', remind: ps.length ? ps.every(p => p.remind) : true }
}

export function setWeekPlan(plans, days, time, remind, today = dayKey()) {
  const keep = (plans || []).filter(p => p.auto !== 'week')
  const add = [...new Set(days)].sort().map(d => {
    let k = today
    while (weekday(k) !== d) k = addDays(k, 1)
    return { id: newId() + d, kind: 'workout', title: 'Workout', date: k, time, repeat: 'weekly', remind, auto: 'week' }
  })
  return [...keep, ...add]
}

// ----- .ics export (Apple / Google / Outlook calendars) -----
const esc = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
const dt = (key, time) => key.replace(/-/g, '') + (time ? `T${time.replace(':', '')}00` : '')
const fold = line => { const out = []; let s = line; while (s.length > 74) { out.push(s.slice(0, 74)); s = ' ' + s.slice(74) } out.push(s); return out.join('\r\n') }

export function toICS(plans, stamp = new Date()) {
  const now = stamp.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BeetFit//Calendar//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:BeetFit']
  for (const p of plans) {
    const mins = p.kind === 'workout' ? 60 : 15
    lines.push('BEGIN:VEVENT', `UID:${p.id}@beetfit.wealthifai.xyz`, `DTSTAMP:${now}`, `SUMMARY:${esc(planTitle(p))}`)
    // Floating local time: the phone's calendar puts it at that wall-clock time wherever you are.
    if (p.time) lines.push(`DTSTART:${dt(p.date, p.time)}`, `DURATION:PT${mins}M`)
    else lines.push(`DTSTART;VALUE=DATE:${dt(p.date)}`, `DTEND;VALUE=DATE:${dt(addDays(p.date, 1))}`)
    if (p.repeat === 'weekly') {
      lines.push('RRULE:FREQ=WEEKLY' + (p.until ? `;UNTIL=${dt(p.until)}` : ''))
      for (const s of p.skip || []) lines.push(p.time ? `EXDATE:${dt(s, p.time)}` : `EXDATE;VALUE=DATE:${dt(s)}`)
    }
    lines.push(`DESCRIPTION:${esc(p.kind === 'workout' ? 'Open BeetFit and start with the warm-up.' : 'From BeetFit.')}`, 'URL:https://beetfit.wealthifai.xyz/')
    if (p.remind && p.time) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(planTitle(p))}`, 'TRIGGER:-PT10M', 'END:VALARM')
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

// Hand the .ics to the phone: share sheet where it exists (iOS/Android offer Calendar), else a download.
export async function exportICS(plans, name = 'beetfit') {
  const text = toICS(plans)
  const file = typeof File !== 'undefined' ? new File([text], `${name}.ics`, { type: 'text/calendar' }) : null
  try {
    if (file && navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'BeetFit calendar' }); return 'shared' }
  } catch (e) { if (e?.name === 'AbortError') return 'cancelled' }
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: `${name}.ics` })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return 'downloaded'
}
