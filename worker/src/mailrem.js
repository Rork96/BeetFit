// Email check-in: at most ONE email a day, at the time the person picks, and only when something is still open today.
// Opt-in, accounts only (the email comes from the signed-in identity), one-click unsubscribe in every message.
// Needs the synced document: without it we can't know what is already done, so we stay quiet rather than nag.
import { message, localDay, localToUtc, validTz } from './reminders.js'

export const MAIL_DEFAULT = { on: false, h: 18, m: 0 }

export async function ensureMailSchema(db) {
  await db.prepare('CREATE TABLE IF NOT EXISTS mail_rem (user_id TEXT PRIMARY KEY, tz TEXT NOT NULL, h INTEGER NOT NULL, m INTEGER NOT NULL, on_ INTEGER NOT NULL DEFAULT 1, next_at INTEGER, last_day TEXT)').run()
  await db.prepare('CREATE INDEX IF NOT EXISTS mail_due ON mail_rem (next_at)').run()
}

export const cleanMail = (p = {}) => {
  const h = Math.min(23, Math.max(0, Math.round(+p.h))), m = Math.min(59, Math.max(0, Math.round(+p.m)))
  return { on: !!p.on, h: Number.isFinite(h) ? h : MAIL_DEFAULT.h, m: Number.isFinite(m) ? m : MAIL_DEFAULT.m }
}

// Next send time strictly after `from`, in the person's own time zone.
export function nextMailAt(h, m, tz, from = Date.now()) {
  for (let add = 0; add < 3; add++) {
    const [y, mo, d] = localDay(from + add * 864e5, tz).split('-').map(Number)
    const at = localToUtc(y, mo, d, h, m, tz)
    if (at > from) return at
  }
  return null
}

const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
export async function unsubToken(secret, userId) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64u(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`mail-unsub|${userId}`)))
}

export async function getMail(db, userId) {
  await ensureMailSchema(db)
  const r = await db.prepare('SELECT tz, h, m, on_ FROM mail_rem WHERE user_id = ?').bind(userId).first()
  return r ? { on: !!r.on_, h: r.h, m: r.m, tz: r.tz } : { ...MAIL_DEFAULT, tz: null }
}

export async function setMail(db, userId, body) {
  await ensureMailSchema(db)
  const p = cleanMail(body)
  const tz = validTz(body?.tz) ? body.tz : 'UTC'
  const at = p.on ? nextMailAt(p.h, p.m, tz) : null
  await db.prepare(`INSERT INTO mail_rem (user_id, tz, h, m, on_, next_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
    ON CONFLICT(user_id) DO UPDATE SET tz = ?2, h = ?3, m = ?4, on_ = ?5, next_at = ?6`).bind(userId, tz, p.h, p.m, p.on ? 1 : 0, at).run()
  return { ...p, tz, next: at }
}

export async function unsubscribe(db, userId) {
  await ensureMailSchema(db)
  await db.prepare('UPDATE mail_rem SET on_ = 0, next_at = NULL WHERE user_id = ?').bind(userId).run()
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

// What is still open today, from the synced document. null → nothing to say, send nothing.
export function digest(doc, today, origin, unsubUrl) {
  if (!doc) return null
  const items = []
  for (const k of ['workout', 'meals', 'streak']) {
    const m = message(k, doc, today)
    if (m) items.push({ title: m.title, body: m.body, url: origin + m.url })
  }
  const last = (doc.weightLog || []).reduce((a, w) => (w.date > a ? w.date : a), '')
  if (last && (Date.parse(today) - Date.parse(last)) / 864e5 >= 7) items.push({ title: 'Weekly weigh-in', body: 'One number a week keeps the plan honest.', url: origin + '/?tab=progress' })
  if (!items.length) return null
  const name = doc.settings?.name ? doc.settings.name.split(' ')[0] : ''
  const subject = items.length === 1 ? items[0].title : `${items.length} things left for today`
  const text = `${name ? name + ', here' : 'Here'} is what is still open today:\n\n${items.map(i => `- ${i.title}: ${i.body}\n  ${i.url}`).join('\n')}\n\nOpen BeetFit: ${origin}\n\nStop these emails: ${unsubUrl}\n`
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;color:#111"><p>${name ? esc(name) + ', here' : 'Here'} is what is still open today:</p>${items.map(i => `<p style="margin:14px 0"><a href="${esc(i.url)}" style="color:#111;font-weight:700;text-decoration:none">${esc(i.title)} →</a><br><span style="color:#555">${esc(i.body)}</span></p>`).join('')}<p style="margin-top:24px"><a href="${esc(origin)}" style="background:#e0fd90;color:#111;padding:10px 16px;text-decoration:none;font-weight:700;border-radius:6px">Open BeetFit</a></p><p style="color:#888;font-size:12px;margin-top:28px">You get one check-in a day at the time you chose, only when something is open. <a href="${esc(unsubUrl)}" style="color:#888">Stop these emails</a></p></div>`
  return { subject, text, html }
}

// Cron: send what came due. Resend errors leave the row alone for the next tick only when the send itself failed.
export async function runMail(env, now, { origin, accountOf, getDoc, fetchFn = fetch }) {
  if (!env.DB || !env.RESEND_API_KEY || !env.MAIL_FROM) return { due: 0, sent: 0 }
  const db = env.DB
  await ensureMailSchema(db)
  const { results } = await db.prepare('SELECT * FROM mail_rem WHERE on_ = 1 AND next_at IS NOT NULL AND next_at <= ? ORDER BY next_at LIMIT 100').bind(now).all()
  let sent = 0, quiet = 0
  for (const row of results) {
    const today = localDay(row.next_at, row.tz)
    let ok = true
    // Missed by over 2 h (paused Worker): skip today rather than send a morning email at night. One email a day at most.
    if (now - row.next_at < 2 * 3600e3 && row.last_day !== today) {
      const acct = await accountOf(db, row.user_id)
      const doc = await getDoc(db, row.user_id)
      const link = `${origin}/api/mail/unsub?u=${encodeURIComponent(row.user_id)}&t=${await unsubToken(env.DEVICE_SECRET, row.user_id)}`
      const d = acct?.email ? digest(doc, today, origin, link) : null
      if (d) {
        const r = await fetchFn('https://api.resend.com/emails', {
          method: 'POST',
          headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
          body: JSON.stringify({ from: env.MAIL_FROM, to: [acct.email], subject: d.subject, text: d.text, html: d.html, headers: { 'List-Unsubscribe': `<${link}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } })
        }).catch(() => null)
        ok = !!r?.ok
        if (ok) sent++
      } else quiet++
    }
    // A failed send keeps the row due so the next tick retries, until the 2 h window above closes.
    const nxt = ok ? nextMailAt(row.h, row.m, row.tz, Math.max(now, row.next_at) + 1000) : row.next_at
    await db.prepare('UPDATE mail_rem SET next_at = ?, last_day = CASE WHEN ? THEN ? ELSE last_day END WHERE user_id = ?').bind(nxt, ok && now - row.next_at < 2 * 3600e3 ? 1 : 0, today, row.user_id).run()
  }
  return { due: results.length, sent, quiet }
}
