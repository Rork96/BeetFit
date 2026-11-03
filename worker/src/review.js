// AI review of a generated training program. The rules engine (src/lib/program.js) already respects kit,
// location and injuries; this adds a person-specific read of it and proposes a few swaps.
// The model never invents exercises: swaps must name an id from the pool the same rules allow for this person,
// in the same movement pattern, and not already in that session. Anything else is dropped before it reaches the app.
import { LIB } from '../../src/data/library.js'
import { exPool } from '../../src/lib/program.js'

const clip = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n)
const num = (v, lo, hi) => { const n = +v; return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null }

const INTAKE_KEYS = ['timeframe', 'running', 'work', 'stepsR', 'sleepBase', 'mealsN', 'stress', 'cooks', 'sugary', 'alcohol', 'fastfood', 'overeat', 'exp', 'loc', 'ownEq', 'daysWk', 'injuries', 'prevAttempt', 'motive']

// Only fields the generator knows, with sane sizes: this object goes into a prompt and into exPool().
export function cleanIntake(it = {}) {
  const o = {}
  for (const k of INTAKE_KEYS) {
    const v = it[k]
    if (Array.isArray(v)) o[k] = v.slice(0, 12).map(x => clip(x, 24))
    else if (typeof v === 'boolean') o[k] = v
    else if (typeof v === 'number') o[k] = v
    else if (v != null) o[k] = clip(v, 200)
  }
  return o
}

export function cleanProfile(p = {}) {
  return {
    sex: p.sex === 'female' ? 'female' : 'male', age: num(p.age, 14, 100), heightCm: num(p.heightCm, 120, 230),
    weightKg: num(p.weightKg, 35, 250), targetKg: num(p.targetKg, 35, 250), goal: ['lose', 'gain', 'maintain', 'recomp'].includes(p.goal) ? p.goal : 'lose'
  }
}

export function cleanProgram(prog) {
  if (!Array.isArray(prog)) return []
  return prog.slice(0, 7).map(d => ({
    name: clip(d?.name, 40),
    exercises: (Array.isArray(d?.exercises) ? d.exercises : []).slice(0, 10).map(e => ({ id: clip(e?.id, 40), name: clip(e?.name, 60), sets: num(e?.sets, 1, 10), reps: clip(e?.reps, 40) }))
  })).filter(d => d.exercises.length)
}

// Alternatives per movement pattern, from the same pool the program was built from.
export function alternatives(it) {
  const by = {}
  for (const L of exPool(it)) (by[L.pat] ||= []).push({ id: L.id, name: L.n, level: L.lvl })
  for (const k of Object.keys(by)) by[k] = by[k].slice(0, 8)
  return by
}

export const REVIEW_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    notes: { type: 'ARRAY', items: { type: 'OBJECT', properties: { title: { type: 'STRING' }, text: { type: 'STRING' } }, required: ['title', 'text'] } },
    swaps: { type: 'ARRAY', items: { type: 'OBJECT', properties: { day: { type: 'INTEGER' }, from: { type: 'STRING' }, to: { type: 'STRING' }, why: { type: 'STRING' } }, required: ['day', 'from', 'to', 'why'] } }
  },
  required: ['summary', 'notes', 'swaps']
}

const SYSTEM = `You are a strength and conditioning coach reviewing an auto-generated training program for ONE person. Be specific to them, not generic.
Use what they told us: goal, experience, where they train and what kit they own, days per week, sleep, stress, work, steps, previous attempts, motive, injuries. Quote their own facts back ("you sleep 6 h", "you own dumbbells only").
Output:
- summary: 2-3 plain sentences. What this plan does for this person and the one thing that matters most for them. No hype, no promises.
- notes: 2-3 items, each a short title and 1-2 sentences, practical (progression, recovery, scheduling around their week, what to do first 2 weeks).
- swaps: 0-3 changes, only when a different exercise clearly fits this person better. Each: day (0-based index into the program), from (an exercise id currently in that day), to (an id from ALTERNATIVES, same movement pattern), why (one sentence). Do not swap for the sake of it; an empty list is fine.
Rules: never invent exercise ids; never add exercises outside ALTERNATIVES. You are not a doctor: do not diagnose. If they list an injury or pain, say the plan avoids loading it, and that persistent pain should be checked by a clinician. No medication or supplement advice. No weight-loss or muscle-gain guarantees. Plain English, no markdown, no emoji.`

export function reviewPrompt({ profile, intake, program }) {
  return `PERSON: ${JSON.stringify(profile)}
INTAKE: ${JSON.stringify(intake)}
PROGRAM (day index = array index): ${JSON.stringify(program.map((d, i) => ({ day: i, name: d.name, exercises: d.exercises.map(e => ({ id: e.id, name: e.name, sets: e.sets, reps: e.reps })) })))}
ALTERNATIVES by movement pattern (id, name, level): ${JSON.stringify(alternatives(intake))}`
}

// Keep only what is safe to show: text trimmed, swaps checked against the program and the allowed pool.
export function validateReview(raw, program, intake) {
  const pool = new Map(exPool(intake).map(L => [L.id, L]))
  const all = new Map(LIB.map(L => [L.id, L]))
  const swaps = []
  for (const s of Array.isArray(raw?.swaps) ? raw.swaps : []) {
    const day = program[Math.round(+s?.day)]
    const from = day?.exercises.find(e => e.id === s.from)
    const to = pool.get(s.to)
    const fromL = all.get(s.from)
    if (!day || !from || !to || !fromL) continue
    if (to.pat !== fromL.pat) continue
    if (day.exercises.some(e => e.id === to.id)) continue
    if (swaps.some(x => x.day === Math.round(+s.day) && x.from === s.from)) continue
    swaps.push({ day: Math.round(+s.day), from: s.from, fromName: from.name, to: to.id, toName: to.n, why: clip(s.why, 200) })
    if (swaps.length >= 3) break
  }
  const notes = (Array.isArray(raw?.notes) ? raw.notes : []).map(n => ({ title: clip(n?.title, 50), text: clip(n?.text, 320) })).filter(n => n.title && n.text).slice(0, 3)
  return { summary: clip(raw?.summary, 500), notes, swaps }
}

export async function reviewProgram(body, env, fetchFn = fetch) {
  const profile = cleanProfile(body?.profile), intake = cleanIntake(body?.intake), program = cleanProgram(body?.program)
  if (!program.length) return { error: 'bad_request' }
  const model = env.GEMINI_MODEL || 'gemini-2.5-flash'
  const res = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: reviewPrompt({ profile, intake, program }) }] }],
      generationConfig: {
        responseMimeType: 'application/json', responseSchema: REVIEW_SCHEMA, temperature: 0.5, maxOutputTokens: 1200,
        ...(/2\.5-flash/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {})
      }
    })
  })
  if (res.status === 429) throw new Error('gemini_rate_limited')
  if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 160)}`)
  const data = await res.json()
  let raw
  try { raw = JSON.parse((data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('') || '{}') } catch { raw = {} }
  const out = validateReview(raw, program, intake)
  if (!out.summary) return { error: 'no_review' }
  return { ...out, model }
}
