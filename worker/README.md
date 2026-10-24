# beetfit-api (Cloudflare Worker)

Free-tier backend for the camera features. Everything else in the app stays on-device.

| Endpoint | What it does | Upstream (free) |
|---|---|---|
| `GET /api/health` | config check | — |
| `GET /api/food/barcode/:code` | barcode → product, per-100 g macros, cached 7 days | Open Food Facts (no key, 15 req/min/IP) |
| `GET /api/food/search?q=` | text search | Open Food Facts + USDA FoodData Central (free key) |
| `POST /api/snap` | meal photo → items with grams, kcal, macros, confidence | Google Gemini API free tier |

All routes except `/health` require the Telegram `initData` header and verify its HMAC with your bot token.

## Deploy (5 minutes)

```bash
cd worker
npm install
npx wrangler login                       # opens Cloudflare in the browser (free account)
npx wrangler secret put GEMINI_API_KEY   # https://aistudio.google.com/apikey
npx wrangler secret put BOT_TOKEN        # token of the bot that opens the Mini App
npx wrangler secret put USDA_API_KEY     # optional: https://fdc.nal.usda.gov/api-key-signup
npm run deploy                           # prints https://beetfit-api.<you>.workers.dev
```

Then in the frontend host (Vercel → Settings → Environment Variables):

```
VITE_API_URL=https://beetfit-api.<you>.workers.dev
```

and lock CORS to the Mini App URL in `wrangler.toml` → `ALLOWED_ORIGINS`.

## Notes

- **Gemini free tier**: prompts and photos on the free tier may be used by Google to improve its products. Switch the project to paid billing before real users if that matters. Limits are per Google Cloud project; check them in AI Studio.
- **Per-user cap**: bind a KV namespace as `RATE` to cap `/api/snap` at 30 photos per user per day.
- **Local dev**: `npm run dev` sets `ALLOW_UNSIGNED=1`, so requests from a normal browser work without Telegram.
- Tests: `npx vitest run` from the repo root covers initData verification and the food normalizers.
