// Exercise demo clips (R2 binding MEDIA).
//   POST   /api/media            video body (mp4 / webm / quicktime, ≤ 8 MB) → { key }   needs a device token
//   DELETE /api/media/<key>      only the owner (same user, or same device when not synced)
//   GET    /api/media/<key>      public: <video src> can't send a token. Keys hold a random UUID, so they can't be guessed.
// Range requests are answered with 206: Safari won't play a video without them.

export const MAX_CLIP = 8 * 1024 * 1024
export const CLIP_DAILY_LIMIT = 30
const TYPES = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' }
const KEY_RE = /^ex\/[A-Za-z0-9_-]{6,64}\/[0-9a-f-]{36}\.(mp4|webm|mov)$/

export const validKey = k => KEY_RE.test(k || '')
const ownerOf = k => k.split('/')[1]

// mp4 / mov: "ftyp" at byte 4. webm: EBML magic 1A 45 DF A3.
export function sniff(buf) {
  const b = new Uint8Array(buf.slice(0, 12))
  if (b.length >= 8 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return 'mp4'
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'webm'
  return null
}

export function parseRange(h, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(h || '')
  if (!m || (m[1] === '' && m[2] === '')) return null
  let start, end
  if (m[1] === '') { const n = +m[2]; start = Math.max(0, size - n); end = size - 1 } // suffix: last n bytes
  else { start = +m[1]; end = m[2] === '' ? size - 1 : Math.min(+m[2], size - 1) }
  if (start > end || start >= size) return { bad: true }
  return { start, end }
}

export async function serveMedia(req, env, key, cors = {}) {
  if (!env.MEDIA) return new Response('not configured', { status: 503, headers: cors })
  if (!validKey(key)) return new Response('not found', { status: 404, headers: cors })
  const head = await env.MEDIA.head(key)
  if (!head) return new Response('not found', { status: 404, headers: cors })
  const size = head.size
  const base = {
    ...cors,
    'content-type': head.httpMetadata?.contentType || 'video/mp4',
    'accept-ranges': 'bytes',
    'cache-control': 'public, max-age=31536000, immutable',
    etag: head.httpEtag
  }
  const r = parseRange(req.headers.get('range'), size)
  if (r?.bad) return new Response(null, { status: 416, headers: { ...base, 'content-range': `bytes */${size}` } })
  if (req.method === 'HEAD') return new Response(null, { status: 200, headers: { ...base, 'content-length': String(size) } })
  if (r) {
    const obj = await env.MEDIA.get(key, { range: { offset: r.start, length: r.end - r.start + 1 } })
    return new Response(obj.body, { status: 206, headers: { ...base, 'content-length': String(r.end - r.start + 1), 'content-range': `bytes ${r.start}-${r.end}/${size}` } })
  }
  const obj = await env.MEDIA.get(key)
  return new Response(obj.body, { status: 200, headers: { ...base, 'content-length': String(size) } })
}

// owner: the synced user id, or "d-<device id>" before sync. tier: { pro }. under: (key, max) → Promise<boolean>.
export async function mediaRoutes(req, url, env, { owner, pro, under, json, cors }) {
  if (!env.MEDIA) return json({ error: 'media_not_configured' }, 503, cors)
  if (url.pathname === '/api/media' && req.method === 'POST') {
    if (!pro) return json({ error: 'pro' }, 402, cors)
    const type = (req.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    if (!TYPES[type]) return json({ error: 'bad_type' }, 415, cors)
    const len = +req.headers.get('content-length') || 0
    if (len > MAX_CLIP) return json({ error: 'too_big', max: MAX_CLIP }, 413, cors)
    const buf = await req.arrayBuffer()
    if (!buf.byteLength) return json({ error: 'empty' }, 400, cors)
    if (buf.byteLength > MAX_CLIP) return json({ error: 'too_big', max: MAX_CLIP }, 413, cors)
    if (!sniff(buf)) return json({ error: 'bad_type' }, 415, cors)
    if (!(await under(`clip:${owner}`, CLIP_DAILY_LIMIT))) return json({ error: 'daily_limit', limit: CLIP_DAILY_LIMIT }, 429, cors)
    const key = `ex/${owner}/${crypto.randomUUID()}.${TYPES[type]}`
    await env.MEDIA.put(key, buf, { httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' }, customMetadata: { owner } })
    return json({ key, bytes: buf.byteLength }, 200, cors)
  }
  const m = url.pathname.match(/^\/api\/media\/(.+)$/)
  if (m && req.method === 'DELETE') {
    const key = decodeURIComponent(m[1])
    if (!validKey(key)) return json({ error: 'not_found' }, 404, cors)
    if (ownerOf(key) !== owner) return json({ error: 'not_owner' }, 403, cors)
    await env.MEDIA.delete(key)
    return json({ ok: true }, 200, cors)
  }
  return json({ error: 'not_found' }, 404, cors)
}
