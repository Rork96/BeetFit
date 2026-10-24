# BeetFit

Fitness web app (PWA) with an on-device camera coach. It runs on the web at https://beetfit.wealthifai.xyz and on iOS/Android through Capacitor. **Deploy steps: [DEPLOY.md](DEPLOY.md).**

Stack: React 18 + Vite, vite-plugin-pwa, Capacitor 8, one Cloudflare Worker (static assets + API), MediaPipe running on the device.

## Structure

```
src/
  App.jsx                 4 tabs (Today · Train · Food · Progress) + Settings; the back button closes overlays
  components/             TodayTab, WorkoutTab, MealsTab (search/scan/photo), ProfileTab (progress), Settings, Onboarding
  camera/                 RepTracker, FoodCamera, pose engine + exercises, barcode
  lib/                    day.js (every daily number), store.js (localStorage + native backup), platform.js (haptics/back),
                          api.js (device token), motion.js, voice.js, hooks.js
  styles/tokens.css       design tokens + motion grid
worker/src/index.js       API + static assets
scripts/                  fetch-mediapipe.mjs (prebuild), native-permissions.mjs
wrangler.toml             Worker config + custom domain
capacitor.config.json     native shell config
```

## Camera

| Feature | Runs where | Service | Cost |
|---|---|---|---|
| Rep counting + form check | on device | MediaPipe Pose Landmarker 1.1.1 (lite), self-hosted | free, no key |
| Barcode scan | on device | native `BarcodeDetector`, else the ZXing WASM ponyfill | free |
| Barcode → nutrition | Worker (cached 7 days) | Open Food Facts | free, no key |
| Food search | Worker | Open Food Facts + USDA FoodData Central | free (USDA key optional) |
| Meal photo → items | Worker | Gemini API free tier | needs a key |

- `src/camera/RepTracker.jsx` — frame check → 3-2-1 with a cue → auto count → done + RPE → form report → rest → up next → recap. Manual counting works at every stage.
- `src/camera/pose/engine.js` — pure rep/hold engine (EMA smoothing, hysteresis, minimum phase and rep times) plus the form report. Unit-tested.
- `src/camera/pose/exercises.js` — 9 trackable exercises: squat, push-up, lunge, bridge, RDL, curl, press, plank, wall sit.
- Dev demo without a person in frame: `npm run dev`, then open `/?posemock`.

## API auth

There are no accounts yet. On first use the Worker issues an HMAC-signed per-install token (`POST /api/device`). KV caps new tokens per IP and photos per device/IP per day. Real sign-in comes with cloud sync and coach mode.

## Design tokens

`src/styles/tokens.css` puts the Paulrork brand layer on top of the BeetFit dark shell: lime `#E0FD90`, electric blue `#303BFF`, violet `#7D70F6`, tight corners and square-in-square marks.
- Display font: **Unbounded** (OFL, self-hosted), the free stand-in for Ruberoid.
- Numerals: Space Grotesk (OFL), with tabular figures.
- Motion runs on a 128 BPM grid (`s16 = 117 ms`). Settings → Animation offers Auto/Full/Lite/Off, and Auto follows `prefers-reduced-motion`.

## Scripts

`npm run dev` · `npm test` · `npm run build` · `npm run deploy` · `npm run api:dev` · `npm run native:build` · `npm run ios` · `npm run android`
