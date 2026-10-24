import { describe, it, expect } from 'vitest'
import { angleDeg, createRepEngine, createHoldEngine, formReport, readAngles } from './engine.js'
import { EXERCISES } from './exercises.js'

// Build 33 landmarks where joint triplet (a,b,c) forms `deg` at b. Others sit at the hip, visible.
function frame(cfg, deg, { visL = 1, visR = 1, degR = deg } = {}) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }))
  const put = (idx, d, v, ox) => {
    const [a, b, c] = idx
    const B = { x: 0.5 + ox, y: 0.6 }
    const C = { x: B.x, y: 0.9 }
    const r = ((180 - d) * Math.PI) / 180
    const A = { x: B.x + 0.3 * Math.sin(r), y: B.y - 0.3 * Math.cos(r) }
    lm[a] = { ...A, visibility: v }; lm[b] = { ...B, visibility: v }; lm[c] = { ...C, visibility: v }
  }
  put(cfg.joint.L, deg, visL, -0.05)
  put(cfg.joint.R, degR, visR, 0.05)
  return lm
}

// Drive an engine through a list of [angle, holdMs] keyframes at 30 fps.
function run(engine, cfg, keys, opts) {
  let t = 0
  const events = []
  for (const [deg, ms] of keys) {
    for (let e = 0; e < ms; e += 33) {
      const out = engine.update(frame(cfg, deg, opts), t)
      if (out.rep) events.push(out.rep)
      t += 33
    }
  }
  return events
}

const squatRep = [[170, 300], [140, 300], [95, 300], [85, 300], [140, 300], [170, 400]]

describe('angleDeg', () => {
  it('measures a right angle', () => {
    expect(Math.round(angleDeg({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 }))).toBe(90)
  })
  it('synthetic frame reproduces the requested angle', () => {
    const cfg = EXERCISES.squat
    const r = readAngles(cfg, frame(cfg, 97))
    expect(Math.round(r.angle)).toBe(97)
  })
})

describe('rep engine', () => {
  it('counts 3 squats', () => {
    const cfg = EXERCISES.squat
    const eng = createRepEngine(cfg)
    const reps = run(eng, cfg, [...squatRep, ...squatRep, ...squatRep])
    expect(reps).toHaveLength(3)
    expect(reps.every(r => r.full)).toBe(true)
    expect(reps[0].ecc).toBeGreaterThan(400)
  })

  it('ignores shallow dips that never cross the bottom threshold', () => {
    const cfg = EXERCISES.squat
    const eng = createRepEngine(cfg)
    expect(run(eng, cfg, [[170, 300], [120, 400], [170, 400], [118, 400], [170, 400]])).toHaveLength(0)
  })

  it('ignores single-frame jitter spikes', () => {
    const cfg = EXERCISES.squat
    const eng = createRepEngine(cfg)
    let t = 0, reps = 0
    for (let i = 0; i < 60; i++) {
      const deg = i % 15 === 7 ? 80 : 170 // one-frame spike every 0.5s
      if (eng.update(frame(cfg, deg), t).rep) reps++
      t += 33
    }
    expect(reps).toBe(0)
  })

  it('flags reps that miss target depth', () => {
    const cfg = EXERCISES.squat
    const eng = createRepEngine(cfg)
    const reps = run(eng, cfg, [[170, 300], [100, 500], [170, 500]])
    expect(reps).toHaveLength(1)
    expect(reps[0].full).toBe(false)
  })

  it('counts open-direction reps (glute bridge)', () => {
    const cfg = EXERCISES.bridge
    const eng = createRepEngine(cfg)
    const rep = [[130, 300], [160, 200], [172, 400], [150, 200], [130, 400]]
    expect(run(eng, cfg, [...rep, ...rep])).toHaveLength(2)
  })

  it('reads symmetry for face-on exercises', () => {
    const cfg = EXERCISES.curl
    const eng = createRepEngine(cfg)
    let t = 0, got
    const keys = [[160, 300], [40, 500], [160, 500]]
    for (const [deg, ms] of keys) for (let e = 0; e < ms; e += 33) {
      const out = eng.update(frame(cfg, deg, { degR: deg + 20 }), t); t += 33
      if (out.rep) got = out.rep
    }
    expect(got).toBeTruthy()
    expect(got.sym).toBeGreaterThanOrEqual(15)
  })

  it('reports out-of-frame when landmarks disappear', () => {
    const cfg = EXERCISES.squat
    const eng = createRepEngine(cfg)
    eng.update(frame(cfg, 170), 0)
    expect(eng.update(frame(cfg, 170, { visL: 0.1, visR: 0.1 }), 2000).inFrame).toBe(false)
  })
})

describe('hold engine', () => {
  it('times a wall sit only while in position, with grace', () => {
    const cfg = EXERCISES.wallsit
    const eng = createHoldEngine(cfg)
    let t = 0, out
    for (let i = 0; i < 30; i++) { out = eng.update(frame(cfg, 170), t); t += 100 } // standing 3s
    expect(out.heldMs).toBe(0)
    for (let i = 0; i < 50; i++) { out = eng.update(frame(cfg, 92), t); t += 100 } // sit 5s
    expect(out.heldMs).toBeGreaterThan(4000)
    expect(out.heldMs).toBeLessThan(5200)
  })
})

describe('formReport', () => {
  it('builds bars and observations', () => {
    const cfg = EXERCISES.squat
    const eng = createRepEngine(cfg)
    run(eng, cfg, [...squatRep, [170, 300], [100, 500], [170, 500]])
    const r = formReport(cfg, eng.history())
    expect(r.bars.map(b => b.label)).toEqual(['Depth', 'Tempo'])
    expect(r.bars[0].v).toBe(50)
    expect(r.notes[0]).toMatch(/rep 2 stopped/)
  })
})
