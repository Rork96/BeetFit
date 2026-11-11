// Demo clips: shrink a phone video on the device (first 8 s, ≤ 720p, no sound), then upload it.
// Re-encoding draws the video onto a canvas and records the canvas. It runs in real time, so 8 s take about 8 s.
// Where the browser can't record a canvas, a short file under 8 MB goes up as it is.
import { api } from './api.js'

export const CLIP_SECS = 8
export const CLIP_MAX = 8 * 1024 * 1024
const RAW_OK = ['video/mp4', 'video/quicktime', 'video/webm']

export const CLIP_ERR = {
  pro: 'Demo videos are part of PRO.',
  media_not_configured: 'Video storage isn’t switched on yet. The exercise saves without a clip.',
  too_big: 'That clip is over 8 MB. Record a shorter one.',
  bad_type: 'That file isn’t a video this app can play.',
  daily_limit: 'That’s 30 clips today. Try again tomorrow.',
  offline: 'No connection. Try again.',
  not_video: 'Pick a video file.',
  unreadable: 'Couldn’t open that video. Try recording it again.'
}

function recorderType() {
  if (typeof MediaRecorder === 'undefined') return null
  for (const t of ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']) {
    try { if (MediaRecorder.isTypeSupported(t)) return t } catch { /* ignore */ }
  }
  return null
}

function loadVideo(file) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video')
    v.muted = true; v.playsInline = true; v.preload = 'auto'
    v.setAttribute('playsinline', ''); v.setAttribute('muted', '')
    v.src = URL.createObjectURL(file)
    v.onloadedmetadata = () => resolve(v)
    v.onerror = () => reject(new Error('unreadable'))
    setTimeout(() => reject(new Error('unreadable')), 15000)
  })
}

export const fitSize = (w, h, long = 1280, shortSide = 720) => {
  const k = Math.min(1, long / Math.max(w, h), shortSide / Math.min(w, h))
  const even = n => Math.max(2, Math.round(n * k / 2) * 2)
  return { w: even(w), h: even(h) }
}

async function reencode(v, onProgress) {
  const type = recorderType()
  const canvas = document.createElement('canvas')
  if (!type || !canvas.captureStream) return null
  const { w, h } = fitSize(v.videoWidth || 720, v.videoHeight || 1280)
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  const limit = Math.min(CLIP_SECS, isFinite(v.duration) ? v.duration : CLIP_SECS)
  const rec = new MediaRecorder(canvas.captureStream(30), { mimeType: type, videoBitsPerSecond: 1_400_000 })
  const parts = []
  rec.ondataavailable = e => { if (e.data?.size) parts.push(e.data) }
  const stopped = new Promise(r => { rec.onstop = r })
  v.currentTime = 0
  await v.play()
  rec.start(250)
  await new Promise(resolve => {
    const tick = () => {
      ctx.drawImage(v, 0, 0, w, h)
      onProgress?.(Math.min(1, v.currentTime / limit))
      if (v.ended || v.currentTime >= limit) return resolve()
      if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(tick); else requestAnimationFrame(tick)
    }
    tick()
  })
  v.pause()
  rec.stop()
  await stopped
  const blob = new Blob(parts, { type: type.split(';')[0] })
  return blob.size > 1000 ? blob : null
}

// → { blob, type, secs, shrunk } or throws Error(code) with a CLIP_ERR code.
export async function prepClip(file, onProgress) {
  if (!file || !/^video\//.test(file.type || 'video/')) throw new Error('not_video')
  const v = await loadVideo(file)
  try {
    const secs = isFinite(v.duration) ? v.duration : null
    let blob = null
    try { blob = await reencode(v, onProgress) } catch { blob = null }
    if (blob) return { blob, type: blob.type, secs: Math.min(secs || CLIP_SECS, CLIP_SECS), shrunk: true }
    const type = RAW_OK.includes(file.type) ? file.type : 'video/mp4'
    if (file.size > CLIP_MAX) throw new Error('too_big')
    return { blob: file, type, secs, shrunk: false }
  } finally {
    URL.revokeObjectURL(v.src)
  }
}

export async function uploadClip(blob, type) {
  const r = await api('/api/media', { method: 'POST', body: blob, headers: { 'content-type': type } })
  if (r.key) return { key: r.key }
  return { error: r.error || 'offline' }
}

export function deleteClip(key) {
  if (key) api(`/api/media/${key}`, { method: 'DELETE' })
}
