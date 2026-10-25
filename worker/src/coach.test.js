import { describe, it, expect, beforeAll } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import worker, { issueToken } from './index.js'

function d1() {
  const db = new DatabaseSync(':memory:')
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } } }
  })
  return { prepare: sql => stmt(sql), batch: async list => Promise.all(list.map(s => s.run())) }
}

const SECRET = 'coach-test-secret-0123456789'
const env = { DEVICE_SECRET: SECRET, DB: d1() }
let COACH, CLIENT, OTHER
const call = (tok, path, method = 'GET', body) => worker.fetch(new Request('https://x' + path, {
  method, headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json', 'cf-connecting-ip': '9.9.9.9' },
  body: body ? JSON.stringify(body) : undefined
}), env, {}).then(async r => ({ status: r.status, ...(await r.json()) }))

beforeAll(async () => { [COACH, CLIENT, OTHER] = await Promise.all([issueToken(SECRET), issueToken(SECRET), issueToken(SECRET)]) })

describe('coach mode', () => {
  let code, linkId
  it('a user becomes a coach and gets a 6-character code', async () => {
    expect((await call(COACH, '/api/coach/setup', 'POST', { name: 'x' })).error).toBe('bad_name')
    const r = await call(COACH, '/api/coach/setup', 'POST', { name: 'Olena K' })
    expect(r.code).toMatch(/^[A-Z2-9]{6}$/)
    code = r.code
    expect((await call(COACH, '/api/coach/setup', 'POST', { name: 'Olena Koval' })).code).toBe(code) // rename keeps the code
  })
  it('a client checks and joins with the code (any case)', async () => {
    await call(CLIENT, '/api/sync', 'PUT', { data: { profile: { goal: 'lose' }, settings: { name: 'Max' } }, baseRev: 0, summary: { name: 'Max', adh: 67 } })
    expect((await call(CLIENT, '/api/coach/peek', 'POST', { code: 'ZZZZZZ' })).error).toBe('bad_code')
    expect((await call(COACH, '/api/coach/join', 'POST', { code })).error).toBe('own_code')
    expect((await call(CLIENT, '/api/coach/peek', 'POST', { code: code.toLowerCase() })).name).toBe('Olena Koval')
    const j = await call(CLIENT, '/api/coach/join', 'POST', { code })
    expect(j.coach.name).toBe('Olena Koval')
    expect((await call(CLIENT, '/api/coach/link')).coach.name).toBe('Olena Koval')
  })
  it('the coach sees the client with their summary and full doc', async () => {
    const l = await call(COACH, '/api/coach/clients')
    expect(l.clients).toHaveLength(1)
    expect(l.clients[0].summary).toEqual({ name: 'Max', adh: 67 })
    linkId = l.clients[0].id
    const c = await call(COACH, `/api/coach/client/${linkId}`)
    expect(c.data.settings.name).toBe('Max')
    expect((await call(OTHER, `/api/coach/client/${linkId}`)).error).toBe('not_coach')
  })
  it('messages both ways with unread counts', async () => {
    expect((await call(COACH, `/api/coach/client/${linkId}/msg`, 'POST', { text: '  Nice squats  ' })).msg.text).toBe('Nice squats')
    await call(CLIENT, '/api/coach/msg', 'POST', { text: 'Thanks! Knee ok' })
    expect((await call(CLIENT, '/api/coach/msg', 'POST', { text: '   ' })).error).toBe('empty')
    expect((await call(COACH, '/api/coach/clients')).clients[0].unread).toBe(1)
    await call(COACH, `/api/coach/client/${linkId}/seen`, 'POST')
    expect((await call(COACH, '/api/coach/clients')).clients[0].unread).toBe(0)
    const t = await call(CLIENT, '/api/coach/link')
    expect(t.msgs.map(m => m.by)).toEqual(['coach', 'client'])
    expect(t.msgs[0].seen).toBe(false)
    await call(CLIENT, '/api/coach/seen', 'POST')
    expect((await call(CLIENT, '/api/coach/link')).msgs[0].seen).toBe(true)
  })
  it('target override is clamped and clearable', async () => {
    const o = await call(COACH, `/api/coach/client/${linkId}/override`, 'PUT', { kcal: 2100.4, protein: 9999, note: 'Hold calories through the deload' })
    expect(o.override).toMatchObject({ kcal: 2100, protein: null, note: 'Hold calories through the deload' })
    expect((await call(CLIENT, '/api/coach/link')).override.kcal).toBe(2100)
    expect((await call(COACH, `/api/coach/client/${linkId}/override`, 'PUT', {})).override).toBeNull()
  })
  it('a new code invalidates the old one', async () => {
    const r = await call(COACH, '/api/coach/code', 'POST')
    expect(r.code).not.toBe(code)
    expect((await call(OTHER, '/api/coach/peek', 'POST', { code })).error).toBe('bad_code')
    expect((await call(OTHER, '/api/coach/code', 'POST')).error).toBe('not_coach')
  })
  it('the client can leave; the link and thread are gone', async () => {
    await call(CLIENT, '/api/coach/leave', 'POST')
    expect((await call(CLIENT, '/api/coach/link')).coach).toBeNull()
    expect((await call(COACH, '/api/coach/clients')).clients).toHaveLength(0)
    expect((await call(COACH, `/api/coach/client/${linkId}`)).status).toBe(404)
  })
})
