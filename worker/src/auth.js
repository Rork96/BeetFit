// Accounts. A BeetFit "user" already exists per device group (sync); an account is a sign-in identity
// (email code, Google, Apple) attached to that user, so the data follows the person, not the phone.
//   • new identity → attached to this device's user (nothing moves, sync turns on)
//   • known identity on another user → this device and its paired siblings move to that user;
//     the client merges its local data into the account's copy
// Sign out detaches the device. Delete removes everything the user has on the server.

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i
const CODE_TTL = 10 * 60 * 1000
const GOOGLE = { jwks: 'https://www.googleapis.com/oauth2/v3/certs', iss: ['accounts.google.com', 'https://accounts.google.com'] }
const APPLE = { jwks: 'https://appleid.apple.com/auth/keys', iss: ['https://appleid.apple.com'] }

export const authConfig = env => ({
  email: !!(env.RESEND_API_KEY && env.MAIL_FROM),
  google: env.GOOGLE_CLIENT_ID || null,
  apple: env.APPLE_CLIENT_ID ? env.APPLE_CLIENT_ID.split(',')[0].trim() : null
})

export async function ensureAuthSchema(db) {
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS identities (provider TEXT NOT NULL, subject TEXT NOT NULL, user_id TEXT NOT NULL, email TEXT, created INTEGER NOT NULL, PRIMARY KEY (provider, subject))'),
    db.prepare('CREATE INDEX IF NOT EXISTS identities_user ON identities (user_id)'),
    db.prepare('CREATE TABLE IF NOT EXISTS email_codes (email TEXT PRIMARY KEY, hash TEXT NOT NULL, expires INTEGER NOT NULL, tries INTEGER NOT NULL DEFAULT 0)')
  ])
}

export async function accountOf(db, userId) {
  const { results } = await db.prepare('SELECT provider, email, created FROM identities WHERE user_id = ? ORDER BY created').bind(userId).all()
  if (!results.length) return null
  return { email: results.find(r => r.email)?.email || null, providers: results.map(r => ({ provider: r.provider, email: r.email })) }
}

// ---------- email codes ----------
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
async function codeHash(secret, email, code) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64u(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${email}|${code}`)))
}
export const cleanEmail = e => String(e || '').trim().toLowerCase()

export async function startEmail(db, env, email) {
  email = cleanEmail(email)
  if (!EMAIL_RE.test(email)) return { error: 'bad_email', status: 400 }
  if (!authConfig(env).email) return { error: 'email_not_configured', status: 503 }
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0')
  await db.prepare('INSERT OR REPLACE INTO email_codes (email, hash, expires, tries) VALUES (?, ?, ?, 0)')
    .bind(email, await codeHash(env.DEVICE_SECRET, email, code), Date.now() + CODE_TTL).run()
  const sent = await sendCode(env, email, code)
  if (!sent) return { error: 'email_failed', status: 502 }
  return { ok: true, status: 200 }
}

async function sendCode(env, email, code) {
  const html = `<div style="font-family:system-ui,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#111">
<p style="font-size:15px">Your BeetFit sign-in code:</p>
<p style="font-size:34px;font-weight:700;letter-spacing:6px;margin:12px 0">${code}</p>
<p style="font-size:13px;color:#666">It works for 10 minutes. If you didn't ask for it, ignore this email.</p></div>`
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [email], subject: `${code} is your BeetFit code`, text: `Your BeetFit sign-in code: ${code}\nIt works for 10 minutes.`, html })
  }).catch(() => null)
  return !!r?.ok
}

export async function verifyEmail(db, env, email, code) {
  email = cleanEmail(email)
  if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(String(code || ''))) return { error: 'bad_code', status: 400 }
  const row = await db.prepare('SELECT hash, expires, tries FROM email_codes WHERE email = ?').bind(email).first()
  if (!row || row.expires < Date.now()) return { error: 'code_expired', status: 400 }
  if (row.tries >= 5) return { error: 'too_many_tries', status: 429 }
  if (row.hash !== await codeHash(env.DEVICE_SECRET, email, code)) {
    await db.prepare('UPDATE email_codes SET tries = tries + 1 WHERE email = ?').bind(email).run()
    return { error: 'bad_code', status: 400 }
  }
  await db.prepare('DELETE FROM email_codes WHERE email = ?').bind(email).run()
  return { provider: 'email', subject: email, email }
}

// ---------- Google / Apple ID tokens (RS256 JWTs) ----------
const jwksCache = new Map() // url → { at, keys }
async function jwks(url, fetcher = fetch) {
  const c = jwksCache.get(url)
  if (c && Date.now() - c.at < 6 * 3600e3) return c.keys
  const r = await fetcher(url)
  if (!r.ok) throw new Error('jwks ' + r.status)
  const keys = (await r.json()).keys || []
  jwksCache.set(url, { at: Date.now(), keys })
  return keys
}
export const _clearJwks = () => jwksCache.clear()

const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0))
const parseJson = s => { try { return JSON.parse(new TextDecoder().decode(unb64u(s))) } catch { return null } }

export async function verifyJwt(token, { jwks: url, iss }, audiences, now = Date.now()) {
  const parts = String(token || '').split('.')
  if (parts.length !== 3) return null
  const head = parseJson(parts[0]), claims = parseJson(parts[1])
  if (!head || !claims || head.alg !== 'RS256') return null
  const jwk = (await jwks(url)).find(k => k.kid === head.kid)
  if (!jwk) return null
  const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, unb64u(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`))
  if (!ok) return null
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  if (!iss.includes(claims.iss) || !aud.some(a => audiences.includes(a))) return null
  if (!(claims.exp * 1000 > now - 60e3) || (claims.iat && claims.iat * 1000 > now + 300e3)) return null
  return claims
}

export async function verifyGoogle(env, credential) {
  if (!env.GOOGLE_CLIENT_ID) return { error: 'google_not_configured', status: 503 }
  const c = await verifyJwt(credential, GOOGLE, env.GOOGLE_CLIENT_ID.split(',').map(s => s.trim())).catch(() => null)
  if (!c?.sub) return { error: 'bad_token', status: 401 }
  return { provider: 'google', subject: c.sub, email: c.email_verified ? cleanEmail(c.email) : null }
}

export async function verifyApple(env, idToken) {
  if (!env.APPLE_CLIENT_ID) return { error: 'apple_not_configured', status: 503 }
  const c = await verifyJwt(idToken, APPLE, env.APPLE_CLIENT_ID.split(',').map(s => s.trim())).catch(() => null)
  if (!c?.sub) return { error: 'bad_token', status: 401 }
  return { provider: 'apple', subject: c.sub, email: c.email ? cleanEmail(c.email) : null }
}

// ---------- sign in / out / delete ----------
export async function signIn(db, userId, deviceId, who) {
  const found = await db.prepare('SELECT user_id FROM identities WHERE provider = ? AND subject = ?').bind(who.provider, who.subject).first()
  if (!found) {
    await db.prepare('INSERT INTO identities (provider, subject, user_id, email, created) VALUES (?, ?, ?, ?, ?)').bind(who.provider, who.subject, userId, who.email, Date.now()).run()
    return { status: 'linked', userId }
  }
  const target = found.user_id
  if (who.email) await db.prepare('UPDATE identities SET email = ? WHERE provider = ? AND subject = ?').bind(who.email, who.provider, who.subject).run()
  if (target === userId) return { status: 'same', userId }
  const signedIn = await db.prepare('SELECT 1 FROM identities WHERE user_id = ? LIMIT 1').bind(userId).first()
  if (signedIn) {
    // This device belongs to another account: move just this device.
    await db.prepare('UPDATE devices SET user_id = ? WHERE device_id = ?').bind(target, deviceId).run()
  } else {
    // An anonymous user (maybe several paired phones) joins the account; their data merges on the client.
    await db.batch([
      db.prepare('UPDATE devices SET user_id = ? WHERE user_id = ?').bind(target, userId),
      db.prepare('UPDATE push_subs SET user_id = ? WHERE user_id = ?').bind(target, userId),
      db.prepare('UPDATE links SET client_id = ? WHERE client_id = ? AND NOT EXISTS (SELECT 1 FROM links WHERE client_id = ?)').bind(target, userId, target),
      db.prepare('UPDATE coaches SET user_id = ? WHERE user_id = ? AND NOT EXISTS (SELECT 1 FROM coaches WHERE user_id = ?)').bind(target, userId, target),
      db.prepare('DELETE FROM pairs WHERE user_id = ?').bind(userId)
    ])
  }
  return { status: 'switched', userId: target }
}

export async function signOut(db, deviceId) {
  await db.prepare('DELETE FROM devices WHERE device_id = ?').bind(deviceId).run()
}

export async function deleteUser(db, userId) {
  const { results: links } = await db.prepare('SELECT id FROM links WHERE coach_id = ? OR client_id = ?').bind(userId, userId).all()
  const ids = links.map(l => l.id)
  const stmts = [
    db.prepare('DELETE FROM identities WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM docs WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM devices WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM pairs WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM push_subs WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM coaches WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM links WHERE coach_id = ? OR client_id = ?').bind(userId, userId)
  ]
  for (const id of ids) {
    stmts.push(db.prepare('DELETE FROM messages WHERE link_id = ?').bind(id), db.prepare('DELETE FROM overrides WHERE link_id = ?').bind(id))
  }
  await db.batch(stmts)
}
