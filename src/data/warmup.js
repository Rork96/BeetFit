// Animations for the warm-up moves, keyed by the move name used in Warmup.jsx.
// Same pose format as howto.js (side view, see src/lib/pose2d.js) plus the `front2` view (src/lib/front2d.js).
import { HOWTO } from './howto.js'

const S = [0, 0, 0, 172, 168, 90]
const PLANK = [71.6, 71.6, 71.6, 180, 180, 150]

// Arms straight, going round the shoulder. Down → forward → up → back → down, then back the other way (ping-pong).
const circle = Array.from({ length: 25 }, (_, i) => { const a = 180 - i * 15; return [0, 0, 0, a, a, 90] })

// The swinging leg stays straight and sweeps an arc around the hip (hip at 50 cm, leg 49 cm).
const swing = Array.from({ length: 9 }, (_, i) => { const a = ((40 - i * 10) * Math.PI) / 180; return { to: [49 * Math.sin(a), 50 - 49 * Math.cos(a)], side: 1 } })

export const WARM_ANIM = {
  'Leg swings': {
    f: swing.map(() => S), pin: 'ankle', hl: ['thigh'], eq: ['wall@wrist'], wallX: 5, ms: 150, hold: 1,
    hand: { to: [22, 70], side: -1 },
    l2: swing
  },
  'Hip circles': { view: 'front2', hlF: 'hips', f: [[65, -50, 0, -14, 0], [65, -50, 0, 14, 0]], ms: 800, hold: 100 },
  'Bodyweight squats': HOWTO.bw_squat,
  'Glute bridges': HOWTO.glute_bridge,
  'Reverse lunges': {
    f: [[0, 0, 0, 172, 168, 90], [20, -70, 0, 172, 168, 90]], hl: ['thigh'], ms: 900,
    l2: [{ to: [-8, 0], side: 1 }, { to: [-45, 0], side: 1, up: true }]
  },
  'Jumping jacks': { view: 'front2', f: [[8, 8, 0, 0, 0], [168, 172, 15, 0, 5]], ms: 420, hold: 60 },
  'Arm circles': { f: circle, hl: ['ua', 'fa'], ms: 120, hold: 1 },
  'Shoulder taps': {
    f: [PLANK, PLANK], hl: ['ua'], ms: 520, hold: 220,
    hand: [{ rel: [0, -33], side: -1 }, { rel: [9, -3], side: -1 }],
    hand2: [{ rel: [9, -3], side: -1 }, { rel: [0, -33], side: -1 }]
  },
  'Scap push-ups': {
    // arms stay straight; only the chest sinks and rises between the shoulder blades (the back bends a little)
    f: [[71.6, 71.6, 71.6, 180, 180, 150, 4], [71.6, 71.6, 71.6, 180, 180, 150, -4]], hl: ['torso'], ms: 800, hold: 350,
    hand: { to: [75.9, 0], side: -1 }
  },
  'Cat-cow': {
    f: [[90, 0, 82, 180, 180, -90, -8, 35], [90, 0, 80, 180, 180, -90, 8, 150]], hl: ['torso'], ms: 1500, hold: 350,
    hand: { to: [54, 0], side: -1 }
  },
  'Wall slides': { view: 'front2', wallF: true, f: [[90, 180, 0, 0, 0], [158, 172, 0, 0, 0]], ms: 1400, hold: 300 },
  Inchworms: {
    f: [[0, 0, 0, 172, 168, 90], [8, -8, 158, 180, 180, 90], [4, -4, 125, 180, 180, 90], PLANK], hl: ['torso'], ms: 900, hold: 250,
    hand: [{ to: [1, 47], side: -1 }, { to: [14, 0], side: -1 }, { to: [40, 0], side: -1 }, { to: [75.9, 0], side: -1 }]
  },
  'Hip hinges': { f: [[0, 0, 0, 176, 172, 90], [6, -10, 70, 180, 180, 90]], hl: ['torso'], ms: 1300, hold: 300 }
}
