// One command to wire Stripe: product, two prices, webhook endpoint, then a check that the Worker will accept them.
// Usage:  STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs [https://beetfit.wealthifai.xyz]
// Prints the two lines for wrangler.toml and the commands for the two secrets. Safe to re-run: it reuses what it created.
const key = process.env.STRIPE_SECRET_KEY
const origin = (process.argv[2] || 'https://beetfit.wealthifai.xyz').replace(/\/$/, '')
if (!key || !/^(sk|rk)_(test|live)_/.test(key)) { console.error('Set STRIPE_SECRET_KEY=sk_test_… (or sk_live_…).'); process.exit(1) }
const mode = key.includes('_live_') ? 'LIVE' : 'TEST'

const enc = (o, pre = '') => Object.entries(o).flatMap(([k, v]) => v && typeof v === 'object' ? enc(v, pre ? `${pre}[${k}]` : k) : [[pre ? `${pre}[${k}]` : k, String(v)]])
async function api(path, params, method = params ? 'POST' : 'GET') {
  const res = await fetch('https://api.stripe.com/v1/' + path, {
    method, headers: { authorization: `Bearer ${key}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: params ? new URLSearchParams(enc(params)).toString() : undefined
  })
  const body = await res.json()
  if (!res.ok) throw new Error(`${path}: ${body.error?.message || res.status}`)
  return body
}

console.log(`Stripe ${mode} mode`)
// Product: reuse by metadata so a re-run does not create duplicates.
const found = (await api('products/search?query=' + encodeURIComponent("metadata['app']:'beetfit' AND active:'true'"))).data[0]
const product = found || await api('products', { name: 'BeetFit PRO', metadata: { app: 'beetfit' } })

async function price(lookup, amount, interval) {
  const have = (await api(`prices?lookup_keys[]=${lookup}&active=true`)).data[0]
  if (have) return have
  return api('prices', { product: product.id, currency: 'usd', unit_amount: amount, recurring: { interval }, lookup_key: lookup })
}
const month = await price('beetfit_pro_month', 699, 'month')
const year = await price('beetfit_pro_year', 4999, 'year')

const events = ['checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted', 'customer.subscription.trial_will_end']
const url = origin + '/api/billing/stripe-webhook'
const hooks = (await api('webhook_endpoints?limit=100')).data
let hook = hooks.find(h => h.url === url)
let secret = null
if (!hook) { hook = await api('webhook_endpoints', { url, enabled_events: events }); secret = hook.secret }

console.log('\n1. wrangler.toml [vars]:')
console.log(`STRIPE_PRICE_MONTH = "${month.id}"`)
console.log(`STRIPE_PRICE_YEAR = "${year.id}"`)
console.log('\n2. Secrets:')
console.log('npx wrangler secret put STRIPE_SECRET_KEY        # paste the same sk_… key')
if (secret) { console.log('npx wrangler secret put STRIPE_WEBHOOK_SECRET    # paste:'); console.log(secret) }
else console.log(`STRIPE_WEBHOOK_SECRET: endpoint ${hook.id} already exists. Stripe shows its signing secret only at creation: Dashboard → Developers → Webhooks → reveal, or delete the endpoint and re-run.`)
console.log('\n3. npm run deploy, then:  curl -s ' + origin + '/api/billing/config   → must show "prices" with amounts and no "priceError".')
console.log('\n4. Dashboard (cannot be set by API here): Settings → Billing → Customer portal → cancel at period end, update card, switch plan; Subscriptions and emails → trial-ending reminders.')
