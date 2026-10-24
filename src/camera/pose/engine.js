// Pure pose → rep/hold logic. No DOM, no MediaPipe: feed it landmarks + a timestamp.
// Unit-tested in engine.test.js with synthetic landmark streams.
import { clamp01 } from './exercises.js'

const VIS_MIN = 0.5      // landmark visibility to trust a joint
const EMA = 0.45         // smoothing factor for the angle (higher = more responsive)
const MIN_PHASE_MS = 140 // a phase must last this long before we accept the transition
const MIN_REP_MS = 450   // faster than this is jitter, not a rep
const FRAME_LOSS_MS = 700

export function angleDeg(a, b, c) {
  const v1x = a.x - b.x, v1y = a.y - b.y
  const v2x = c.x - b.x, v2y = c.y - b.y
  const m1 = Math.hypot(v1x, v1y), m2 = Math.hypot(v2x, v2y)
  if (!m1 || !m2) return 180
  const cos = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (m1 * m2)))
  return (Math.acos(cos) * 180) / Math.PI
}

const vis = (lm, idx) => Math.min(...idx.map(i => lm[i]?.visibility ?? 1))
const ang = (lm, idx) => angleDeg(lm[idx[0]], lm[idx[1]], lm[idx[2]])

// Read the configured joint angle from one frame. Returns null when the joints aren't visible.
export function readAngles(cfg, lm) {
  if (!lm) return null
  const vL = vis(lm, cfg.joint.L), vR = vis(lm, cfg.joint.R)
  const aL = ang(lm, cfg.joint.L), aR = ang(lm, cfg.joint.R)
  let angle, side, sym = null
  if (cfg.pick === 'both') {
    if (vL < VIS_MIN && vR < VIS_MIN) return null
    if (vL >= VIS_MIN && vR >= VIS_MIN) { angle = (aL + aR) / 2; sym = Math.abs(aL - aR); side = 'both' }
    else if (vL >= VIS_MIN) { angle = aL; side = 'L' } else { angle = aR; side = 'R' }
  } else if (cfg.pick === 'min') {
    if (Math.max(vL, vR) < VIS_MIN) return null
    if (vL >= VIS_MIN && vR >= VIS_MIN) { angle = Math.min(aL, aR); side = aL < aR ? 'L' : 'R' }
    else if (vL >= VIS_MIN) { angle = aL; side = 'L' } else { angle = aR; side = 'R' }
  } else {
    if (Math.max(vL, vR) < VIS_MIN) return null
    side = vL >= vR ? 'L' : 'R'
    angle = side === 'L' ? aL : aR
  }
  // Torso tilt from horizontal (0 = lying flat, 90 = upright) on the chosen side.
  const s = side === 'R' ? 12 : 11, h = side === 'R' ? 24 : 23
  const dx = (lm[s]?.x ?? 0) - (lm[h]?.x ?? 0), dy = (lm[s]?.y ?? 0) - (lm[h]?.y ?? 0)
  const torsoTilt = Math.abs((Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI)
  let align = null
  if (cfg.align) {
    const idx = side === 'R' ? cfg.align.joint.R : cfg.align.joint.L
    if (vis(lm, idx) >= VIS_MIN) align = ang(lm, idx)
  }
  return { angle, side, sym, torsoTilt, align }
}

// Range progress 0..1 for the live bar: 0 at rest, 1 at full-range target.
export function rangeProgress(cfg, angle) {
  if (cfg.dir === 'open') return clamp01((angle - cfg.down + 10) / (cfg.target - cfg.down + 10))
  return clamp01((cfg.up - angle) / (cfg.up - cfg.target))
}

export function createRepEngine(cfg) {
  let s
  const reset = () => {
    s = { phase: 'rest', smooth: null, pending: null, pendingAt: 0, reps: 0, lastSeen: -Infinity,
      repStart: 0, bottomAt: 0, extreme: null, extremeSym: null, extremeAlign: null, history: [] }
  }
  reset()

  const atRest = a => (cfg.dir === 'open' ? a < cfg.down : a > cfg.up)
  const atWork = a => (cfg.dir === 'open' ? a > cfg.up : a < cfg.down)
  const deeper = (a, b) => (cfg.dir === 'open' ? a > b : a < b)

  function update(lm, t) {
    const read = readAngles(cfg, lm)
    if (!read) {
      const inFrame = t - s.lastSeen < FRAME_LOSS_MS
      return { inFrame, reps: s.reps, phase: s.phase, angle: s.smooth, progress: 0, rep: null }
    }
    s.lastSeen = t
    s.smooth = s.smooth == null ? read.angle : s.smooth + EMA * (read.angle - s.smooth)
    const a = s.smooth
    let rep = null

    if (s.phase === 'work') {
      if (s.extreme == null || deeper(a, s.extreme)) {
        s.extreme = a; s.bottomAt = t; s.extremeSym = read.sym; s.extremeAlign = read.align
      }
    }

    const want = s.phase === 'rest' ? (atWork(a) ? 'work' : null) : (atRest(a) ? 'rest' : null)
    if (want) {
      if (s.pending !== want) { s.pending = want; s.pendingAt = t }
      else if (t - s.pendingAt >= MIN_PHASE_MS) {
        if (want === 'work') {
          s.phase = 'work'; s.extreme = a; s.bottomAt = t; s.extremeSym = read.sym; s.extremeAlign = read.align
          if (!s.repStart) s.repStart = s.pendingAt
        } else {
          s.phase = 'rest'
          const dur = t - s.repStart
          if (dur >= MIN_REP_MS) {
            s.reps += 1
            rep = {
              n: s.reps,
              extreme: Math.round(s.extreme),
              ecc: Math.max(0, Math.round(s.bottomAt - s.repStart)),
              con: Math.max(0, Math.round(t - s.bottomAt)),
              sym: s.extremeSym == null ? null : Math.round(s.extremeSym),
              align: s.extremeAlign == null ? null : Math.round(s.extremeAlign),
              full: !deeper(cfg.target, s.extreme) || Math.abs(s.extreme - cfg.target) <= 8
            }
            s.history.push(rep)
          }
          s.repStart = 0; s.extreme = null
        }
        s.pending = null
      }
    } else {
      s.pending = null
    }
    // The next rep starts timing when the user leaves the rest zone.
    if (s.phase === 'rest' && !s.repStart && !atRest(a)) s.repStart = t

    return { inFrame: true, reps: s.reps, phase: s.phase, angle: a, side: read.side,
      progress: rangeProgress(cfg, a), rep }
  }

  return { update, reset, get reps() { return s.reps }, history: () => s.history.slice() }
}

export function createHoldEngine(cfg) {
  let s
  const GRACE_MS = 800
  const reset = () => { s = { held: 0, last: null, inPos: false, outSince: null, smooth: null, lastSeen: -Infinity } }
  reset()

  function update(lm, t) {
    const dt = s.last == null ? 0 : Math.min(250, t - s.last)
    s.last = t
    const read = readAngles(cfg, lm)
    if (!read) {
      s.inPos = false
      return { inFrame: t - s.lastSeen < FRAME_LOSS_MS, inPos: false, heldMs: s.held, progress: 0 }
    }
    s.lastSeen = t
    s.smooth = s.smooth == null ? read.angle : s.smooth + EMA * (read.angle - s.smooth)
    const view = { ...read, angle: s.smooth }
    const ok = cfg.inPos(view)
    if (ok) { s.outSince = null; s.inPos = true }
    else if (s.inPos) {
      if (s.outSince == null) s.outSince = t
      if (t - s.outSince > GRACE_MS) s.inPos = false
    }
    if (s.inPos) s.held += dt
    return { inFrame: true, inPos: s.inPos, heldMs: Math.round(s.held), angle: s.smooth,
      progress: cfg.quality ? cfg.quality(view) : (ok ? 1 : 0) }
  }

  return { update, reset, get heldMs() { return s.held } }
}

// Turn a set's rep history into the "Form check" report: four 0–100 bars + plain observations.
// It reports what it measured; it never calls a rep right or wrong.
export function formReport(cfg, reps) {
  if (!reps.length) return { bars: [], notes: ['No full reps were detected. Try moving the phone back so your whole body is in frame.'] }
  const n = reps.length
  const fullN = reps.filter(r => r.full).length
  const depth = Math.round((fullN / n) * 100)

  const durs = reps.map(r => r.ecc + r.con)
  const mean = durs.reduce((a, b) => a + b, 0) / n
  const sd = Math.sqrt(durs.reduce((a, b) => a + (b - mean) ** 2, 0) / n)
  const tempo = Math.round(clamp01(1 - sd / Math.max(mean, 1) / 0.5) * 100)

  const syms = reps.map(r => r.sym).filter(v => v != null)
  const symmetry = syms.length ? Math.round(clamp01(1 - (syms.reduce((a, b) => a + b, 0) / syms.length) / 25) * 100) : null

  const aligns = reps.map(r => r.align).filter(v => v != null)
  let alignment = null
  if (cfg.align && aligns.length) {
    const ok = aligns.filter(v => v >= cfg.align.min).length
    alignment = Math.round((ok / aligns.length) * 100)
  }

  const color = v => (v >= 80 ? 'var(--ok)' : v >= 55 ? 'var(--warn)' : 'var(--danger)')
  const bars = [
    { label: 'Depth', v: depth },
    { label: 'Tempo', v: tempo },
    alignment != null && { label: cfg.align.label, v: alignment },
    symmetry != null && { label: 'Symmetry', v: symmetry }
  ].filter(Boolean).map(b => ({ ...b, color: color(b.v) }))

  const notes = []
  const shallow = reps.filter(r => !r.full).map(r => r.n)
  if (shallow.length) {
    const avgMiss = Math.round(reps.filter(r => !r.full).reduce((a, r) => a + Math.abs(r.extreme - cfg.target), 0) / shallow.length)
    notes.push(`Range: rep${shallow.length > 1 ? 's' : ''} ${shallow.join(', ')} stopped about ${avgMiss}° short of the target.`)
  } else notes.push(`Range: all ${n} reps reached the target range.`)
  const eccAvg = Math.round(reps.reduce((a, r) => a + r.ecc, 0) / n / 100) / 10
  const conAvg = Math.round(reps.reduce((a, r) => a + r.con, 0) / n / 100) / 10
  notes.push(`Tempo: about ${eccAvg}s on the way ${cfg.dir === 'open' ? 'up' : 'down'}, ${conAvg}s back.`)
  if (symmetry != null && symmetry < 80) notes.push('Left and right sides moved differently at the bottom of the rep.')
  if (alignment != null && alignment < 80) notes.push(`${cfg.align.label} moved outside the usual range on some reps.`)
  return { bars, notes }
}
