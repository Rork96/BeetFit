// Run after `npx cap add ios` / `npx cap add android`: adds the camera permission text the stores require.
import { readFile, writeFile } from 'node:fs/promises'

const CAMERA_TEXT = 'BeetFit uses the camera to count your reps, check your form and scan food barcodes. Video stays on your device.'

async function patch(path, fn) {
  let s
  try { s = await readFile(path, 'utf8') } catch { console.log(`skip ${path} (platform not added)`); return }
  const next = fn(s)
  if (next !== s) { await writeFile(path, next); console.log(`patched ${path}`) } else console.log(`ok ${path}`)
}

await patch('ios/App/App/Info.plist', s => s.includes('NSCameraUsageDescription') ? s
  : s.replace(/<dict>/, `<dict>\n\t<key>NSCameraUsageDescription</key>\n\t<string>${CAMERA_TEXT}</string>`))

await patch('android/app/src/main/AndroidManifest.xml', s => s.includes('android.permission.CAMERA') ? s
  : s.replace(/<application/, `<uses-permission android:name="android.permission.CAMERA" />\n    <uses-feature android:name="android.hardware.camera" android:required="false" />\n\n    <application`))
