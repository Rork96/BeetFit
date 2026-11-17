import { describe, it, expect } from 'vitest'
import { d1 } from '../test/d1.js'
import { digest, nextMailAt, setMail, getMail, runMail, unsubToken, unsubscribe } from './mailrem.js'

const T = '2026-11-02'
const doc = (extra = {}) => ({ settings: { name: 'Max Z' }, program: [1, 2, 3], foodLog: {}, workoutLog: {}, water: {}, weightLog: [{ date: T, kg: 90 }], ...extra })
const ORIGIN = 'https://beetfit.test', LINK = ORIGIN + '/api/mail/unsub?u=x&t=y'

describe('email digest', () => {
  it('lists what is open, in one email, with the unsubscribe link in text and html', () => {
    const d = digest(doc(), T, ORIGIN, LINK)
    expect(d.subject).toMatch(/things left|Training|Log what/)
    expect(d.text).toContain('Max, here is what is still open today')
    expect(d.text).toContain(LINK)
    expect(d.html).toContain('Stop these emails')
  })
  it('stays quiet when everything is done, or when there is no synced doc', () => {
    const done = doc({ foodLog: { [T]: [{ name: 'Eggs' }] }, workoutLog: { [T]: { squat: { sets: [{ reps: 8, kg: 20 }] } } } })
    expect(digest(done, T, ORIGIN, LINK)).toBeNull()
    expect(digest(null, T, ORIGIN, LINK)).toBeNull()
  })
  it('adds the weekly weigh-in only when the last one is 7+ days old', () => {
    const done = { foodLog: { [T]: [{ name: 'Eggs' }] }, workoutLog: { [T]: { squat: { sets: [{ reps: 8, kg: 20 }] } } } }
    expect(digest(doc({ ...done, weightLog: [{ date: '2026-10-20', kg: 90 }] }), T, ORIGIN, LINK).subject).toBe('Weekly weigh-in')
    expect(digest(doc({ ...done, weightLog: [{ date: '2026-10-30', kg: 90 }] }), T, ORIGIN, LINK)).toBeNull()
  })
})

describe('schedule and send', () => {
  const tz = 'America/Winnipeg'
  it('next time is the next 18:00 in the person’s zone', () => {
    // Fixed zones, not Winnipeg: its rules are a political decision that changes, these assertions should not.
    expect(nextMailAt(18, 0, 'Asia/Tokyo', Date.parse('2027-01-15T06:00:00Z'))).toBe(Date.parse('2027-01-15T09:00:00Z')) // 15:00 JST → 18:00 JST today
    expect(nextMailAt(18, 0, 'Asia/Tokyo', Date.parse('2027-01-15T09:00:00Z'))).toBe(Date.parse('2027-01-16T09:00:00Z')) // strictly after → tomorrow
    expect(nextMailAt(18, 0, 'America/New_York', Date.parse('2027-07-15T12:00:00Z'))).toBe(Date.parse('2027-07-15T22:00:00Z')) // EDT, UTC-4
    expect(nextMailAt(18, 0, 'America/New_York', Date.parse('2027-01-15T12:00:00Z'))).toBe(Date.parse('2027-01-15T23:00:00Z')) // EST, UTC-5
  })
  it('sends one email when due, not twice for the same day, and not after unsubscribing', async () => {
    const db = d1()
    const env = { DB: db, RESEND_API_KEY: 're', MAIL_FROM: 'BeetFit <x@y>', DEVICE_SECRET: 'secret-0123456789-secret' }
    await setMail(db, 'u1', { on: true, h: 18, m: 0, tz })
    const due = (await getMail(db, 'u1'))
    expect(due).toMatchObject({ on: true, h: 18, m: 0, tz })
    const row = await db.prepare('SELECT next_at FROM mail_rem WHERE user_id = ?').bind('u1').first()
    const mails = []
    const deps = { origin: ORIGIN, accountOf: async () => ({ email: 'max@example.com' }), getDoc: async () => doc(), fetchFn: async (u, init) => { mails.push(JSON.parse(init.body)); return Response.json({ id: 'm' }) } }
    expect((await runMail(env, row.next_at + 60e3, deps)).sent).toBe(1)
    expect(mails[0].to).toEqual(['max@example.com'])
    expect(mails[0].headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
    expect(mails[0].headers['List-Unsubscribe']).toContain(await unsubToken(env.DEVICE_SECRET, 'u1'))
    expect((await runMail(env, row.next_at + 120e3, deps)).due).toBe(0) // rescheduled to tomorrow
    await unsubscribe(db, 'u1')
    expect((await runMail(env, row.next_at + 864e5 + 60e3, deps)).due).toBe(0)
  })
  it('skips a send that is more than 2 h late, and keeps the row due after a failed send', async () => {
    const db = d1()
    const env = { DB: db, RESEND_API_KEY: 're', MAIL_FROM: 'BeetFit <x@y>', DEVICE_SECRET: 'secret-0123456789-secret' }
    await setMail(db, 'u2', { on: true, h: 18, m: 0, tz })
    const at = (await db.prepare('SELECT next_at FROM mail_rem WHERE user_id = ?').bind('u2').first()).next_at
    let calls = 0
    const deps = { origin: ORIGIN, accountOf: async () => ({ email: 'a@b.co' }), getDoc: async () => doc(), fetchFn: async () => { calls++; return new Response('no', { status: 500 }) } }
    const r = await runMail(env, at + 60e3, deps)
    expect(r).toMatchObject({ due: 1, sent: 0 })
    expect((await db.prepare('SELECT next_at FROM mail_rem WHERE user_id = ?').bind('u2').first()).next_at).toBe(at) // retry next tick
    expect((await runMail(env, at + 3 * 3600e3, deps)).sent).toBe(0) // too late: skipped, moves to tomorrow
    expect(calls).toBe(1)
    expect((await db.prepare('SELECT next_at FROM mail_rem WHERE user_id = ?').bind('u2').first()).next_at).toBeGreaterThan(at)
  })
})
