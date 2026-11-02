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
