// Adaptive targets: what you ate, set against what the scale did, gives what you really burn.
// burn = average intake − (weight change per day × 7,700). The formula in calories.js is only the starting guess.
import { dayKey, addDays, eaten, currentWeight } from './day.js'
import { tdee, burn, bmr, targetCalories, realRate, eta, kcalFloor, KCAL_PER_KG_WEEK } from './calories.js'

export const NEED = { logDays: 8, weighIns: 4, spanDays: 10 } // inside the window
export const WINDOW = 28
export const EVERY = 7 // days between check-ins
// One week of scale readings is noisy (water alone swings a kilo), so a check-in never replaces the estimate:
// it moves it part of the way, further when the reading is tight and the estimate is still loose (a small Kalman filter).
const PRIOR_SD = 250 // how far a formula is off for a real person, kcal a day
const DRIFT_SD = 40 // how much a real burn wanders in a week
const MIN_SD = 100 // a reading is never trusted tighter than this (food logs are rough too)

// Least-squares line through the weigh-ins: slope in kg per day, and how sure it is (standard error).
function fit(points) {
  const n = points.length
  const mx = points.reduce((a, p) => a + p.x, 0) / n, my = points.reduce((a, p) => a + p.y, 0) / n
  const den = points.reduce((a, p) => a + (p.x - mx) ** 2, 0)
  if (!den) return { slope: 0, se: Infinity }
  const slope = points.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) / den
  const rss = points.reduce((a, p) => a + (p.y - my - slope * (p.x - mx)) ** 2, 0)
  // Day-to-day weight scatters by at least ~0.3 kg; a handful of points that happen to line up are not more certain than that.
  const sd = Math.max(0.3, n > 2 ? Math.sqrt(rss / (n - 2)) : 0.5)
  return { slope, se: sd / Math.sqrt(den) }
}

const dayNum = k => Math.round(Date.parse(k + 'T12:00:00Z') / 864e5)

// A day counts as "logged" when it holds a believable day of food: at least 60% of resting burn.
// Half-logged days would make the burn look smaller than it is.
export function fullLogDays(state, today = dayKey(), days = WINDOW) {
  const floor = bmr({ ...state.profile, weightKg: currentWeight(state) }) * 0.6
  const out = []
  for (let i = 1; i <= days; i++) { // today is still being eaten
    const k = addDays(today, -i), e = eaten(state, k)
    if (e.kcal >= floor) out.push({ key: k, kcal: e.kcal })
  }
  return out
}

export function energyCheck(state, today = dayKey()) {
  if (!state?.profile) return null
  const p = { ...state.profile, weightKg: currentWeight(state) }
  const from = addDays(today, -WINDOW)
  const logs = fullLogDays(state, today)
  const weighs = (state.weightLog || []).filter(w => w.date > from && w.date <= today).sort((a, b) => a.date.localeCompare(b.date))
  const span = weighs.length > 1 ? dayNum(weighs[weighs.length - 1].date) - dayNum(weighs[0].date) : 0
  const have = { logDays: logs.length, weighIns: weighs.length, spanDays: span }
  const last = state.settings?.adaptAt || null
  const due = !last || dayNum(today) - dayNum(last) >= EVERY
  const base = { have, need: NEED, formula: tdee(p), current: burn(p), kcalNow: targetCalories(p), last, due, coach: !!state.coach?.override?.kcal }
  const ready = have.logDays >= NEED.logDays && have.weighIns >= NEED.weighIns && have.spanDays >= NEED.spanDays
  if (!ready) return { ...base, ready: false, pct: Math.round((Math.min(1, have.logDays / NEED.logDays) + Math.min(1, have.weighIns / NEED.weighIns) + Math.min(1, have.spanDays / NEED.spanDays)) / 3 * 100) }

  const intake = Math.round(logs.reduce((a, d) => a + d.kcal, 0) / logs.length)
  const line = fit(weighs.map(w => ({ x: dayNum(w.date), y: w.kg })))
  const perDay = line.slope
  const rate = +(perDay * 7).toFixed(2) // kg a week, negative = losing
  const raw = intake - perDay * 7700
  // Water and a rough food log swing the reading. Outside ±30% of the formula it is noise, not metabolism.
  const noisy = raw < base.formula * 0.7 || raw > base.formula * 1.3
  // Blend the reading into the running estimate. Windows overlap from week to week, so a reading counts for half.
  const P = Number.isFinite(p.burnVar) ? p.burnVar : PRIOR_SD ** 2
  const R = Math.max(MIN_SD, line.se * 7700) ** 2 * 2
  const gain = noisy ? 0 : P / (P + R)
  const measured = Math.round((base.current + gain * (raw - base.current)) / 10) * 10
  const nextVar = Math.round((1 - gain) * P + DRIFT_SD ** 2)
  const adj = measured - base.formula
  const next = { ...p, burnAdj: adj, burnVar: nextVar }
  // Two ways to act on it: hold the pace (calories move), or hold the calories (the date moves).
  const keepPace = { kcal: targetCalories(next), rate: realRate(next), eta: eta(next) }
  // Holding the calories only makes sense while they still point the right way (a deficit on a loss goal, a surplus on a gain goal).
  const gap = p.goal === 'lose' ? measured - base.kcalNow : p.goal === 'gain' ? base.kcalNow - measured : 0
  const heldRate = +(Math.max(0, gap) / KCAL_PER_KG_WEEK).toFixed(2)
  const held = { ...next, rateKg: heldRate }
  const keepKcal = { ok: heldRate >= 0.05 && targetCalories(held) === base.kcalNow, kcal: base.kcalNow, rate: +((base.kcalNow - measured) / KCAL_PER_KG_WEEK).toFixed(2), eta: heldRate ? eta(held) : null, rateKg: heldRate }
  return {
    ...base, ready: true, pct: 100, intake, rate, raw: Math.round(raw), measured, adj, noisy, gain: +gain.toFixed(2), nextVar, sd: Math.round(Math.sqrt(nextVar)),
    diff: measured - base.current, planned: realRate(p),
    keepPace, keepKcal, changes: Math.abs(keepPace.kcal - base.kcalNow) >= 100 && !noisy, // smaller than that is inside the noise: the target stays put
    confidence: Math.sqrt(nextVar) <= 110 ? 'high' : Math.sqrt(nextVar) <= 170 ? 'good' : 'early'
  }
}

// State patch for the chosen option ('pace' | 'kcal' | 'skip'). Keeps a short history for the Progress tab and the coach.
export function applyCheck(prev, check, choice, today = dayKey()) {
  const log = [...(prev.adaptLog || []), { date: today, measured: check.measured, formula: check.formula, intake: check.intake, rate: check.rate, from: check.kcalNow, to: choice === 'pace' ? check.keepPace.kcal : check.kcalNow, choice, raw: check.raw }].slice(-26)
  const settings = { ...(prev.settings || {}), adaptAt: today }
  if (choice === 'skip' || choice === 'hold') return { settings, adaptLog: log }
  const profile = { ...prev.profile, burnAdj: check.adj, burnVar: check.nextVar }
  if (choice === 'kcal' && check.keepKcal.ok) profile.rateKg = check.keepKcal.rateKg
  return { settings, adaptLog: log, profile }
}

export { kcalFloor }

// The plan as a line on the weight chart: from the first weigh-in, at the pace the calories deliver, until the target.
// null when there is no pace to draw (maintaining, a coach sets the calories, or nothing weighed yet).
export function planPath(state) {
  const first = (state.weightLog || []).slice().sort((a, b) => a.date.localeCompare(b.date))[0]
  const p = state.profile
  if (!first || !p || p.goal === 'maintain' || state.coach?.override?.kcal) return null
  const perDay = realRate({ ...p, weightKg: first.kg }) / 7
  if (Math.abs(perDay) < 0.004 || Math.sign(p.targetKg - first.kg) !== Math.sign(perDay)) return null
  const lose = perDay < 0
  const at = key => {
    const d = dayNum(key) - dayNum(first.date)
    if (d < 0) return null
    const v = first.kg + perDay * d
    return lose ? Math.max(p.targetKg, v) : Math.min(p.targetKg, v)
  }
  return { start: first.date, startKg: first.kg, perDay, at }
}

// Where the 7-day average sits against that line today: { delta kg, state: 'ahead' | 'on' | 'behind' } after the first week.
export function planStanding(state, avgKg, today = dayKey()) {
  const path = planPath(state)
  if (!path || avgKg == null || dayNum(today) - dayNum(path.start) < 7) return null
  const delta = +(avgKg - path.at(today)).toFixed(1)
  const good = path.perDay < 0 ? -delta : delta // positive = further along than planned
  return { delta: Math.abs(delta), state: good >= 0.3 ? 'ahead' : good <= -0.3 ? 'behind' : 'on' }
}
