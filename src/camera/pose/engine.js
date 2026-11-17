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

// ---- View detection + front-view signals ---------------------------------------------------
// Landmarks are normalised separately to image width and height, so x is scaled by the aspect
// ratio (width / height) before measuring distances.

const P = (lm, i, aspect) => ({ x: lm[i].x * aspect, y: lm[i].y, v: lm[i].visibility ?? 1 })
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

// 1 = facing the camera, 0 = side-on. Shoulder width vs. upper-arm length: ~1.5–2 face-on, ~0–0.5 side-on.
export function frontness(lm, aspect = 1) {
  const ls = P(lm, 11, aspect), rs = P(lm, 12, aspect), le = P(lm, 13, aspect), re = P(lm, 14, aspect)
  if (Math.min(ls.v, rs.v) < 0.4) return 0
  const upper = (dist(ls, le) + dist(rs, re)) / 2 || 1e-6
  return clamp01((dist(ls, rs) / upper - 0.5) / 0.7)
}

// Front-view signals, "close" direction (smaller = deeper). Units: % of a body segment, so the
// phone distance doesn't matter.
export const FRONT_SIGNALS = {
  // Push-up seen from the front: shoulders travel down toward the wrists.
  pushup(lm, aspect) {
    const sides = [[11, 15], [12, 16]].map(([s, w]) => [P(lm, s, aspect), P(lm, w, aspect)])
      .filter(([s, w]) => Math.min(s.v, w.v) >= 0.35)
    if (!sides.length) return null
    const sw = dist(P(lm, 11, aspect), P(lm, 12, aspect)) || 1e-6
    const d = sides.reduce((a, [s, w]) => a + (w.y - s.y), 0) / sides.length
    return { value: (d / sw) * 100, side: sides.length === 2 ? 'both' : 'L' }
  },
  // Squat seen from the front: hips drop toward the knees (thigh shortens on screen).
  squat(lm, aspect) {
    const sides = [[23, 25, 27], [24, 26, 28]].map(ix => ix.map(i => P(lm, i, aspect)))
      .filter(pts => Math.min(...pts.map(p => p.v)) >= 0.35)
    if (!sides.length) return null
    const r = sides.reduce((a, [h, k, an]) => a + (k.y - h.y) / (Math.abs(an.y - k.y) || 1e-6), 0) / sides.length
    return { value: r * 100, side: sides.length === 2 ? 'both' : 'L' }
  }
}

// Range progress 0..1 for the live bar: 0 at rest, 1 at full-range target.
export function rangeProgress(cfg, angle) {
  if (cfg.dir === 'open') return clamp01((angle - cfg.down + 10) / (cfg.target - cfg.down + 10))
  return clamp01((cfg.up - angle) / (cfg.up - cfg.target))
}

// Rep counter with two triggers, whichever fires first:
//  • fixed joint-angle thresholds from the exercise config (side view, angle signal)
//  • adaptive range: learned top/bottom of *this* person's movement; a rep is going down ≥ minRange
//    and coming back ≥ 70 % of that rep's depth. This keeps counting clean at odd camera angles.
// Front-facing push-ups/squats switch to a front-view signal automatically (both sides averaged).
export function createRepEngine(cfg) {
  let s
  const reset = () => {
    s = { phase: 'rest', smooth: null, mode: null, front: 0, pending: null, pendingAt: 0, reps: 0, lastSeen: -Infinity, lastT: null,
      hi: null, lo: null, repTop: null, repStart: 0, bottomAt: 0, extreme: null, extremeSym: null, extremeAlign: null,
      bestDepth: 0, history: [] }
  }
  reset()
  const minRange = mode => (mode === 'front' ? cfg.frontMinRange ?? 30 : cfg.minRange ?? 40)
  // Work = value goes down for "close", up for "open". Normalise to "close" by flipping open.
  const sign = mode => (mode === 'angle' && cfg.dir === 'open' ? -1 : 1)

  function read(lm, aspect) {
    if (!lm) return null
    if (cfg.front && FRONT_SIGNALS[cfg.front]) {
      s.front = s.front * 0.85 + frontness(lm, aspect) * 0.15
      if (s.front > 0.55) {
        const f = FRONT_SIGNALS[cfg.front](lm, aspect)
        if (f) return { mode: 'front', value: f.value, side: f.side, sym: null, align: null }
      }
    }
    const r = readAngles(cfg, lm)
    return r && { mode: 'angle', value: r.angle, side: r.side, sym: r.sym, align: r.align }
  }

  function update(lm, t, aspect = 1) {
    const r = read(lm, aspect)
    if (!r) {
      const inFrame = t - s.lastSeen < FRAME_LOSS_MS
      return { inFrame, reps: s.reps, phase: s.phase, angle: s.smooth, progress: 0, rep: null, view: s.mode }
    }
    if (r.mode !== s.mode) { // view changed: restart the learned range
      s.mode = r.mode; s.smooth = null; s.hi = s.lo = null; s.phase = 'rest'; s.pending = null; s.repStart = 0; s.extreme = null
    }
    const dt = s.lastT == null ? 0 : Math.min(200, t - s.lastT)
    s.lastT = t; s.lastSeen = t
    const k = r.mode === 'front' ? 0.35 : EMA
    s.smooth = s.smooth == null ? r.value : s.smooth + k * (r.value - s.smooth)
    const a = s.smooth
    const v = a * sign(r.mode) // normalised: smaller = deeper
    // Learned range with slow decay (8 units/s) so it adapts if the person moves.
    const decay = (dt / 1000) * 8
    s.hi = s.hi == null ? v : Math.max(v, s.hi - decay)
    s.lo = s.lo == null ? v : Math.min(v, s.lo + decay)
    const mr = minRange(r.mode)
    let rep = null

    if (s.phase === 'work' && (s.extreme == null || v < s.extreme)) {
      s.extreme = v; s.bottomAt = t; s.extremeSym = r.sym; s.extremeAlign = r.align
    }

    const angleMode = r.mode === 'angle'
    const fixedWork = angleMode && (cfg.dir === 'open' ? a > cfg.up : a < cfg.down)
    const fixedRest = angleMode && (cfg.dir === 'open' ? a < cfg.down : a > cfg.up)
    const adaptWork = s.hi - v >= mr
    const adaptRest = s.extreme != null && s.repTop != null && s.repTop - s.extreme >= mr && v >= s.extreme + 0.7 * (s.repTop - s.extreme)
    const atWork = fixedWork || adaptWork
    const atRest = fixedRest || adaptRest

    const want = s.phase === 'rest' ? (atWork ? 'work' : null) : (atRest ? 'rest' : null)
    if (want) {
      if (s.pending !== want) { s.pending = want; s.pendingAt = t }
      else if (t - s.pendingAt >= MIN_PHASE_MS) {
        if (want === 'work') {
          s.phase = 'work'; s.repTop = s.hi; s.extreme = v; s.bottomAt = t; s.extremeSym = r.sym; s.extremeAlign = r.align
          if (!s.repStart) s.repStart = s.pendingAt
        } else {
          s.phase = 'rest'
          const dur = t - s.repStart
          const depth = (s.repTop ?? v) - s.extreme
          if (dur >= MIN_REP_MS && depth >= mr * 0.8) {
            s.reps += 1
            s.bestDepth = Math.max(s.bestDepth, depth)
            const ext = s.extreme * sign(r.mode)
            rep = {
              n: s.reps, view: r.mode,
              extreme: Math.round(ext),
              ecc: Math.max(0, Math.round(s.bottomAt - s.repStart)),
              con: Math.max(0, Math.round(t - s.bottomAt)),
              sym: s.extremeSym == null ? null : Math.round(s.extremeSym),
              align: s.extremeAlign == null ? null : Math.round(s.extremeAlign),
              depth: Math.round(depth),
              full: angleMode
                ? (cfg.dir === 'open' ? ext >= cfg.target - 8 : ext <= cfg.target + 8)
                : depth >= 0.8 * s.bestDepth
            }
            s.history.push(rep)
          }
          s.repStart = 0; s.extreme = null; s.repTop = null
        }
        s.pending = null
      }
    } else {
      s.pending = null
    }
    if (s.phase === 'rest' && !s.repStart && s.hi - v > mr * 0.25) s.repStart = t

    const progress = angleMode ? rangeProgress(cfg, a) : clamp01((s.hi - v) / Math.max(mr * 1.6, s.bestDepth || 0))
    return { inFrame: true, reps: s.reps, phase: s.phase, angle: a, side: r.side, view: r.mode, progress, rep }
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
