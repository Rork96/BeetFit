# FitTrack — Telegram Mini App (MVP)

React + Vite fitness Mini App: onboarding questionnaire, BMI avatar, calorie/macro targets, meal plan with swap, workout programs, camera rep tracker (MediaPipe Pose).

## Structure

```
src/
  App.jsx                  tabs + state persistence
  lib/calories.js          BMR (Mifflin-St Jeor), TDEE, target kcal, macros, BMI
  lib/store.js             localStorage + Telegram CloudStorage (chunked)
  data/meals.js            52-meal DB, day plan generator, swap logic
  data/workouts.js         3 programs (lose/maintain/gain) + tracker configs
  components/
    Onboarding.jsx         questionnaire
    ProfileTab.jsx         avatar, weight log, chart, daily targets
    Avatar.jsx             SVG body morphing by BMI (current vs target ghost)
    MealsTab.jsx           day plan, per-meal swap, totals
    WorkoutTab.jsx         program by goal, exercise log
    PoseTracker.jsx        MediaPipe PoseLandmarker rep counter (squat/curl/press)
```

## Run locally

```
npm install
npm run dev
```

Camera requires HTTPS or localhost.

## Deploy as Telegram Mini App

1. `npm run build` → deploy `dist/` to any static HTTPS host (Vercel/Netlify/GitHub Pages/Cloudflare Pages).
2. In @BotFather: `/newbot` (if no bot yet) → `/newapp` → attach the bot → set the Web App URL to your deployed URL.
3. Optional: `/setmenubutton` to open the app from the bot's menu button.

Requirements: HTTPS mandatory. Camera (getUserMedia) works in Telegram's in-app WebView on iOS/Android; user must grant camera permission.

## Pose tracker

- Model: `pose_landmarker_lite` loaded from Google CDN at runtime, inference on-device (GPU delegate).
- Rep logic: joint-angle state machine. Squat: hip-knee-ankle < 100° → > 160°. Curl: shoulder-elbow-wrist < 60° → > 150°. Press: same triplet, 100°/160°.
- Add exercises: extend `TRACKERS` in `src/data/workouts.js` (landmark indices + thresholds), set `trackerId` on the exercise.

## Known MVP limits

- Meal DB is static (52 items); portions scale ×0.6–1.6 to hit slot targets (25/35/30/10% split).
- Avatar is a parametric silhouette, not a body scan.
- Rep counter needs full body/limb in frame, decent light; counts one pose (best-visible side).
- No backend: all data on-device + Telegram CloudStorage.
