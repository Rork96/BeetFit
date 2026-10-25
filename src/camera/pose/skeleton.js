// Canvas overlay: body lines, joints, and the tracked angle drawn as an arc at the working joint.
const BONES = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32]
]

export function drawSkeleton(canvas, video, lm, { cfg, side, progress = 0, accent = '#E0FD90' } = {}) {
  if (!canvas || !video) return
  const w = video.videoWidth, h = video.videoHeight
  if (!w || !h) return
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, w, h)
  if (!lm) return
  const P = i => ({ x: lm[i].x * w, y: lm[i].y * h, v: lm[i].visibility ?? 1 })
  const unit = Math.max(2, Math.round(Math.min(w, h) / 160))

  ctx.lineCap = 'round'
  ctx.strokeStyle = 'rgba(255,255,255,.55)'
  ctx.lineWidth = unit
  for (const [a, b] of BONES) {
    const A = P(a), B = P(b)
    if (A.v < 0.4 || B.v < 0.4) continue
    ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke()
  }

  // Working triplet in accent, thicker.
  if (cfg) {
    const sides = side === 'both' ? ['L', 'R'] : [side === 'R' ? 'R' : 'L']
    for (const sd of sides) {
      const [a, b, c] = cfg.joint[sd].map(P)
      if (Math.min(a.v, b.v) < 0.3) continue
      ctx.strokeStyle = accent
      ctx.lineWidth = unit * 2.2
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y)
      if (c.v >= 0.3) ctx.lineTo(c.x, c.y)
      ctx.stroke()
      if (c.v < 0.3) continue
      // Angle arc: fills as the rep approaches full range.
      const r = unit * 11
      const a1 = Math.atan2(a.y - b.y, a.x - b.x), a2 = Math.atan2(c.y - b.y, c.x - b.x)
      let d = a2 - a1
      while (d > Math.PI) d -= 2 * Math.PI
      while (d < -Math.PI) d += 2 * Math.PI
      ctx.fillStyle = `rgba(224,253,144,${0.12 + 0.38 * progress})`
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.arc(b.x, b.y, r, a1, a1 + d, d < 0); ctx.closePath(); ctx.fill()
      // Square joints — the brand's square-in-square mark.
      for (const p of [a, b, c]) {
        const s = unit * 3.2
        ctx.fillStyle = accent; ctx.fillRect(p.x - s, p.y - s, s * 2, s * 2)
        ctx.fillStyle = '#1D1D1D'; ctx.fillRect(p.x - s / 2.4, p.y - s / 2.4, s / 1.2, s / 1.2)
      }
    }
  }
}
