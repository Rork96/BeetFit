// Side-view stick figure, driven by segment angles. The figure faces right.
// A pose is [shin, thigh, torso, upperArm, forearm, foot?]: each number is the direction of that segment
// (from its proximal joint to its distal one), in degrees from straight up, clockwise (towards the front).
//   standing, arms down: [0, 0, 0, 180, 180]      foot defaults to 90 (flat, toes forward)
// The chain is built from the ankle up: 0 = up, 90 = forward, 180 = down, -90 = back.
//
// spec = {
//   f:    [pose, ...]                key poses
//   pin:  'ankle' | 'toe' | 'hip' | 'wrist' | 'shoulder' | …  (a string, or one per frame)  the joint held still
//   at:   [[x, y], …]               where the pinned joint sits (default [0, 0]; one per frame or one for all)
//   y:    'floor' | 'pin'           floor = lowest point rests on the ground, pin = use at[1]
//   hand: { to:[x,y] } | { rel:[dx,dy] }   (per frame or one for all)  wrist target, elbow solved by IK
//   l2:   { to:[x,y], side }        second leg (the one behind), ankle target, knee solved by IK
//   arm2: [upperArm, forearm]       second arm, angles
//   hand2: { to:[x,y], side }       second arm by IK (wrist target), per frame or one for all
// Pose slots 6 and 7 are optional: spine bend (cm the back bulges up, negative = sags) and head direction (default: along the torso).
//   loop: 'pingpong' (default) | 'wrap'
// }

export const LEN = { foot: 9, shin: 24, thigh: 26, torso: 30, ua: 17, fa: 16, neck: 11 }
export const JOINTS = ['ankle', 'toe', 'knee', 'hip', 'shoulder', 'elbow', 'wrist', 'head']

const rad = d => (d * Math.PI) / 180
const dir = d => [Math.sin(rad(d)), Math.cos(rad(d))] // y up
const add = (p, q, l) => [p[0] + q[0] * l, p[1] + q[1] * l]
const lerp = (a, b, t) => a + (b - a) * t
const lerp2 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]
export const ease = t => t * t * (3 - 2 * t)

export function fk(pose) {
  const [shin, thigh, torso, ua, fa, foot = 90, arch = 0, headDir] = pose
  const ankle = [0, 0]
  const toe = add(ankle, dir(foot), LEN.foot)
  const knee = add(ankle, dir(shin), LEN.shin)
  const hip = add(knee, dir(thigh), LEN.thigh)
  const shoulder = add(hip, dir(torso), LEN.torso)
  const elbow = add(shoulder, dir(ua), LEN.ua)
  const wrist = add(elbow, dir(fa), LEN.fa)
  const head = add(shoulder, dir(headDir ?? torso), LEN.neck)
  return { ankle, toe, knee, hip, shoulder, elbow, wrist, head, arch: [arch, 0] }
}

// Two-bone IK: the middle joint for a chain from `a` to `target`. side +1/-1 picks which way it bends.
export function ik2(a, target, l1, l2, side = 1) {
  const dx = target[0] - a[0], dy = target[1] - a[1]
  const d = Math.min(Math.hypot(dx, dy) || 1e-6, l1 + l2 - 0.01)
  const k = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, l1 * l1 - k * k))
  const n = Math.hypot(dx, dy) || 1e-6
  return [a[0] + (dx / n) * k + side * (-dy / n) * h, a[1] + (dy / n) * k + side * (dx / n) * h]
}

// `at` is [x,y] or [[x,y],…]: tell them apart
const atOf = (spec, i) => {
  const a = spec.at
  if (!a) return [0, 0]
  return typeof a[0] === 'number' ? a : a[Math.min(i, a.length - 1)]
}
const strOf = (v, i, d) => (v == null ? d : Array.isArray(v) ? v[Math.min(i, v.length - 1)] : v)
const objOf = (v, i) => (v == null ? null : Array.isArray(v) ? v[Math.min(i, v.length - 1)] : v)

const FLOOR_FROM = ['ankle', 'toe', 'knee', 'hip', 'shoulder']

// Joints for pose values `vals`, positioned the way key frame `i` asks (pin / at / y / hand / l2 / arm2).
function place(spec, vals, i, ex) {
  const j = fk(vals)
  const pin = strOf(spec.pin, i, 'ankle')
  const at = atOf(spec, i)
  const ymode = strOf(spec.y, i, 'floor')
  const dx = at[0] - j[pin][0]
  const dy = ymode === 'pin' ? at[1] - j[pin][1] : -Math.min(...FLOOR_FROM.map(k => j[k][1]))
  for (const k of JOINTS) j[k] = [j[k][0] + dx, j[k][1] + dy]

  const hand = ex.hand
  if (hand) {
    const target = hand.to ? hand.to : [j.shoulder[0] + hand.rel[0], j.shoulder[1] + hand.rel[1]]
    j.elbow = ik2(j.shoulder, target, LEN.ua, LEN.fa, hand.side ?? 1)
    j.wrist = target
  }
  if (ex.l2) {
    j.ankle2 = ex.l2.to
    j.knee2 = ik2(j.hip, ex.l2.to, LEN.thigh, LEN.shin, ex.l2.side ?? 1)
    j.toe2 = [ex.l2.to[0] + LEN.foot * (ex.l2.up ? 0.55 : 1), ex.l2.to[1] + (ex.l2.up ? -4 : 0)]
  }
  if (ex.hand2) {
    const target2 = ex.hand2.to ? ex.hand2.to : [j.shoulder[0] + ex.hand2.rel[0], j.shoulder[1] + ex.hand2.rel[1]]
    j.elbow2 = ik2(j.shoulder, target2, LEN.ua, LEN.fa, ex.hand2.side ?? 1)
    j.wrist2 = target2
  }
  if (ex.arm2) {
    j.elbow2 = add(j.shoulder, dir(ex.arm2[0]), LEN.ua)
    j.wrist2 = add(j.elbow2, dir(ex.arm2[1]), LEN.fa)
  }
  return j
}

const mixObj = (a, b, t) => {
  if (!a && !b) return null
  if (!a || !b) return a || b
  const o = { ...a }
  if (a.to && b.to) o.to = lerp2(a.to, b.to, t)
  if (a.rel && b.rel) o.rel = lerp2(a.rel, b.rel, t)
  return o
}

// Between key frames i and k, t in [0,1].
export function poseBetween(spec, i, k, t) {
  const A = spec.f[i], B = spec.f[k]
  const vals = A.map((v, m) => lerp(v, B[m] ?? v, t))
  const ex = {
    hand: mixObj(objOf(spec.hand, i), objOf(spec.hand, k), t),
    l2: mixObj(objOf(spec.l2, i), objOf(spec.l2, k), t),
    hand2: mixObj(objOf(spec.hand2, i), objOf(spec.hand2, k), t),
    arm2: spec.arm2 ? (Array.isArray(spec.arm2[0]) ? lerp2(spec.arm2[i] || spec.arm2[0], spec.arm2[k] || spec.arm2[0], t) : spec.arm2) : null
  }
  const pa = place(spec, vals, i, ex)
  if (i === k) return pa
  const pb = place(spec, vals, k, ex)
  const out = {}
  for (const key of Object.keys(pa)) out[key] = pb[key] ? lerp2(pa[key], pb[key], t) : pa[key]
  return out
}

// The sequence of (from → to) legs one cycle plays through.
export function legs(spec) {
  const n = spec.f.length
  if (n === 1) return [[0, 0]]
  const out = []
  if (spec.loop === 'wrap') { for (let i = 0; i < n; i++) out.push([i, (i + 1) % n]) }
  else { for (let i = 0; i < n - 1; i++) out.push([i, i + 1]); for (let i = n - 1; i > 0; i--) out.push([i, i - 1]) }
  return out
}

export function keyJoints(spec, i) { return poseBetween(spec, i, i, 0) }

// Bounding box over every frame, so the picture never jumps.
export function bounds(spec) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9
  const grow = (x, y, r = 0) => { x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r); y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r) }
  for (const [a, b] of legs(spec)) {
    for (let s = 0; s <= 4; s++) {
      const j = poseBetween(spec, a, b, s / 4)
      for (const k of Object.keys(j)) grow(j[k][0], j[k][1], k === 'head' ? 7 : 1)
    }
  }
  return { x0, x1, y0, y1 }
}
