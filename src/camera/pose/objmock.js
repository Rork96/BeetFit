// DEV ONLY (`npm run dev` + `?objmock=toothbrush`): a fake detector that "sees" a cup at first, then the named object after ~2.5 s.
export function createMockDetector(label = 'cup') {
  const want = decodeURIComponent(label.replace(/\+/g, ' '))
  const t0 = performance.now()
  return {
    detectForVideo() {
      const label = performance.now() - t0 > 2500 ? want : 'chair'
      return { detections: [{ categories: [{ categoryName: label, score: 0.82 }], boundingBox: { originX: 120, originY: 160, width: 300, height: 260 } }] }
    },
    close() {}
  }
}
