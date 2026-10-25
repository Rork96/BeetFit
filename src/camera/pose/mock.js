// DEV ONLY (`npm run dev` + `?posemock`): a fake landmarker that animates a person squatting,
// so the tracker UI and auto-count can be demoed without anyone in front of the camera.
// Stripped from production builds by the import.meta.env.DEV guard in landmarker.js.
export function createMockLandmarker(period = 2600) {
  return {
    detectForVideo(_video, now) {
      const ph = (now % period) / period
      const knee = 170 - 85 * Math.sin(Math.PI * ph) ** 2 // 170° → 85° → 170°
      return { landmarks: [figure(knee)] }
    },
    close() {}
  }
}

function figure(kneeDeg) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.3, visibility: 0.2 }))
  const k = (180 - kneeDeg) * Math.PI / 180
  const set = (i, x, y) => { lm[i] = { x, y, visibility: 0.98 } }
  for (const [o, s, e, w, h, kn, a, foot] of [[-0.01, 11, 13, 15, 23, 25, 27, 31], [0.01, 12, 14, 16, 24, 26, 28, 32]]) {
    const ankle = { x: 0.5 + o, y: 0.86 }
    const knee = { x: ankle.x + 0.05 * Math.sin(k * 0.6), y: ankle.y - 0.2 }
    const hip = { x: knee.x - 0.2 * Math.sin(k), y: knee.y - 0.2 * Math.cos(k) }
    const lean = k * 0.45
    const sh = { x: hip.x + 0.24 * Math.sin(lean), y: hip.y - 0.24 * Math.cos(lean) }
    set(a, ankle.x, ankle.y); set(foot, ankle.x + 0.06, ankle.y + 0.01)
    set(kn, knee.x, knee.y); set(h, hip.x, hip.y); set(s, sh.x, sh.y)
    set(e, sh.x + 0.1, sh.y + 0.05); set(w, sh.x + 0.2, sh.y + 0.04)
  }
  set(0, lm[11].x + 0.02, lm[11].y - 0.08)
  return lm
}
