import { describe, it, expect } from 'vitest'
import { encrypt, sendPush, vapidPublic, b64u, unb64u } from './webpush.js'

const enc = new TextEncoder()
async function hkdf(salt, ikm, info, n) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, n * 8))
}
// Receiver side of RFC 8291, written independently of the sender.
async function decrypt(body, ua, authSecret) {
  const salt = body.slice(0, 16), rs = new DataView(body.buffer, body.byteOffset).getUint32(16), idlen = body[20]
  const asPublic = body.slice(21, 21 + idlen), cipher = body.slice(21 + idlen)
  const uaPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ua.publicKey))
  const asKey = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, ua.privateKey, 256))
  const info = new Uint8Array([...enc.encode('WebPush: info\0'), ...uaPublic, ...asPublic])
  const ikm = await hkdf(authSecret, shared, info, 32)
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12)
  const k = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt'])
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, k, cipher))
  expect(rs).toBe(4096)
  expect(plain[plain.length - 1]).toBe(2) // last-record delimiter
  return new TextDecoder().decode(plain.slice(0, -1))
}

async function browserSub() {
  const ua = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const auth = crypto.getRandomValues(new Uint8Array(16))
  const p256dh = b64u(await crypto.subtle.exportKey('raw', ua.publicKey))
  return { ua, auth, sub: { endpoint: 'https://push.example.com/send/abc', p256dh, auth: b64u(auth) } }
}

describe('web push', () => {
  it('encrypts a payload only the subscriber can read (aes128gcm)', async () => {
    const { ua, auth, sub } = await browserSub()
    const body = await encrypt({ title: 'Log lunch', body: 'Two taps' }, sub)
    expect(JSON.parse(await decrypt(body, ua, auth))).toEqual({ title: 'Log lunch', body: 'Two taps' })
    const other = await browserSub()
    await expect(decrypt(body, other.ua, other.auth)).rejects.toBeTruthy()
  })

  it('signs a VAPID JWT for the push service origin', async () => {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
    const jwk = JSON.stringify(await crypto.subtle.exportKey('jwk', kp.privateKey))
    const { sub } = await browserSub()
    let seen
    const realFetch = globalThis.fetch
    globalThis.fetch = async (url, init) => { seen = { url, init }; return new Response(null, { status: 201 }) }
    try {
      const r = await sendPush(sub, { title: 'x' }, { VAPID_JWK: jwk })
      expect(r).toEqual({ ok: true, status: 201, gone: false })
    } finally { globalThis.fetch = realFetch }
    const m = seen.init.headers.authorization.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/)
    expect(m[4]).toBe(vapidPublic(jwk))
    const claims = JSON.parse(new TextDecoder().decode(unb64u(m[2])))
    expect(claims.aud).toBe('https://push.example.com')
    expect(claims.exp).toBeGreaterThan(Date.now() / 1000)
    const pub = await crypto.subtle.importKey('raw', unb64u(m[4]), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
    const okSig = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, unb64u(m[3]), enc.encode(`${m[1]}.${m[2]}`))
    expect(okSig).toBe(true)
    expect(seen.init.headers['content-encoding']).toBe('aes128gcm')
  })

  it('reports dead subscriptions', async () => {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign'])
    const jwk = JSON.stringify(await crypto.subtle.exportKey('jwk', kp.privateKey))
    const { sub } = await browserSub()
    const realFetch = globalThis.fetch
    globalThis.fetch = async () => new Response(null, { status: 410 })
    try { expect((await sendPush(sub, 'x', { VAPID_JWK: jwk })).gone).toBe(true) } finally { globalThis.fetch = realFetch }
  })
})
