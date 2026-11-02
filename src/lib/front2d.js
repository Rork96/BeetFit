// Front view (facing the viewer) for moves the side view cannot show, like lateral raises.
// pose = [armAngle]: both arms from hanging (0) out to the sides (90), a little elbow bend.
const lerp = (a, b, t) => a + (b - a) * t
const rad = d => (d * Math.PI) / 180

export const FRONT_BOX = { x0: -42, x1: 42, y0: 0, y1: 96 }

export function solveFront(spec, a, b, t) {
  const ang = lerp(spec.f[a][0], spec.f[b][0], t)
  const side = s => {
    const sh = [s * 10, 80]
    const up = [Math.sin(rad(ang)) * s, -Math.cos(rad(ang))]
    const el = [sh[0] + up[0] * 17, sh[1] + up[1] * 17]
    const bend = ang * 0.9
    const wr = [el[0] + Math.sin(rad(bend)) * s * 16, el[1] - Math.cos(rad(bend)) * 16]
    return { sh, el, wr }
  }
  const L = side(-1), R = side(1)
  return {
    head: [0, 91], neck: [0, 80], hipC: [0, 50], hipL: [-6, 50], hipR: [6, 50],
    kneeL: [-7, 25], kneeR: [7, 25], ankleL: [-8, 0], ankleR: [8, 0],
    shL: L.sh, shR: R.sh, elL: L.el, elR: R.el, wrL: L.wr, wrR: R.wr
  }
}

// Front view with legs and both arms, for jumping jacks, arm and hip moves, wall slides.
// pose = [upperArm, forearm, legSpread, hipShift, jump]
//   arm angles: 0 hanging down, 90 straight out to the side, 180 straight up (both arms mirror each other)
//   legSpread: cm each foot sits out from hip-width.  hipShift: pelvis sways sideways.  jump: whole body lifts.
export function solveFront2(spec, a, b, t) {
  const m = i => lerp(spec.f[a][i] ?? 0, spec.f[b][i] ?? 0, t)
  const ua = m(0), fa = m(1), spread = m(2), shift = m(3), jump = m(4)
  const arm = s => {
    const sh = [s * 10, 80 + jump]
    const el = [sh[0] + Math.sin(rad(ua)) * s * 17, sh[1] - Math.cos(rad(ua)) * 17]
    const wr = [el[0] + Math.sin(rad(fa)) * s * 16, el[1] - Math.cos(rad(fa)) * 16]
    return { sh, el, wr }
  }
  const L = arm(-1), R = arm(1)
  const hip = (s) => [shift + s * 6, 50 + jump]
  const ank = s => [s * (8 + spread), jump]
  const knee = s => { const h = hip(s), an = ank(s); return [(h[0] + an[0]) / 2 + s * 1.5, (h[1] + an[1]) / 2] }
  return {
    head: [0, 91 + jump], neck: [0, 80 + jump], hipC: [shift, 50 + jump], hipL: hip(-1), hipR: hip(1),
    kneeL: knee(-1), kneeR: knee(1), ankleL: ank(-1), ankleR: ank(1),
    shL: L.sh, shR: R.sh, elL: L.el, elR: R.el, wrL: L.wr, wrR: R.wr
  }
}
