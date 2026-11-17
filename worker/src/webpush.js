// Web Push with nothing but WebCrypto: VAPID (RFC 8292) + aes128gcm payload encryption (RFC 8291).
// VAPID_JWK is the whole ES256 private key as JWK (`node scripts/vapid.mjs` makes one).

const enc = new TextEncoder()
export const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
export const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0))
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.length }
  return out
}

// Raw uncompressed P-256 public key (65 bytes) from the JWK's x / y.
export function vapidPublic(jwk) {
  const k = typeof jwk === 'string' ? JSON.parse(jwk) : jwk
  return b64u(concat(new Uint8Array([4]), unb64u(k.x), unb64u(k.y)))
}

async function vapidAuth(endpoint, jwkStr, subject) {
  const jwk = JSON.parse(jwkStr)
  const key = await crypto.subtle.importKey('jwk', { ...jwk, key_ops: ['sign'], ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const body = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })))
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${body}`))
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${vapidPublic(jwk)}`
}

async function hkdf(salt, ikm, info, bytes) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8))
}

// Encrypts `payload` for one subscription ({ p256dh, auth } base64url). Returns the request body.
export async function encrypt(payload, sub, { salt = crypto.getRandomValues(new Uint8Array(16)), server } = {}) {
  const uaPublic = unb64u(sub.p256dh)
  const authSecret = unb64u(sub.auth)
  const as = server || await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey))
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256))
  const ikm = await hkdf(authSecret, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32)
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12)
  const plain = concat(enc.encode(typeof payload === 'string' ? payload : JSON.stringify(payload)), new Uint8Array([2]))
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, plain))
  const header = new Uint8Array(21)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, 4096)
  header[20] = asPublic.length
  return concat(header, asPublic, cipher)
}

// → { ok, status, gone } — gone = the subscription is dead (unsubscribed / expired), delete it.
export async function sendPush(sub, payload, env, { ttl = 60 * 60 * 12, urgency = 'normal', topic } = {}) {
  const body = await encrypt(payload, sub)
  const headers = {
    authorization: await vapidAuth(sub.endpoint, env.VAPID_JWK, env.VAPID_SUBJECT || 'https://beetfit.wealthifai.xyz'),
    'content-encoding': 'aes128gcm',
    'content-type': 'application/octet-stream',
    ttl: String(ttl),
    urgency
  }
  if (topic) headers.topic = topic
  const res = await fetch(sub.endpoint, { method: 'POST', headers, body })
  return { ok: res.status >= 200 && res.status < 300, status: res.status, gone: res.status === 404 || res.status === 410 }
}
