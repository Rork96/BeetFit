// MediaPipe Object Detector (EfficientDet-Lite0, COCO classes). On-device, no key, same WASM as the pose tracker.
// The model file is self-hosted under /mediapipe (scripts/fetch-mediapipe.mjs, cached by the service worker); Google's CDN is the fallback.
const VERSION = '1.1.1' // keep in sync with package.json
const LOCAL = new URL('mediapipe/', document.baseURI).href
const CDN_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`
const FILE = 'efficientdet_lite0.tflite'
const REMOTE = `https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/${FILE}`

// DEV only: `?objmock=<label>` is read once at load, before the app tidies the address bar.
const MOCK = import.meta.env.DEV ? (location.search.match(/[?&]objmock=([\w%+ -]+)/) || [])[1] || null : null

let pending = null

export function loadObjectDetector() {
  if (pending) return pending
  if (MOCK) {
    pending = import('./objmock.js').then(m => m.createMockDetector(MOCK))
    return pending
  }
  pending = (async () => {
    const { FilesetResolver, ObjectDetector } = await import('@mediapipe/tasks-vision')
    const local = await fetch(LOCAL + FILE, { method: 'HEAD' })
      .then(r => r.ok && !(r.headers.get('content-type') || '').includes('text/html')).catch(() => false)
    const files = await FilesetResolver.forVisionTasks(local ? LOCAL + 'wasm' : CDN_WASM)
    const opts = delegate => ({ baseOptions: { modelAssetPath: local ? LOCAL + FILE : REMOTE, delegate }, runningMode: 'VIDEO', scoreThreshold: 0.3, maxResults: 8 })
    try { return await ObjectDetector.createFromOptions(files, opts('GPU')) } catch { return await ObjectDetector.createFromOptions(files, opts('CPU')) }
  })()
  pending.catch(() => { pending = null })
  return pending
}

export const preloadObjects = () => { loadObjectDetector().catch(() => {}) }

// [{ label, score }] for one video frame, best first.
export function detect(detector, video, now) {
  const r = detector.detectForVideo(video, now)
  return (r?.detections || []).map(d => ({ label: d.categories?.[0]?.categoryName, score: d.categories?.[0]?.score || 0 })).filter(d => d.label).sort((a, b) => b.score - a.score)
}
