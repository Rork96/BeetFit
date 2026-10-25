// Prebuild: self-host MediaPipe so pose tracking works offline, in the native apps, and without a CDN.
//   public/mediapipe/wasm/*  ← copied from node_modules/@mediapipe/tasks-vision/wasm
//   public/mediapipe/pose_landmarker_lite.task ← downloaded once from Google (kept between builds)
// If the download fails the build still succeeds; the app then loads the model from Google at runtime.
import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public', 'mediapipe')
const src = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm')
const MODELS = ['lite', 'full'].map(m => [`pose_landmarker_${m}.task`, `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${m}/float16/1/pose_landmarker_${m}.task`])

await mkdir(join(out, 'wasm'), { recursive: true })
for (const f of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm']) {
  await copyFile(join(src, f), join(out, 'wasm', f))
}
console.log('mediapipe: wasm copied')

for (const [file, url] of MODELS) {
  const model = join(out, file)
  const have = await stat(model).then(s => s.size > 1e6).catch(() => false)
  if (have) { console.log(`mediapipe: ${file} present`); continue }
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error('HTTP ' + res.status)
    await writeFile(model, Buffer.from(await res.arrayBuffer()))
    console.log(`mediapipe: ${file} downloaded`)
  } catch (e) {
    console.warn(`mediapipe: ${file} download failed (${e.message}) — app will fetch it from Google at runtime`)
  }
}
