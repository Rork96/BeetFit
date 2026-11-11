import { describe, it, expect, beforeAll } from 'vitest'
import { d1 } from '../test/d1.js'
import worker, { issueToken } from './index.js'
import { parseRange, sniff, validKey } from './media.js'

// Minimal R2 stand-in: head / get (with range) / put / delete.
function r2() {
  const m = new Map()
  const meta = (k, v) => ({ key: k, size: v.buf.byteLength, httpEtag: '"e"', httpMetadata: v.http })
  return {
    m,
    async head(k) { const v = m.get(k); return v ? meta(k, v) : null },
    async get(k, o = {}) {
      const v = m.get(k); if (!v) return null
      const b = o.range ? v.buf.slice(o.range.offset, o.range.offset + o.range.length) : v.buf
      return { ...meta(k, v), body: new Uint8Array(b) }
    },
    async put(k, buf, o = {}) { m.set(k, { buf, http: o.httpMetadata }) },
    async delete(k) { m.delete(k) }
  }
}

const SECRET = 'media-test-secret-0123456789'
const env = { DEVICE_SECRET: SECRET, DB: d1(), MEDIA: r2() }
let A, B
const mp4 = n => { const b = new Uint8Array(n); b.set([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70], 0); for (let i = 8; i < n; i++) b[i] = i % 251; return b }
const req = (tok, path, method = 'GET', body, headers = {}) => worker.fetch(new Request('https://x' + path, {
  method, headers: { ...(tok ? { authorization: `Bearer ${tok}` } : {}), 'cf-connecting-ip': '7.7.7.7', ...headers }, body
}), env, {})

beforeAll(async () => { [A, B] = await Promise.all([issueToken(SECRET), issueToken(SECRET)]) })

describe('media helpers', () => {
  it('parses byte ranges', () => {
    expect(parseRange('bytes=0-1', 10)).toEqual({ start: 0, end: 1 })
    expect(parseRange('bytes=5-', 10)).toEqual({ start: 5, end: 9 })
    expect(parseRange('bytes=-3', 10)).toEqual({ start: 7, end: 9 })
    expect(parseRange('bytes=0-99', 10)).toEqual({ start: 0, end: 9 })
    expect(parseRange('bytes=20-', 10)).toEqual({ bad: true })
    expect(parseRange('', 10)).toBe(null)
  })
  it('sniffs mp4 and webm, rejects the rest', () => {
    expect(sniff(mp4(16).buffer)).toBe('mp4')
    expect(sniff(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0]).buffer)).toBe('webm')
    expect(sniff(new TextEncoder().encode('<html>hello</html>').buffer)).toBe(null)
  })
  it('accepts only generated keys', () => {
    expect(validKey('ex/abc-123/' + '0'.repeat(8) + '-0000-0000-0000-' + '0'.repeat(12) + '.mp4')).toBe(true)
    expect(validKey('ex/../secret.mp4')).toBe(false)
    expect(validKey('other/x/y.mp4')).toBe(false)
  })
})

describe('/api/media', () => {
  let key
  it('uploads a clip and returns its key', async () => {
    const r = await req(A, '/api/media', 'POST', mp4(2000), { 'content-type': 'video/mp4' })
    const j = await r.json()
    expect(r.status).toBe(200)
    expect(j.key).toMatch(/^ex\/[^/]+\/[0-9a-f-]{36}\.mp4$/)
    key = j.key
  })
  it('refuses wrong types, fake videos and no token', async () => {
    expect((await req(A, '/api/media', 'POST', mp4(100), { 'content-type': 'image/png' })).status).toBe(415)
    expect((await req(A, '/api/media', 'POST', new TextEncoder().encode('not a video at all'), { 'content-type': 'video/mp4' })).status).toBe(415)
    expect((await req(null, '/api/media', 'POST', mp4(100), { 'content-type': 'video/mp4' })).status).toBe(401)
  })
  it('refuses clips over 8 MB', async () => {
    expect((await req(A, '/api/media', 'POST', mp4(8 * 1024 * 1024 + 10), { 'content-type': 'video/mp4' })).status).toBe(413)
  })
  it('serves it publicly, whole and by range', async () => {
    const full = await req(null, '/api/media/' + key)
    expect(full.status).toBe(200)
    expect(full.headers.get('accept-ranges')).toBe('bytes')
    expect((await full.arrayBuffer()).byteLength).toBe(2000)
    const part = await req(null, '/api/media/' + key, 'GET', undefined, { range: 'bytes=0-99' })
    expect(part.status).toBe(206)
    expect(part.headers.get('content-range')).toBe('bytes 0-99/2000')
    expect((await part.arrayBuffer()).byteLength).toBe(100)
    expect((await req(null, '/api/media/' + key, 'GET', undefined, { range: 'bytes=5000-' })).status).toBe(416)
    expect((await req(null, '/api/media/ex/nobody/' + '1'.repeat(8) + '-1111-1111-1111-' + '1'.repeat(12) + '.mp4')).status).toBe(404)
  })
  it('only the owner can delete', async () => {
    expect((await req(B, '/api/media/' + key, 'DELETE')).status).toBe(403)
    expect((await req(A, '/api/media/' + key, 'DELETE')).status).toBe(200)
    expect((await req(null, '/api/media/' + key)).status).toBe(404)
  })
  it('says so when storage is off', async () => {
    const off = { ...env, MEDIA: undefined }
    const r = await worker.fetch(new Request('https://x/api/media', { method: 'POST', headers: { authorization: `Bearer ${A}`, 'content-type': 'video/mp4' }, body: mp4(100) }), off, {})
    expect(r.status).toBe(503)
    expect((await r.json()).error).toBe('media_not_configured')
  })
})
