// MediaPipe Pose Landmarker (Google, Apache-2.0). Free, no API key, runs on-device.
// The JS package is bundled by Vite (lazy chunk); WASM + model are fetched once and cached by the browser.
const VERSION = '1.1.1' // keep in sync with package.json
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`
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
    const files = await FilesetResolver.forVisionTasks(WASM_BASE)
    const opts = delegate => ({
      baseOptions: { modelAssetPath: MODELS[model], delegate },
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
