import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { d1 } from '../test/d1.js'
import worker, { issueToken, runReminders } from './index.js'
import { b64u } from './webpush.js'

const SECRET = 'push-test-secret-0123456789'
const env = { DEVICE_SECRET: SECRET, DB: d1() }
const sent = []
let realFetch, A, B
const call = (tok, path, method = 'GET', body) => worker.fetch(new Request('https://x' + path, {
  method, headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined
}), env, { waitUntil: p => waits.push(p) }).then(async r => ({ status: r.status, ...(await r.json()) }))
const waits = []
async function fakeSub(host = 'fcm.googleapis.com') {
  const ua = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  return { endpoint: `https://${host}/fcm/send/${crypto.randomUUID()}`, keys: { p256dh: b64u(await crypto.subtle.exportKey('raw', ua.publicKey)), auth: b64u(crypto.getRandomValues(new Uint8Array(16))) } }
}

beforeAll(async () => {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign'])
  env.VAPID_JWK = JSON.stringify(await crypto.subtle.exportKey('jwk', kp.privateKey))
  A = await issueToken(SECRET); B = await issueToken(SECRET)
  realFetch = globalThis.fetch
  globalThis.fetch = async (url, init) => { sent.push({ url: String(url), init }); return new Response(null, { status: 201 }) }
})
afterAll(() => { globalThis.fetch = realFetch })

describe('push', () => {
  it('publishes the VAPID key and health shows push', async () => {
    const r = await worker.fetch(new Request('https://x/api/push/key'), env, {})
    expect((await r.json()).key).toMatch(/^B[A-Za-z0-9_-]{86}$/)
  })
  it('rejects endpoints that are not push services', async () => {
    const s = await fakeSub('evil.example.com')
    expect((await call(A, '/api/push/subscribe', 'POST', { sub: s, tz: 'UTC' })).error).toBe('bad_subscription')
  })
  it('subscribes, schedules, and sends a due reminder only when not done', async () => {
    const s = await fakeSub()
    const r = await call(A, '/api/push/subscribe', 'POST', { sub: s, tz: 'America/Winnipeg', prefs: { meals: { on: true, h: 12, m: 30 }, workout: { on: false }, streak: { on: false } } })
    expect(r.next.kind).toBe('meals')
    expect((await call(A, '/api/push/test', 'POST', { endpoint: s.endpoint })).ok).toBe(true)
    expect(sent.at(-1).url).toBe(s.endpoint)
    sent.length = 0
    expect(await runReminders(env, r.next.at - 1000)).toMatchObject({ due: 0 })
    const res = await runReminders(env, r.next.at + 60000)
    expect(res).toMatchObject({ due: 1, sent: 1 })
    expect(sent).toHaveLength(1)
    expect(sent[0].init.headers['content-encoding']).toBe('aes128gcm')
    // next one is tomorrow; logging food today keeps it quiet
    const row = await env.DB.prepare('SELECT next_at FROM push_subs WHERE endpoint = ?').bind(s.endpoint).first()
    expect(row.next_at - r.next.at).toBe(24 * 3600 * 1000)
  })
  it('stays quiet when already logged, deletes dead subscriptions', async () => {
    const s = await fakeSub()
    const r = await call(B, '/api/push/subscribe', 'POST', { sub: s, tz: 'UTC', prefs: { meals: { on: true, h: 9, m: 0 }, workout: { on: false }, streak: { on: false } } })
    const today = new Date(r.next.at).toISOString().slice(0, 10)
    await call(B, '/api/sync', 'PUT', { data: { foodLog: { [today]: [{ at: 1 }] } }, baseRev: 0 })
    sent.length = 0
    expect(await runReminders(env, r.next.at + 1000)).toMatchObject({ due: 1, sent: 0, quiet: 1 })
    globalThis.fetch = async () => new Response(null, { status: 410 })
    await call(B, '/api/sync', 'PUT', { data: {}, baseRev: 1 })
    const row = await env.DB.prepare('SELECT next_at FROM push_subs WHERE endpoint = ?').bind(s.endpoint).first()
    await runReminders(env, row.next_at + 1000)
    expect(await env.DB.prepare('SELECT 1 FROM push_subs WHERE endpoint = ?').bind(s.endpoint).first()).toBeNull()
    globalThis.fetch = async (url, init) => { sent.push({ url: String(url), init }); return new Response(null, { status: 201 }) }
  })
  it('delivers a calendar reminder at its time', async () => {
    const s = await fakeSub()
    const at = Date.now() + 3600e3
    const off = { meals: { on: false }, workout: { on: false }, streak: { on: false } }
    const r = await call(A, '/api/push/subscribe', 'POST', { sub: s, tz: 'UTC', prefs: off, events: [{ at, kind: 'note', title: 'Physio', body: 'From your BeetFit calendar.', url: '/?cal=x', tag: 'plan-1' }] })
    expect(r).toMatchObject({ events: 1, next: { at, kind: 'event' } })
    sent.length = 0
    const res = await runReminders(env, at + 1000)
    expect(res.sent).toBeGreaterThanOrEqual(1)
    expect(sent.map(x => x.url)).toContain(s.endpoint)
    const row = await env.DB.prepare('SELECT next_at, events FROM push_subs WHERE endpoint = ?').bind(s.endpoint).first()
    expect(row.next_at).toBeNull()
    expect(JSON.parse(row.events)).toEqual([])
  })
  it('a coach message pushes to the client', async () => {
    const s = await fakeSub()
    await call(B, '/api/push/subscribe', 'POST', { sub: s, tz: 'UTC', prefs: {} })
    const { code } = await call(A, '/api/coach/setup', 'POST', { name: 'Coach Ann' })
    await call(B, '/api/coach/join', 'POST', { code })
    const { clients } = await call(A, '/api/coach/clients')
    sent.length = 0
    await call(A, `/api/coach/client/${clients[0].id}/msg`, 'POST', { text: 'Great week' })
    await Promise.all(waits)
    expect(sent.map(x => x.url)).toContain(s.endpoint)
  })
})
