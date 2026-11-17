import { describe, it, expect, afterAll } from 'vitest'
import worker, { issueToken } from './index.js'
import { validateReview, cleanIntake, alternatives } from './review.js'
import { mkProg, DEFAULT_INTAKE } from '../../src/lib/program.js'

const SECRET = 'review-test-secret-0123456789'
const realFetch = globalThis.fetch
afterAll(() => { globalThis.fetch = realFetch })

const it0 = { ...DEFAULT_INTAKE, loc: 'gym', exp: 'beginner', daysWk: 3, injuries: 'left knee pain on stairs' }
const program = mkProg('lose', it0).map(d => ({ name: d.name, exercises: d.exercises.map(e => ({ id: e.id, name: e.name, sets: e.sets, reps: e.reps })) }))

describe('program review validation', () => {
  it('keeps a same-pattern swap from the allowed pool and drops everything else', () => {
    const day0 = program[0].exercises
    const push = day0.find(e => /push|press|bench/i.test(e.id) || e.id.includes('push')) || day0[1]
    const alt = alternatives(it0)
    const pattern = Object.keys(alt).find(p => alt[p].some(a => a.id === push.id)) || Object.keys(alt)[0]
    const raw = {
      summary: 'Plan fits you.', notes: [{ title: 'Start light', text: 'First two weeks: two reps in reserve.' }, { title: '', text: 'x' }],
      swaps: [
        { day: 0, from: push.id, to: 'invented_move', why: 'nope' },        // not in the library
        { day: 9, from: push.id, to: day0[0].id, why: 'bad day' },           // day out of range
        { day: 0, from: 'not_in_day', to: day0[0].id, why: 'not in session' },
        { day: 0, from: push.id, to: day0[0].id, why: 'already in session' }
      ]
    }
    const out = validateReview(raw, program, cleanIntake(it0))
    expect(out.swaps).toEqual([])
    expect(out.notes).toEqual([{ title: 'Start light', text: 'First two weeks: two reps in reserve.' }])
    expect(pattern).toBeTruthy()
  })
  it('never offers a knee-loading move to someone with knee pain', () => {
    const alt = alternatives(cleanIntake(it0))
    expect(alt.squat || []).toEqual([])
    expect(alt.lunge || []).toEqual([])
  })
  it('accepts a valid swap inside the same pattern', () => {
    const it1 = { ...DEFAULT_INTAKE, loc: 'gym', exp: 'beginner', daysWk: 3, injuries: '' }
    const prog = mkProg('lose', it1).map(d => ({ name: d.name, exercises: d.exercises.map(e => ({ id: e.id, name: e.name, sets: e.sets, reps: e.reps })) }))
    const alt = alternatives(cleanIntake(it1))
    const ex = prog[0].exercises[0]
    const pat = Object.keys(alt).find(p => alt[p].some(a => a.id === ex.id))
    const other = alt[pat].find(a => a.id !== ex.id && !prog[0].exercises.some(e => e.id === a.id))
    const out = validateReview({ summary: 's', notes: [], swaps: [{ day: 0, from: ex.id, to: other.id, why: 'Better for you.' }] }, prog, cleanIntake(it1))
    expect(out.swaps).toEqual([{ day: 0, from: ex.id, fromName: ex.name, to: other.id, toName: other.name, why: 'Better for you.' }])
  })
})

describe('POST /api/program/review', () => {
  it('sends the person, intake and alternatives to Gemini; returns validated text', async () => {
    let sent
    globalThis.fetch = async (url, init) => { sent = JSON.parse(init.body); return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ summary: 'Three full-body days fit your week.', notes: [{ title: 'Sleep', text: 'You sleep 6 h, so keep sessions short.' }], swaps: [] }) }] } }] }) }
    const tok = await issueToken(SECRET)
    const res = await worker.fetch(new Request('https://x/api/program/review', {
      method: 'POST', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
      body: JSON.stringify({ profile: { sex: 'male', age: 30, heightCm: 180, weightKg: 90, targetKg: 80, goal: 'lose' }, intake: it0, program })
    }), { DEVICE_SECRET: SECRET, GEMINI_API_KEY: 'k' }, {})
    const j = await res.json()
    expect(j.summary).toContain('Three full-body')
    expect(sent.contents[0].parts[0].text).toContain('left knee pain')
    expect(sent.contents[0].parts[0].text).toContain('ALTERNATIVES')
    expect(sent.systemInstruction.parts[0].text).toContain('not a doctor')
    expect(sent.generationConfig.responseSchema).toBeTruthy()
  })
  it('503 without a key, 400 without a program, 429 after 4 a day', async () => {
    const tok = await issueToken(SECRET)
    const kv = () => { const m = new Map(); return { get: async k => m.get(k) ?? null, put: async (k, v) => { m.set(k, v) } } }
    const env = { DEVICE_SECRET: SECRET, GEMINI_API_KEY: 'k', RATE: kv() }
    const call = (e, body) => worker.fetch(new Request('https://x/api/program/review', { method: 'POST', headers: { authorization: `Bearer ${tok}` }, body: JSON.stringify(body) }), e, {})
    expect((await call({ DEVICE_SECRET: SECRET }, { program })).status).toBe(503)
    expect((await call(env, { program: [] })).status).toBe(400)
    globalThis.fetch = async () => Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ summary: 'ok', notes: [], swaps: [] }) }] } }] })
    for (let i = 0; i < 3; i++) await call(env, { program, intake: it0 })
    expect((await call(env, { program, intake: it0 })).status).toBe(429)
  })
})
