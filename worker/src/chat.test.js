import { describe, it, expect, afterAll } from 'vitest'
import worker, { issueToken } from './index.js'

const SECRET = 'chat-test-secret-0123456789'
const realFetch = globalThis.fetch
afterAll(() => { globalThis.fetch = realFetch })

describe('Beet chat', () => {
  it('sends system prompt + context + history to Gemini and returns text', async () => {
    let sent
    globalThis.fetch = async (url, init) => { sent = { url, body: JSON.parse(init.body) }; return Response.json({ candidates: [{ content: { parts: [{ text: 'Eat 200 g Greek yogurt.' }] } }] }) }
    const tok = await issueToken(SECRET)
    const res = await worker.fetch(new Request('https://x/api/chat', {
      method: 'POST', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'model', text: 'hi' }, { role: 'user', text: 'Protein snack?' }], context: 'Daily targets: 2100 kcal, protein 160 g.', today: '2026-10-24' })
    }), { DEVICE_SECRET: SECRET, GEMINI_API_KEY: 'k' }, {})
    expect(await res.json()).toMatchObject({ text: 'Eat 200 g Greek yogurt.' })
    expect(sent.url).toContain(':generateContent')
    expect(sent.body.contents).toEqual([{ role: 'user', parts: [{ text: 'Protein snack?' }] }]) // leading model turn dropped
    expect(sent.body.systemInstruction.parts[0].text).toContain('protein 160 g')
    expect(sent.body.systemInstruction.parts[0].text).toContain('not a doctor')
  })
  it('503 without a key, 400 on empty', async () => {
    const tok = await issueToken(SECRET)
    const mk = (env, body) => worker.fetch(new Request('https://x/api/chat', { method: 'POST', headers: { authorization: `Bearer ${tok}` }, body: JSON.stringify(body) }), { DEVICE_SECRET: SECRET, ...env }, {})
    expect((await mk({}, { messages: [{ role: 'user', text: 'x' }] })).status).toBe(503)
    expect((await mk({ GEMINI_API_KEY: 'k' }, { messages: [] })).status).toBe(400)
  })
})
