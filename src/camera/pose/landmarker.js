// MediaPipe Pose Landmarker (Google, Apache-2.0). Free, no API key, runs on-device.
// The JS package is bundled by Vite (lazy chunk). WASM + model are self-hosted under /mediapipe
// (scripts/fetch-mediapipe.mjs, cached by the service worker); the CDN is only a fallback.
const VERSION = '1.1.1' // keep in sync with package.json
const LOCAL = new URL('mediapipe/', document.baseURI).href
const CDN_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`
const MODELS = {
  lite: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  full: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task'
}

let pending = null

// One shared instance for the whole app: creating it costs ~1–3 s, so we keep it warm between sets.
export function loadPoseLandmarker(model = 'lite') {
  if (pending) return pending
  if (import.meta.env.DEV && /[?&]posemock/.test(location.search)) {
    pending = import('./mock.js').then(m => m.createMockLandmarker())
    return pending
  }
  pending = (async () => {
    const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision')
    // SPA fallback answers missing files with index.html (200), so check the type too.
    const local = await fetch(LOCAL + 'pose_landmarker_lite.task', { method: 'HEAD' })
      .then(r => r.ok && !(r.headers.get('content-type') || '').includes('text/html')).catch(() => false)
    const files = await FilesetResolver.forVisionTasks(local ? LOCAL + 'wasm' : CDN_WASM)
    const modelPath = local && model === 'lite' ? LOCAL + 'pose_landmarker_lite.task' : MODELS[model]
    const opts = delegate => ({
      baseOptions: { modelAssetPath: modelPath, delegate },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5
    })
    try {
      return await PoseLandmarker.createFromOptions(files, opts('GPU'))
    } catch {
      // Some Android WebViews have no usable WebGL2 — CPU is slower but works.
      return await PoseLandmarker.createFromOptions(files, opts('CPU'))
    }
  })()
  pending.catch(() => { pending = null }) // allow a retry after a network failure
  return pending
}

// Warm the model while the user reads the setup screen.
export function preloadPose() {
  loadPoseLandmarker().catch(() => {})
}
