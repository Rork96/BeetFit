# Deploy BeetFit

One Cloudflare Worker serves the whole thing at **https://beetfit.wealthifai.xyz**: the web app (static files) and the API (`/api/*`). Free plan. Your Pi 5 tunnels on the same domain are not touched.

## 1. Web app on your domain (once, ~10 min)

Needs: Node 20+, the Cloudflare account that owns `wealthifai.xyz`.

```bash
git clone https://github.com/Rork96/BeetFit.git && cd BeetFit
git checkout redesign/camera-v1        # until PR #1 is merged
npm install
npx wrangler login                     # opens Cloudflare in the browser → Allow

# secrets (each command asks you to paste the value; nothing is stored in git)
openssl rand -hex 32                   # copy the output, then:
npx wrangler secret put DEVICE_SECRET  # paste it
npx wrangler secret put GEMINI_API_KEY # https://aistudio.google.com/apikey → Create API key
npx wrangler secret put USDA_API_KEY   # optional: https://fdc.nal.usda.gov/api-key-signup

npm run deploy
```

`npm run deploy` builds the app, downloads the pose model, creates the KV namespace for rate limits and the D1 database for sync, and attaches `beetfit.wealthifai.xyz`. Cloudflare creates the DNS record and certificate for you; give it 1–2 minutes.

Check:
- https://beetfit.wealthifai.xyz/api/health → `{"ok":true,"device":true,"sync":true,"gemini":true,…}` (all must be true)
- https://beetfit.wealthifai.xyz → the app

If `wrangler secret put` complains the Worker doesn't exist yet, run `npm run deploy` first, then the secrets, then deploy again.

### Deploy on every push (optional)
Cloudflare dashboard → Workers & Pages → **beetfit** → Settings → Builds → Connect → GitHub `Rork96/BeetFit`, branch `main`.
Build command: `npm run build` · Deploy command: `npx wrangler deploy`.

### Abuse protection (recommended, free)
Security → WAF → Rate limiting rules → Create:
`URI Path equals /api/snap` → 10 requests / 1 minute per IP → Block.

## 2. Install on a phone (no store)

- **iPhone**: open the site in Safari → Share → *Add to Home Screen*.
- **Android**: open in Chrome → ⋮ → *Install app*.

It runs full-screen, works offline after the first visit, and the camera works (HTTPS).

## 3. App Store / Google Play (Capacitor)

Needs: a Mac with Xcode + CocoaPods (iOS), Android Studio (Android).
Accounts: Apple Developer Program ($99/year), Google Play Console ($25 once).

```bash
npm run native:build          # builds with VITE_API_URL=https://beetfit.wealthifai.xyz and syncs
npx cap add ios
npx cap add android
npm run native:permissions    # adds the camera permission text to Info.plist / AndroidManifest
npm run ios                   # opens Xcode → Signing & Capabilities → pick your Team → Run on your iPhone
npm run android               # opens Android Studio → Run
```

After any code change: `npm run native:build`, then run again from Xcode / Android Studio.

Store notes:
- App ID: `xyz.wealthifai.beetfit` (in `capacitor.config.json`). Change it before the first upload if you want another.
- Apple rejects "website in a wrapper" apps (guideline 4.2). BeetFit's on-device camera coach, haptics and offline use are the native value. Put them in the review notes and screenshots.
- Privacy labels: camera (on-device only), photos sent to Google Gemini when the user taps the shutter, no account, no tracking.

## Local development

```bash
npm run dev           # app only, http://localhost:5173 (barcode falls back to Open Food Facts directly)
npm run api:dev       # app + Worker, http://localhost:8787 (needs .dev.vars with DEVICE_SECRET=...)
npm test
```
Dev-only demo of auto rep counting without a person: `npm run dev`, open `/?posemock`.
