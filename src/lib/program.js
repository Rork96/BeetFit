// Rule-based program generator + plan explanations (ported from the prototype's mkProg / paceInfo / planWhy).
// Pure functions: intake in, program out. Unit-tested in program.test.js.
import { LIB, EQLABEL, PATLABEL, CUEX, PROGX } from '../data/library.js'
import { TRACKER_BY_NAME } from '../camera/pose/exercises.js'

export const DEFAULT_INTAKE = {
  timeframe: 3, running: false,
  work: 'sedentary', stepsR: '5–7k',
  sleepBase: 7.5, mealsN: 3, stress: 'medium', cooks: 'mix', sugary: 'sometimes', alcohol: 'sometimes', fastfood: 'weekly', overeat: 'none',
  exp: 'beginner', loc: 'home, no equipment', ownEq: [], daysWk: 3, injuries: '',
  prevAttempt: '', motive: ''
}

export const PREVPAT = {
  'never really started': 'Week 1 is two habits, nothing to fail at — numbers come once those stick.',
  'started strong, faded by week 3': 'Week-3 fade is your pattern — volume ramps slowly and week 5 is a planned deload.',
  'lost it, gained it back': 'Regain is your pattern — the deficit is capped so muscle is protected on the way down.',
  'consistent but no results': 'You were consistent without results — week 1 fixes logging accuracy before adding work.',
  'tried fasting, lost motivation': "Fasting windows didn't hold — BeetFit uses meal-timing rules instead of a fasting clock."
}

export const MOTIVEPAT = {
  'health markers': 'Health is your driver — BeetFit leads with the weight trend and steps, not appearance.',
  'look better': 'Appearance is your driver — progress photos are prompted weekly alongside the weight trend.',
  'keep up with my kids': 'Everyday capacity is your driver — conditioning and carries stay in every week.',
  'a date in the calendar': 'You have a date — the pace check on your timeframe is strict about what is realistic.',
  'sport performance': 'Performance is your driver — main lifts keep priority and accessories give way first.'
}

const LVL = { beginner: 0, intermediate: 1, advanced: 2 }

export function ownedEq(it) {
  if (it.loc === 'gym') return ['none', 'dumbbell', 'barbell', 'kettlebell', 'bands', 'pullup_bar', 'bench', 'machine', 'furniture']
  if (it.loc === 'home, no equipment') return ['none', 'furniture']
  return ['none', 'furniture', ...(it.ownEq || [])]
}

const INJURY_RULES = [
  [/knee/, ['squat', 'lunge'], 'knee'],
  [/shoulder/, ['push'], 'shoulder'],
  [/back|spine|disc/, ['hinge', 'carry'], 'back'],
  [/elbow|wrist/, ['pull'], 'elbow/wrist'],
  [/ankle|foot/, ['cardio'], 'ankle']
]

export function injuryBlock(L, it) {
  const t = (it.injuries || '').toLowerCase()
  if (!t.trim()) return null
  for (const [re, pats, area] of INJURY_RULES) if (re.test(t) && pats.includes(L.pat)) return area
  return null
}

export function availOf(L, it) {
  const where = it.loc === 'gym' ? 'gym' : 'home'
  if (!L.loc.includes(where) && !(where === 'home' && L.loc.includes('outdoor'))) return { ok: false, why: 'not available where you train' }
  const owned = ownedEq(it)
  if (!L.eq.some(e => owned.includes(e))) return { ok: false, why: `needs ${L.eq.map(e => EQLABEL[e] || e).join(' or ')}` }
  const inj = injuryBlock(L, it)
  if (inj) return { ok: false, why: `loads the ${inj}` }
  if (L.lvl === 'advanced' && it.exp !== 'regular') return { ok: false, why: 'advanced — later' }
  return { ok: true }
}

export const exPool = it => LIB.filter(L => availOf(L, it).ok)

function repsOf(L, it) {
  if (it.exp === 'regular') return String(L.dr)
  return L.dr >= 20 ? String(L.dr) : `${Math.max(1, Math.round(L.dr * 0.7))}-${L.dr}`
}

function mkEx(L, it) {
  const ex = {
    id: L.id, name: L.n, sets: 3, rest: L.pat === 'cardio' ? 45 : 75,
    cue: CUEX[L.n] || '', progression: PROGX[L.n] || '', weight: L.dw, pattern: L.pat
  }
  const tracker = TRACKER_BY_NAME[L.n]
  if (tracker) ex.trackerId = tracker
  if (L.type === 'hold') return { ...ex, reps: `${Math.max(20, L.dr)}s` }
  let reps = repsOf(L, it)
  if (/lunge|split squat/i.test(L.n)) reps += ' per leg'
  return { ...ex, reps }
}

// One exercise per movement pattern, the best fit for the user's level, never repeated inside a session.
export function mkProg(goal, it = DEFAULT_INTAKE) {
  const pool = exPool(it)
  const want = it.exp === 'regular' ? 1 : 0
  const byPat = (pat, used) => pool
    .filter(L => L.pat === pat && !used.includes(L))
    // Stable sort: ties keep library order, which lists the main compound lift of each pattern first.
    .sort((a, b) => Math.abs(LVL[a.lvl] - want) - Math.abs(LVL[b.lvl] - want))[0] || null
  const pick = pats => { const used = []; pats.forEach(p => { const L = byPat(p, used); if (L) used.push(L) }); return used }
  const days = goal === 'gain' ? Math.max(3, Math.min(4, it.daysWk)) : Math.max(2, Math.min(5, it.daysWk))

  let defs
  if (days <= 2) defs = [['Full Body A', ['squat', 'hinge', 'push', 'pull', 'core', 'carry']], ['Full Body B', ['lunge', 'hinge', 'push', 'pull', 'core', 'cardio']]]
  else if (days === 3) defs = [['Full Body A', ['squat', 'push', 'pull', 'hinge', 'core']], ['Full Body B', ['hinge', 'lunge', 'pull', 'push', 'cardio']], ['Full Body C', ['squat', 'push', 'pull', 'core', 'carry']]]
  else defs = [['Lower A', ['squat', 'hinge', 'lunge', 'core', 'carry']], ['Upper A', ['push', 'pull', 'push', 'pull', 'core']], ['Lower B', ['hinge', 'lunge', 'squat', 'cardio', 'core']], ['Upper B', ['pull', 'push', 'pull', 'push', 'core']], ['Full Body', ['squat', 'push', 'hinge', 'pull', 'core']]].slice(0, days)

  const program = defs.map(([name, pats]) => ({ name, exercises: pick(pats).map(L => mkEx(L, it)) })).filter(d => d.exercises.length)
  if (it.running && goal !== 'gain') {
    program.push({ name: 'Run / Walk', run: true, exercises: [{ id: 'run_walk', name: 'Run/walk intervals', sets: 1, reps: '6× (1 min run / 2 min walk)', rest: 0, cue: 'Conversational pace on the runs.' }] })
  }
  return program
}

// Is the timeframe realistic? Cap: 1.0 % bodyweight/week loss, 0.5 % gain.
export function paceInfo(profile, it) {
  const diff = profile.targetKg - profile.weightKg
  const gain = diff > 0
  const weeks = Math.max(1, it.timeframe * 4.33)
  const rate = Math.abs(diff) / weeks
  const pct = (rate / profile.weightKg) * 100
  const cap = gain ? 0.5 : 1.0
  const by = new Date(); by.setMonth(by.getMonth() + it.timeframe)
  const byStr = by.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (Math.abs(diff) < 0.5) return { tone: 'ok', rate: 0, line: 'Maintaining — no pace pressure', hint: '' }
  const line = `${(+profile.targetKg).toFixed(1)} kg by ~${byStr} · ${gain ? '+' : '−'}${rate.toFixed(2)} kg/week`
  if (pct > cap) {
    const sugg = Math.min(18, Math.ceil(Math.abs(diff) / ((profile.weightKg * cap) / 100) / 4.33))
    return { tone: 'warn', rate, line, hint: `Too aggressive — risks muscle loss. Use ${sugg} months.`, sugg }
  }
  return { tone: 'ok', rate, line, hint: pct < 0.25 ? 'Gentle pace — sustainable.' : 'Realistic pace.' }
}

// Activity level for the calorie formula, derived from what the person actually does.
export function activityFrom(it) {
  if (it.work === 'physical labor') return it.daysWk >= 4 ? 'athlete' : 'active'
  const steps = { '<5k': 0, '5–7k': 1, '7–10k': 2, '10k+': 3 }[it.stepsR] ?? 1
  const score = steps + (it.work === 'on my feet' ? 1 : 0) + (it.daysWk >= 4 ? 1 : 0)
  return ['sedentary', 'light', 'moderate', 'moderate', 'active', 'active'][score] || 'light'
}

export function stepsTarget(it) {
  if (it.stepsR === '<5k') return 7000
  if (it.stepsR === '10k+') return 12000
  return it.work === 'sedentary' ? 8000 : 10000
}

// "Why this plan" — every line comes from an answer the person gave.
export function planWhy(it, program) {
  const out = []
  const kit = (it.ownEq || []).map(e => (EQLABEL[e] || e).toLowerCase())
  if (it.loc === 'gym') out.push('You train at a gym — the plan uses barbells, machines and dumbbells.')
  else if (it.loc === 'home, no equipment' || !kit.length) out.push('You train at home with no equipment — every exercise is bodyweight or uses a sturdy table or chair.')
  else out.push(`You train at home with ${kit.length > 1 ? kit.slice(0, -1).join(', ') + ' and ' + kit[kit.length - 1] : kit[0]} — bodyweight work plus what you own.`)
  const blocked = [...new Set(LIB.map(L => injuryBlock(L, it)).filter(Boolean))]
  if (blocked.length) out.push(`You flagged your ${blocked.join(' and ')} — movements that load it are left out.`)
  if (PREVPAT[it.prevAttempt]) out.push(PREVPAT[it.prevAttempt])
  if (MOTIVEPAT[it.motive]) out.push(MOTIVEPAT[it.motive])
  if (it.sugary === 'daily') out.push('Your biggest lever: cutting daily sugary drinks (~300 kcal a day).')
  else if (it.overeat === 'evening–night') out.push('Evening eating is your pattern — the kitchen closes 3 hours before bed.')
  else if (it.fastfood === 'often' || it.cooks === 'mostly eat out') out.push('You eat out a lot — order protein first and skip the sugary drink.')
  const cam = program.flatMap(d => d.exercises).filter(e => e.trackerId).length
  if (cam) out.push(`${cam} exercises in your week are counted by the camera — no tapping between reps.`)
  out.push(`Daily steps target starts at ${stepsTarget(it) / 1000}k, set from your current ${it.stepsR}.`)
  return out
}
