# BeetFit

Fitness PWA: a personal plan, food logging, an on-device camera that counts reps, Beet (an AI assistant that knows your plan and log), and a coach mode. Runs on the web at https://beetfit.wealthifai.xyz and on iOS/Android through Capacitor. **Deploy steps: [DEPLOY.md](DEPLOY.md). Coach and paywall flows: [docs/coach-flows.md](docs/coach-flows.md).**

Stack: React 18 + Vite, vite-plugin-pwa, motion, Capacitor 8, one Cloudflare Worker (static assets + API) with D1 (sync, accounts, coach, billing) and KV (rate limits), MediaPipe on the device, Gemini for photos and Beet, Stripe for web payments.

## What the app does

| Area | Where | What |
|---|---|---|
| Onboarding | `Onboarding.jsx` | Goal, body, days, kit → calories, macros, training plan, pace. Welcome offers sign-in, a coach code, or "I coach people". The free-trial paywall shows once after the plan. |
| Today | `TodayTab.jsx` | One "Next up" card (`nextUp()` in `lib/day.js`: by time of day: a scheduled workout wins from 90 min before, otherwise train from 10:00 and not after 21:00 → first meal → weekly weigh-in → water → done), calories ring, week and streak, Beet card. |
| Train | `WorkoutTab.jsx`, `Session.jsx`, `Warmup.jsx`, `PlanReview.jsx` | AI review of your plan (`/api/program/review`): a read specific to your answers plus up to 3 swaps you accept one by one; Plan, session with camera rep counting, warm-up with animated moves, exercise how-to animations (`lib/pose2d.js`). |
| Food | `MealsTab.jsx`, `FoodHistory.jsx` | Search, barcode, meal photo, quick add; meal ideas (not counted as eaten until logged); 30-day history and re-log. |
| Beet | `Beet.jsx` | Chat tab. Sees plan, targets, today's log, recent weights, check-ins, pain reports. Not a doctor. |
| Progress | `ProgressTab.jsx`, `Calendar.jsx` | Weight, strength trends, calendar plans. |
| Coach mode | `Coach.jsx` | Client joins with a 6-character code; coach sees logs and check-ins, messages, sets targets. Free for 3 clients, PRO 200. |
| PRO | `Pro.jsx`, `lib/billing.js` | 14-day no-card trial, monthly or yearly. Free: 3 photo estimates and 5 Beet questions a day, 3 coach clients. PRO: 30 / 60 / 200. |
| Sync and accounts | `Account.jsx`, `lib/sync.js` | Email code, Google, Apple; cross-device sync; pairing codes. |
| Reminders | `lib/push.js`, `worker/src/reminders.js`, `worker/src/mailrem.js` | Web Push, 15-minute cron: meals, workout, water, weigh-in, streak, coach messages. Email check-in: one a day at your time, only when something is open, signed-in accounts only, one-click unsubscribe. |

## Structure

```
src/
  App.jsx                 5 tabs (Today · Train · Food · Beet · Progress), Settings, overlays; back button closes overlays
  components/             one file per screen or card (+ its .css)
  camera/                 RepTracker, FoodCamera, pose engine + exercises, barcode
  data/                   plan library, how-to, warm-up, guides, meal ideas, sauces
  lib/                    day.js (every daily number), store.js, api.js (device token), billing.js (+ usage meters),
                          coach.js, useCoach/usePro/useSync/useAccount hooks, pose2d.js, program.js, platform.js
  styles/tokens.css       design tokens + motion grid
worker/src/
  index.js                API + static assets
  auth.js billing.js reminders.js webpush.js   accounts, Stripe/RevenueCat, reminder schedule, Web Push
  review.js mailrem.js                          AI plan review (validated swaps), daily email check-in
scripts/                  fetch-mediapipe.mjs (prebuild), native-permissions.mjs, vapid.mjs
docs/coach-flows.md       coach/client flows, limits, navigation and paywall decisions
wrangler.toml             Worker config, custom domain, cron
capacitor.config.json     native shell config
```

## API

All under `worker/src/index.js`. Everything except `/api/health`, `/api/device` and webhooks needs `Authorization: Bearer <device token>`.

| Route | Purpose |
|---|---|
| `POST /api/device` | Issue an HMAC-signed per-install token (no account needed) |
| `GET /api/health` | Which features are configured (`auth.email`, `billing.web`, `billing.webhook`, gemini, usda, kv) |
| `GET /api/food/barcode/:code`, `/api/food/search?q=` | Open Food Facts (+ USDA when keyed), cached |
| `POST /api/snap` | JPEG → Gemini → items with macros; sauces corrected from a reference table |
| `POST /api/chat` | Beet (Gemini) |
| `/api/sync`, `/api/pair` | Cross-device sync, 6-digit pairing |
| `/api/auth/*` | Email code, Google, Apple, sign out, delete account |
| `/api/coach/*` | Peek/join/leave, messages, client list with free-tier cap, target overrides |
| `/api/push/*` | Web Push subscriptions; cron sends reminders |
| `POST /api/program/review` | Gemini plan review; swaps validated against the same exercise pool, 4/day per device |
| `/api/mail/rem` (GET/POST), `/api/mail/unsub` (public, signed) | Email check-in settings and one-click unsubscribe |
| `/api/billing/*` | Config, status (+ daily `usage` meters), Stripe checkout and portal, Stripe and RevenueCat webhooks |

Email needs `RESEND_API_KEY` and `MAIL_FROM` (verified sending domain); `APP_ORIGIN` defaults to the production URL. Without them the toggle reports it is not switched on.

Billing is off until Stripe (or RevenueCat) is configured: with no keys nobody is limited and no meters show.

## Camera

| Feature | Runs where | Service | Cost |
|---|---|---|---|
| Rep counting + form check | on device | MediaPipe Pose Landmarker 1.1.1 (lite), self-hosted | free, no key |
| Barcode scan | on device | native `BarcodeDetector`, else the ZXing WASM ponyfill | free |
| Barcode → nutrition | Worker (cached 7 days) | Open Food Facts | free, no key |
| Food search | Worker | Open Food Facts + USDA FoodData Central | free (USDA key optional) |
| Meal photo → items | Worker | Gemini (`gemini-2.5-flash`) | needs a key; free tier is rate-limited |

- `src/camera/RepTracker.jsx`: frame check → 3-2-1 with a cue → auto count → done + RPE → form report → rest → up next → recap. Manual counting works at every stage.
- `src/camera/pose/engine.js`: pure rep/hold engine (EMA smoothing, hysteresis, minimum phase and rep times) plus the form report. Unit-tested.
- `src/camera/pose/exercises.js`: 9 trackable exercises: squat, push-up, lunge, bridge, RDL, curl, press, plank, wall sit.
- Dev demo without a person in frame: `npm run dev`, then open `/?posemock`.
- Meal photos go to Google Gemini only when the shutter is tapped. Camera video never leaves the phone.

## Design tokens

`src/styles/tokens.css` puts the Paulrork brand layer on top of the BeetFit dark shell: lime `#E0FD90`, electric blue `#303BFF`, violet `#7D70F6`, tight corners and square-in-square marks.
- Display font: **Unbounded** (OFL, self-hosted), the free stand-in for Ruberoid.
- Numerals: Space Grotesk (OFL), with tabular figures.
- Motion runs on a 128 BPM grid (`s16 = 117 ms`). Settings → Animation offers Auto/Full/Lite/Off, and Auto follows `prefers-reduced-motion`.

## Scripts

`npm run dev` · `npm test` (182 tests: app logic, pose engine, worker routes with an in-memory D1) · `npm run build` · `npm run deploy` · `npm run api:dev` · `npm run native:build` · `npm run ios` · `npm run android` · `npm run vapid`

## Status

Not verified on real hardware: iPhone behaviour, two-device coach ↔ client linking, live Stripe and Resend delivery, Gemini photo latency (the `/api/snap` response carries `ms` for measuring it). Store release and RevenueCat wiring are deferred. Exercise and warm-up content has not been reviewed by a trainer.
