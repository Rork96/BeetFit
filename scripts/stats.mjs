// Funnel numbers from the live Worker:  npm run stats  (or: npm run stats -- 30  for 30 days)
// The key comes from STATS_KEY in the environment, or from a .stats-key file next to package.json (git ignores it).
import { readFileSync } from 'node:fs'

const days = +process.argv[2] || 14
const base = (process.env.BEETFIT_URL || 'https://beetfit.wealthifai.xyz').replace(/\/$/, '')
let key = process.env.STATS_KEY || ''
if (!key) try { key = readFileSync(new URL('../.stats-key', import.meta.url), 'utf8').trim() } catch { /* none */ }
if (!key) {
  console.error('No key. Put the same value you gave `npx wrangler secret put STATS_KEY` into a .stats-key file, or run STATS_KEY=... npm run stats')
  process.exit(1)
}

const res = await fetch(`${base}/api/stats?days=${days}`, { headers: { 'x-stats-key': key } })
if (res.status === 404) { console.error('404: STATS_KEY is not set on the Worker yet, or the key here does not match it.'); process.exit(1) }
if (!res.ok) { console.error(`HTTP ${res.status}`); process.exit(1) }
const r = await res.json()

const pct = x => (x == null ? '' : `${(x * 100).toFixed(0)}%`.padStart(5))
console.log(`\nBeetFit funnel · last ${r.days} days (since ${r.since}) · distinct devices\n`)
for (const f of r.funnel) console.log(`  ${f.name.padEnd(18)} ${String(f.people).padStart(6)}  ${pct(f.ofPrev)}`)
const days_ = Object.keys(r.byDay).sort().slice(-7)
if (days_.length) {
  const names = [...new Set(days_.flatMap(d => Object.keys(r.byDay[d])))].sort()
  console.log(`\nLast ${days_.length} days\n  ${''.padEnd(18)}${days_.map(d => d.slice(5).padStart(7)).join('')}`)
  for (const n of names) console.log(`  ${n.padEnd(18)}${days_.map(d => String(r.byDay[d][n] || 0).padStart(7)).join('')}`)
}
console.log('')
