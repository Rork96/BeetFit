// Funnel counters, nothing personal: one row per (day, event, who), so a count is "distinct devices that did it that day".
// `who` is the random device id (or user id for server-side events); it is never returned, only counted.
// Read with GET /api/stats and the STATS_KEY secret in the x-stats-key header. Without the secret the endpoint does not exist.
export const EVENTS = ['open', 'welcome', 'plan_built', 'paywall_view', 'trial_start', 'signin', 'checkout_open', 'paid', 'first_log', 'first_snap']
// Order of the funnel as the owner reads it. `open` is reach, not a step.
export const FUNNEL = ['welcome', 'plan_built', 'paywall_view', 'trial_start', 'checkout_open', 'paid']

export async function ensureStatsSchema(db) {
  await db.prepare('CREATE TABLE IF NOT EXISTS evt (day TEXT NOT NULL, name TEXT NOT NULL, who TEXT NOT NULL, PRIMARY KEY (day, name, who))').run()
}

export async function track(db, name, who, now = Date.now()) {
  if (!EVENTS.includes(name) || !who) return false
  await ensureStatsSchema(db)
  await db.prepare('INSERT OR IGNORE INTO evt (day, name, who) VALUES (?, ?, ?)').bind(new Date(now).toISOString().slice(0, 10), name, who).run()
  return true
}

export async function report(db, days = 14, now = Date.now()) {
  await ensureStatsSchema(db)
  const n = Math.min(90, Math.max(1, Math.round(+days) || 14))
  const since = new Date(now - (n - 1) * 864e5).toISOString().slice(0, 10)
  const { results } = await db.prepare('SELECT day, name, COUNT(*) AS n FROM evt WHERE day >= ? GROUP BY day, name ORDER BY day').bind(since).all()
  const byDay = {}
  for (const r of results) (byDay[r.day] ||= {})[r.name] = r.n
  // Totals count a device once per day it did the thing, so a person who returns on day 2 counts twice in `open` but the funnel
  // below uses distinct people over the whole window.
  const { results: u } = await db.prepare('SELECT name, COUNT(DISTINCT who) AS n FROM evt WHERE day >= ? GROUP BY name').bind(since).all()
  const people = Object.fromEntries(u.map(r => [r.name, r.n]))
  const funnel = FUNNEL.map((name, i) => ({ name, people: people[name] || 0, ofPrev: i && people[FUNNEL[i - 1]] ? +((people[name] || 0) / people[FUNNEL[i - 1]]).toFixed(3) : null }))
  return { days: n, since, people, funnel, byDay }
}
