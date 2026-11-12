import { describe, it, expect } from 'vitest'
import { LIB } from '../data/library.js'
import { HOWTO } from '../data/howto.js'
import { poseBetween, legs, bounds, LEN } from './pose2d.js'
import { solveFront } from './front2d.js'

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])

describe('how-to data', () => {
  it('covers every exercise in the library', () => {
    for (const L of LIB) expect(HOWTO[L.id], L.id).toBeTruthy()
    for (const id of Object.keys(HOWTO)) expect(LIB.some(l => l.id === id), 'unknown id ' + id).toBe(true)
  })

  it('every entry has steps, a feel line, mistakes and breathing, with valid frame references', () => {
    for (const [id, H] of Object.entries(HOWTO)) {
      expect(H.f.length, id).toBeGreaterThanOrEqual(1)
      expect(H.steps.length, id).toBeGreaterThanOrEqual(3)
      for (const s of H.steps) { expect(s.t.length, id).toBeGreaterThan(10); expect(s.f, id).toBeLessThan(H.f.length); expect(s.f).toBeGreaterThanOrEqual(0) }
      expect(H.feel, id).toBeTruthy()
      expect(H.breath, id).toBeTruthy()
      expect(H.err.length, id).toBeGreaterThanOrEqual(2)
      for (const [bad, fix] of H.err) { expect(bad).toBeTruthy(); expect(fix).toBeTruthy() }
      for (const k of ['easy', 'hard']) if (H[k]) expect(LIB.some(l => l.id === H[k]), `${id}.${k}`).toBe(true)
    }
  })

  it('every frame solves to finite joints; limb lengths stay rigid; the figure rests on the floor', () => {
    for (const [id, H] of Object.entries(HOWTO)) {
      if (H.view === 'front') { for (let i = 0; i < H.f.length; i++) for (const p of Object.values(solveFront(H, i, i, 0))) expect(p.every(Number.isFinite), id).toBe(true); continue }
      for (const [a, b] of legs(H)) {
        for (const t of [0, 0.5, 1]) {
          const j = poseBetween(H, a, b, t)
          for (const [k, p] of Object.entries(j)) expect(p.every(Number.isFinite), `${id} ${k}`).toBe(true)
          // keyframes are exact; in-between frames bend by angle, so lengths hold there too (IK limbs are clamped to reach)
          if (t === 0) {
            expect(dist(j.knee, j.ankle), id).toBeCloseTo(LEN.shin, 4)
            expect(dist(j.hip, j.knee), id).toBeCloseTo(LEN.thigh, 4)
            expect(dist(j.shoulder, j.hip), id).toBeCloseTo(LEN.torso, 4)
            if (j.knee2) expect(Math.abs(dist(j.hip, j.knee2) - LEN.thigh), `${id} thigh2`).toBeLessThan(0.05)
            if (!H.hand) { expect(dist(j.shoulder, j.elbow)).toBeCloseTo(LEN.ua, 4) }
            else expect(Math.abs(dist(j.shoulder, j.elbow) - LEN.ua), `${id} upper arm`).toBeLessThan(0.05)
          }
          // standing / floor frames: nothing sinks below the ground line (a small head dip on lying moves is fine)
          if (H.y !== 'pin' && !(Array.isArray(H.y))) for (const k of ['ankle', 'toe', 'knee', 'hip', 'shoulder']) expect(j[k][1], `${id} ${k}`).toBeGreaterThanOrEqual(-0.01)
        }
      }
    }
  })

  it('floor exercises keep their hands planted: the wrist does not drift between frames', () => {
    for (const id of ['pushup', 'pike_pushup', 'mtn_climb']) {
      const H = HOWTO[id]
      const xs = H.f.map((_, i) => poseBetween(H, i, i, 0).wrist)
      for (const w of xs) { expect(Math.abs(w[0] - xs[0][0]), id).toBeLessThan(0.01); expect(Math.abs(w[1]), id).toBeLessThan(0.01) }
    }
  })

  it('bounds are sane (a figure fits roughly in a person-sized box)', () => {
    for (const [id, H] of Object.entries(HOWTO)) {
      if (H.view === 'front') continue
      const b = bounds(H)
      expect(b.x1 - b.x0, id).toBeLessThan(160)
      expect(b.y1 - b.y0, id).toBeLessThan(170)
    }
  })
})

import { WARM_ANIM } from '../data/warmup.js'
import { ROUTINES } from '../components/Warmup.jsx'
import { solveFront2 } from './front2d.js'

describe('warm-up animations', () => {
  const names = [...new Set(Object.values(ROUTINES).flatMap(r => r.moves.map(m => m[0])))]
  it('every warm-up move has an animation', () => {
    for (const n of names) expect(WARM_ANIM[n], n).toBeTruthy()
  })
  it('every frame solves to finite joints and fits in a person-sized box', () => {
    for (const [n, H] of Object.entries(WARM_ANIM)) {
      if (H.view === 'front2') { for (let i = 0; i < H.f.length; i++) for (const t of [0, 0.5, 1]) for (const p of Object.values(solveFront2(H, i, i, t))) expect(p.every(Number.isFinite), n).toBe(true); continue }
      for (const [a, b] of legs(H)) for (const t of [0, 0.5, 1]) for (const [k, p] of Object.entries(poseBetween(H, a, b, t))) expect(p.every(Number.isFinite), `${n} ${k}`).toBe(true)
      const bb = bounds(H)
      expect(bb.x1 - bb.x0, n).toBeLessThan(170)
      expect(bb.y1 - bb.y0, n).toBeLessThan(170)
    }
  })
  it('hands stay on the floor when a move is a floor move', () => {
    for (const n of ['Scap push-ups', 'Cat-cow']) {
      const H = WARM_ANIM[n]
      for (let i = 0; i < H.f.length; i++) expect(Math.abs(poseBetween(H, i, i, 0).wrist[1]), n).toBeLessThan(0.01)
    }
  })
  it('arm circles go all the way round', () => {
    const H = WARM_ANIM['Arm circles']
    const ws = H.f.map((_, i) => poseBetween(H, i, i, 0).wrist)
    expect(Math.max(...ws.map(w => w[1])) - Math.min(...ws.map(w => w[1]))).toBeGreaterThan(60)
  })
})
