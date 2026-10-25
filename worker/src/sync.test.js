import { describe, it, expect, beforeAll } from 'vitest'
import { d1 } from '../test/d1.js'
import worker, { issueToken } from './index.js'

const SECRET = 'sync-test-secret-0123456789'
const env = { DEVICE_SECRET: SECRET, DB: d1() }
let A, B
const call = (tok, path, method = 'GET', body) => worker.fetch(new Request('https://x' + path, {
  method, headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json', 'cf-connecting-ip': '1.2.3.4' },
  body: body ? JSON.stringify(body) : undefined
}), env, {}).then(async r => ({ status: r.status, ...(await r.json()) }))

beforeAll(async () => { A = await issueToken(SECRET); B = await issueToken(SECRET) })

describe('sync', () => {
  it('starts empty, then stores a doc with rev', async () => {
    const g = await call(A, '/api/sync')
    expect(g).toMatchObject({ status: 200, rev: 0, data: null, devices: 1 })
    const p = await call(A, '/api/sync', 'PUT', { data: { profile: { goal: 'lose' } }, baseRev: 0 })
    expect(p).toMatchObject({ status: 200, rev: 1 })
    expect((await call(A, '/api/sync')).data.profile.goal).toBe('lose')
  })
  it('rejects a stale rev with the server copy', async () => {
    const p = await call(A, '/api/sync', 'PUT', { data: { x: 1 }, baseRev: 0 })
    expect(p.status).toBe(409)
    expect(p).toMatchObject({ error: 'conflict', rev: 1, data: { profile: { goal: 'lose' } } })
  })
  it('validates the body', async () => {
    expect((await call(A, '/api/sync', 'PUT', { data: 'nope', baseRev: 1 })).status).toBe(400)
    expect((await call(A, '/api/sync', 'PUT', { data: {} })).status).toBe(400)
  })
  it('pairs a second device with a 6-digit code', async () => {
    const { code, expires } = await call(A, '/api/pair', 'POST')
    expect(code).toMatch(/^\d{6}$/)
    expect(expires).toBeGreaterThan(Date.now())
    expect((await call(A, '/api/pair/claim', 'POST', { code })).error).toBe('same_device')
    const c = await call(B, '/api/pair/claim', 'POST', { code })
    expect(c).toMatchObject({ status: 200, rev: 1, devices: 2, data: { profile: { goal: 'lose' } } })
    expect((await call(B, '/api/pair/claim', 'POST', { code })).error).toBe('bad_code') // single use
    const p = await call(B, '/api/sync', 'PUT', { data: { profile: { goal: 'gain' } }, baseRev: 1 })
    expect(p.rev).toBe(2)
    expect((await call(A, '/api/sync')).data.profile.goal).toBe('gain')
  })
  it('rejects malformed codes', async () => {
    expect((await call(B, '/api/pair/claim', 'POST', { code: '12' })).error).toBe('bad_code')
  })
  it('leaving unlinks only that device', async () => {
    expect((await call(B, '/api/sync/leave', 'POST')).ok).toBe(true)
    expect(await call(B, '/api/sync')).toMatchObject({ rev: 0, data: null })
    expect((await call(A, '/api/sync')).devices).toBe(1)
  })
  it('503 when D1 is not bound', async () => {
    const r = await worker.fetch(new Request('https://x/api/sync', { headers: { authorization: `Bearer ${A}` } }), { DEVICE_SECRET: SECRET }, {})
    expect(r.status).toBe(503)
  })
})
