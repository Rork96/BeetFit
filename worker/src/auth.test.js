import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { d1 } from '../test/d1.js'
import worker, { issueToken } from './index.js'
import { verifyJwt, _clearJwks } from './auth.js'

const SECRET = 'auth-test-secret-0123456789'
const env = { DEVICE_SECRET: SECRET, DB: d1(), RESEND_API_KEY: 're_test', MAIL_FROM: 'BeetFit <login@wealthifai.xyz>', GOOGLE_CLIENT_ID: 'gid.apps.googleusercontent.com', APPLE_CLIENT_ID: 'xyz.wealthifai.beetfit.web' }
const mails = []
let realFetch, rsa, jwk
const call = (tok, path, method = 'GET', body) => worker.fetch(new Request('https://x' + path, {
  method, headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined
}), env, { waitUntil: () => {} }).then(async r => ({ status: r.status, ...(await r.json()) }))

const b64u = v => Buffer.from(typeof v === 'string' ? v : new Uint8Array(v)).toString('base64url')
async function jwt(claims, kid = 'k1', key = rsa.privateKey) {
  const head = b64u(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' })), body = b64u(JSON.stringify(claims))
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${head}.${body}`))
  return `${head}.${body}.${b64u(sig)}`
}
const now = () => Math.floor(Date.now() / 1000)

beforeAll(async () => {
  rsa = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])
  jwk = { ...(await crypto.subtle.exportKey('jwk', rsa.publicKey)), kid: 'k1', use: 'sig' }
  realFetch = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    url = String(url)
    if (url.startsWith('https://api.resend.com/')) { mails.push(JSON.parse(init.body)); return new Response('{"id":"m"}', { status: 200 }) }
    if (url.includes('googleapis.com/oauth2/v3/certs') || url.includes('appleid.apple.com/auth/keys')) return Response.json({ keys: [jwk] })
    return new Response('nope', { status: 404 })
  }
  _clearJwks()
})
afterAll(() => { globalThis.fetch = realFetch })

const codeOf = to => mails.filter(m => m.to[0] === to).at(-1).subject.slice(0, 6)

describe('accounts', () => {
  it('config tells the app which sign-ins exist', async () => {
    const r = await worker.fetch(new Request('https://x/api/auth/config'), env, {})
    expect(await r.json()).toEqual({ email: true, google: 'gid.apps.googleusercontent.com', apple: 'xyz.wealthifai.beetfit.web' })
    const bare = await worker.fetch(new Request('https://x/api/auth/config'), { DEVICE_SECRET: SECRET }, {})
    expect(await bare.json()).toEqual({ email: false, google: null, apple: null })
  })

  it('email code: wrong code counts tries, right code links the identity to this user', async () => {
    const A = await issueToken(SECRET)
    await call(A, '/api/sync', 'PUT', { data: { profile: { goal: 'lose' }, foodLog: { '2026-10-24': [{ at: 1 }] } }, baseRev: 0 })
    expect((await call(A, '/api/auth/email/start', 'POST', { email: 'nope' })).error).toBe('bad_email')
    expect((await call(A, '/api/auth/email/start', 'POST', { email: ' Max@Example.com ' })).ok).toBe(true)
    const code = codeOf('max@example.com')
    expect(code).toMatch(/^\d{6}$/)
    expect(mails.at(-1).from).toBe('BeetFit <login@wealthifai.xyz>')
    const wrong = code === '000000' ? '111111' : '000000'
    expect((await call(A, '/api/auth/email/verify', 'POST', { email: 'max@example.com', code: wrong })).error).toBe('bad_code')
    const r = await call(A, '/api/auth/email/verify', 'POST', { email: 'MAX@example.com', code })
    expect(r).toMatchObject({ result: 'linked', account: { email: 'max@example.com', providers: [{ provider: 'email' }] } })
    expect(r.doc).toBeUndefined()
    // a used code doesn't work twice
    expect((await call(A, '/api/auth/email/verify', 'POST', { email: 'max@example.com', code })).error).toBe('code_expired')
    expect((await call(A, '/api/auth/me')).account.email).toBe('max@example.com')
  })

  it('five wrong codes lock the code', async () => {
    const A = await issueToken(SECRET)
    await call(A, '/api/auth/email/start', 'POST', { email: 'lock@example.com' })
    const code = codeOf('lock@example.com')
    const wrong = code === '000000' ? '111111' : '000000'
    for (let i = 0; i < 5; i++) await call(A, '/api/auth/email/verify', 'POST', { email: 'lock@example.com', code: wrong })
    expect((await call(A, '/api/auth/email/verify', 'POST', { email: 'lock@example.com', code })).error).toBe('too_many_tries')
  })

  it('signing in on a new phone moves it (and its paired phones) to the account and returns the data', async () => {
    const owner = await issueToken(SECRET)
    await call(owner, '/api/sync', 'PUT', { data: { profile: { goal: 'gain' }, weightLog: [{ date: '2026-10-20', kg: 70 }] }, baseRev: 0 })
    await call(owner, '/api/auth/email/start', 'POST', { email: 'ann@example.com' })
    await call(owner, '/api/auth/email/verify', 'POST', { email: 'ann@example.com', code: codeOf('ann@example.com') })

    const phone = await issueToken(SECRET), tablet = await issueToken(SECRET)
    const { code: pair } = await call(phone, '/api/pair', 'POST')
    await call(tablet, '/api/pair/claim', 'POST', { code: pair })
    await call(phone, '/api/auth/email/start', 'POST', { email: 'ann@example.com' })
    const r = await call(phone, '/api/auth/email/verify', 'POST', { email: 'ann@example.com', code: codeOf('ann@example.com') })
    expect(r.result).toBe('switched')
    expect(r.doc.data.profile.goal).toBe('gain')
    expect(r.doc.devices).toBe(3)
    expect((await call(tablet, '/api/sync')).data.profile.goal).toBe('gain')
    expect((await call(tablet, '/api/auth/me')).account.email).toBe('ann@example.com')
  })

  it('Google and Apple ID tokens are verified against their keys, audience, issuer and expiry', async () => {
    const A = await issueToken(SECRET)
    const good = await jwt({ iss: 'https://accounts.google.com', aud: env.GOOGLE_CLIENT_ID, sub: 'g-123', email: 'G@x.com', email_verified: true, exp: now() + 600, iat: now() })
    const r = await call(A, '/api/auth/google', 'POST', { credential: good })
    expect(r).toMatchObject({ result: 'linked', account: { email: 'g@x.com', providers: [{ provider: 'google' }] } })
    expect((await call(A, '/api/auth/google', 'POST', { credential: good })).result).toBe('same')
    const otherAud = await jwt({ iss: 'https://accounts.google.com', aud: 'someone-else', sub: 'g-9', exp: now() + 600 })
    expect((await call(A, '/api/auth/google', 'POST', { credential: otherAud })).error).toBe('bad_token')
    const expired = await jwt({ iss: 'https://accounts.google.com', aud: env.GOOGLE_CLIENT_ID, sub: 'g-9', exp: now() - 3600 })
    expect((await call(A, '/api/auth/google', 'POST', { credential: expired })).error).toBe('bad_token')
    const forged = await jwt({ iss: 'https://accounts.google.com', aud: env.GOOGLE_CLIENT_ID, sub: 'g-9', exp: now() + 600 }, 'k1',
      (await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign'])).privateKey)
    expect((await call(A, '/api/auth/google', 'POST', { credential: forged })).error).toBe('bad_token')
    // Apple on the same user = a second way into the same account
    const apple = await jwt({ iss: 'https://appleid.apple.com', aud: env.APPLE_CLIENT_ID, sub: 'a-1', email: 'relay@privaterelay.appleid.com', exp: now() + 600 })
    const ra = await call(A, '/api/auth/apple', 'POST', { idToken: apple })
    expect(ra.account.providers.map(p => p.provider)).toEqual(['google', 'apple'])
  })

  it('verifyJwt rejects junk', async () => {
    expect(await verifyJwt('a.b', { jwks: 'https://www.googleapis.com/oauth2/v3/certs', iss: [] }, [])).toBeNull()
    expect(await verifyJwt('x.y.z', { jwks: 'https://www.googleapis.com/oauth2/v3/certs', iss: [] }, [])).toBeNull()
  })

  it('sign out detaches only this device; delete removes the user everywhere', async () => {
    const A = await issueToken(SECRET), B = await issueToken(SECRET)
    await call(A, '/api/sync', 'PUT', { data: { profile: { goal: 'lose' } }, baseRev: 0 })
    await call(A, '/api/auth/email/start', 'POST', { email: 'bye@example.com' })
    await call(A, '/api/auth/email/verify', 'POST', { email: 'bye@example.com', code: codeOf('bye@example.com') })
    await call(B, '/api/auth/email/start', 'POST', { email: 'bye@example.com' })
    await call(B, '/api/auth/email/verify', 'POST', { email: 'bye@example.com', code: codeOf('bye@example.com') })

    expect((await call(B, '/api/auth/signout', 'POST')).ok).toBe(true)
    expect((await call(B, '/api/auth/me')).account).toBeNull()
    expect((await call(A, '/api/auth/me')).account.email).toBe('bye@example.com')

    expect((await call(A, '/api/auth/delete', 'POST', {})).error).toBe('confirm')
    expect((await call(A, '/api/auth/delete', 'POST', { confirm: 'DELETE' })).ok).toBe(true)
    expect((await call(A, '/api/sync')).data).toBeNull()
    expect(await env.DB.prepare("SELECT 1 FROM identities WHERE subject = 'bye@example.com'").first()).toBeNull()
    // the email can start a fresh account later
    await call(B, '/api/auth/email/start', 'POST', { email: 'bye@example.com' })
    expect((await call(B, '/api/auth/email/verify', 'POST', { email: 'bye@example.com', code: codeOf('bye@example.com') })).result).toBe('linked')
  })
})
