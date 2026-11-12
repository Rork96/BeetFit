// BeetFit PRO. Web: Stripe Checkout + Customer Portal, kept in sync by a signed webhook.
// iOS / Android: RevenueCat (App Store / Google Play) posts to its own webhook with a shared secret.
// One table, one row per subscription; "pro" = any row that is active or trialing and not past its end.
//
// Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_MONTH, STRIPE_PRICE_YEAR, REVENUECAT_WEBHOOK_AUTH.
// Without any of them billing is off and nobody is limited (dev / self-host).

export const TRIAL_DAYS = 14
export const FREE = { snaps: 3, chats: 5, clients: 3 }    // snaps/chats per device per day; clients = linked clients a coach can have
export const PRO = { snaps: 30, chats: 60, clients: 200 }

export const billingOn = env => !!((env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_MONTH && env.STRIPE_PRICE_YEAR) || env.REVENUECAT_WEBHOOK_AUTH)

let ready = false
export async function ensureBillingSchema(db) {
  if (ready) return
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS subs (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, source TEXT NOT NULL, plan TEXT, status TEXT NOT NULL, period_end INTEGER, trial_end INTEGER, cancel_at_end INTEGER NOT NULL DEFAULT 0, customer TEXT, updated INTEGER NOT NULL)'),
    db.prepare('CREATE INDEX IF NOT EXISTS subs_user ON subs (user_id)')
  ])
  ready = true
}

const LIVE = ['active', 'trialing', 'past_due'] // past_due: Stripe is still retrying the card; keep access meanwhile

export async function entitlement(db, userId, now = Date.now()) {
  await ensureBillingSchema(db)
  const { results } = await db.prepare('SELECT * FROM subs WHERE user_id = ? ORDER BY updated DESC').bind(userId).all()
  // A device trial has no Stripe behind it to flip the status, so it ends exactly at its time. Paid rows keep a day of grace.
  const over = r => (r.source === 'trial' ? r.period_end <= now : r.period_end && r.period_end <= now - 864e5)
  const lives = results.filter(r => LIVE.includes(r.status) && !over(r))
  const live = lives.find(r => r.source !== 'trial') || lives[0] // a paid plan bought during the device trial wins
  const head = results[0]
  return {
    pro: !!live,
    plan: live?.plan || null,
    status: live?.status || (head?.source === 'trial' && over(head) ? 'expired' : (head?.status ?? null)),
    source: live?.source || null,
    periodEnd: live?.period_end || null,
    trialEnd: live?.status === 'trialing' ? live.trial_end : null,
    cancelAtEnd: !!live?.cancel_at_end,
    trialUsed: results.some(r => r.trial_end),
    customer: results.find(r => r.customer)?.customer || null
  }
}

// The owner of a row is fixed at insert. Signing in later moves rows to the account (auth.signIn); a renewal webhook still
// carries the old anonymous id in its metadata and must not move the plan back.
async function upsert(db, row) {
  await ensureBillingSchema(db)
  await db.prepare(`INSERT INTO subs (id, user_id, source, plan, status, period_end, trial_end, cancel_at_end, customer, updated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET plan = excluded.plan, status = excluded.status, period_end = excluded.period_end,
      trial_end = COALESCE(excluded.trial_end, subs.trial_end), cancel_at_end = excluded.cancel_at_end, customer = COALESCE(excluded.customer, subs.customer), updated = excluded.updated`)
    .bind(row.id, row.user_id, row.source, row.plan ?? null, row.status, row.period_end ?? null, row.trial_end ?? null, row.cancel_at_end ? 1 : 0, row.customer ?? null, Date.now()).run()
}

// 14 days of PRO on this install, no account and no card. One per user; paying later needs an account (Stripe) and has no second trial.
export async function startTrial(db, userId, now = Date.now()) {
  const ent = await entitlement(db, userId, now)
  if (ent.pro) return { error: 'already_pro' }
  if (ent.trialUsed) return { error: 'trial_used' }
  const end = now + TRIAL_DAYS * 864e5
  await upsert(db, { id: `trial:${userId}`, user_id: userId, source: 'trial', plan: null, status: 'trialing', period_end: end, trial_end: end })
  return { ok: true, trialEnd: end }
}

// ---------- Stripe REST (no SDK in Workers) ----------

function form(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue
    const key = prefix ? `${prefix}[${k}]` : k
    if (typeof v === 'object') form(v, key, out)
    else out.append(key, String(v))
  }
  return out
}

export async function stripe(env, path, params, method = params ? 'POST' : 'GET') {
  const res = await fetch('https://api.stripe.com/v1/' + path, {
    method,
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'content-type': 'application/x-www-form-urlencoded', 'stripe-version': '2025-03-31.basil' },
    body: params ? form(params).toString() : undefined
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`stripe ${res.status}: ${body.error?.message || ''}`.slice(0, 200))
  return body
}

// STRIPE_PRICE_* may hold a price id (price_…) or a product id (prod_…). For a product, its active recurring
// price with the matching interval is used, so copying the id from the product page also works.
const resolved = {}
export async function priceId(env, plan) {
  const raw = plan === 'year' ? env.STRIPE_PRICE_YEAR : plan === 'month' ? env.STRIPE_PRICE_MONTH : null
  if (!raw || !raw.startsWith('prod_')) return raw
  const key = raw + ':' + plan
  if (resolved[key]) return resolved[key]
  const list = await stripe(env, `prices?product=${encodeURIComponent(raw)}&active=true&type=recurring&limit=20`)
  const hit = (list.data || []).find(p => p.recurring?.interval === plan)
  if (!hit) throw new Error(`stripe: no active ${plan}ly price on ${raw}`)
  return (resolved[key] = hit.id)
}

let priceCache = null
export async function prices(env) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_MONTH || !env.STRIPE_PRICE_YEAR) return null
  if (priceCache && priceCache.at > Date.now() - 3600e3) return priceCache.v
  const [mId, yId] = await Promise.all([priceId(env, 'month'), priceId(env, 'year')])
  const [m, y] = await Promise.all([stripe(env, 'prices/' + mId), stripe(env, 'prices/' + yId)])
  const p = x => ({ amount: x.unit_amount, currency: x.currency })
  priceCache = { at: Date.now(), v: { month: p(m), year: p(y) } }
  return priceCache.v
}
export const _clearPrices = () => { priceCache = null; for (const k in resolved) delete resolved[k] }

// Why the amounts could not be loaded (wrong key mode, a prod_ id instead of price_, a deleted price). Shown to the owner, not the buyer.
export async function priceProblem(env) {
  try { await prices(env); return null } catch (e) { return String(e.message || e).slice(0, 160) }
}

export async function billingConfig(env) {
  return {
    on: billingOn(env),
    web: !!(env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_MONTH && env.STRIPE_PRICE_YEAR),
    store: !!env.REVENUECAT_WEBHOOK_AUTH,
    trialDays: TRIAL_DAYS,
    free: FREE,
    prices: await prices(env).catch(() => null),
    ...(await priceProblem(env).then(e => (e ? { priceError: e } : {})))
  }
}

export async function checkout(env, db, userId, { plan, origin, email }) {
  if (plan !== 'year' && plan !== 'month') return { error: 'bad_plan' }
  const price = await priceId(env, plan)
  if (!price) return { error: 'bad_plan' }
  const ent = await entitlement(db, userId)
  if (ent.pro && ent.source !== 'trial') return { error: 'already_pro' } // paying during the device trial is the point of it
  let customer = ent.customer
  if (!customer) customer = (await stripe(env, 'customers', { email: email || undefined, metadata: { user_id: userId } })).id
  const trial = false // the free trial is the device trial (startTrial); Stripe checkout always takes a card, so 'paid' means paid
  const session = await stripe(env, 'checkout/sessions', {
    mode: 'subscription',
    customer,
    client_reference_id: userId,
    line_items: { 0: { price, quantity: 1 } },
    allow_promotion_codes: 'true',
    // No card for the trial. When it ends without one, the subscription cancels; nobody is charged by surprise.
    payment_method_collection: trial ? 'if_required' : undefined,
    subscription_data: {
      metadata: { user_id: userId },
      trial_period_days: trial ? TRIAL_DAYS : undefined,
      trial_settings: trial ? { end_behavior: { missing_payment_method: 'cancel' } } : undefined
    },
    success_url: `${origin}/?billing=success`,
    cancel_url: `${origin}/?billing=cancel`
  })
  // Remember the customer now, so the portal works even before the webhook lands.
  await upsert(db, { id: `stripe-customer:${userId}`, user_id: userId, source: 'stripe', status: 'customer', customer })
  return { url: session.url, trial }
}

export async function portal(env, db, userId, origin) {
  const ent = await entitlement(db, userId)
  if (!ent.customer) return { error: 'no_customer' }
  const s = await stripe(env, 'billing_portal/sessions', { customer: ent.customer, return_url: `${origin}/?billing=portal` })
  return { url: s.url }
}

// Signature: "t=<ts>,v1=<hex hmac of `${t}.${raw}`>"; reject anything older than 5 minutes.
export async function verifyStripe(secret, raw, header, now = Date.now()) {
  if (!secret || !header) return false
  const parts = Object.fromEntries(header.split(',').map(kv => kv.split('=')).filter(p => p.length === 2).map(([k, v]) => [k.trim(), v]))
  const t = +parts.t
  const sigs = header.split(',').filter(p => p.startsWith('v1=')).map(p => p.slice(3))
  if (!t || !sigs.length || Math.abs(now / 1000 - t) > 300) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${raw}`)))].map(b => b.toString(16).padStart(2, '0')).join('')
  return sigs.some(s => s.length === mac.length && [...s].reduce((d, c, i) => d | (c.charCodeAt(0) ^ mac.charCodeAt(i)), 0) === 0)
}

const ms = s => (s ? s * 1000 : null)
function fromStripeSub(sub) {
  const item = sub.items?.data?.[0]
  return {
    id: `stripe:${sub.id}`,
    user_id: sub.metadata?.user_id,
    source: 'stripe',
    plan: item?.price?.recurring?.interval === 'year' ? 'year' : 'month',
    status: sub.status,
    // API 2025-03-31 moved the period to the item; older payloads have it on the subscription.
    period_end: ms(item?.current_period_end ?? sub.current_period_end),
    trial_end: ms(sub.trial_end),
    cancel_at_end: !!sub.cancel_at_period_end,
    customer: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
  }
}

// Returns { notify: { userId, payload } } when the person should hear about it (trial ending).
export async function stripeEvent(env, db, evt) {
  const o = evt.data?.object || {}
  if (evt.type === 'checkout.session.completed' && o.subscription) {
    const sub = await stripe(env, 'subscriptions/' + o.subscription)
    if (!sub.metadata?.user_id && o.client_reference_id) sub.metadata = { ...(sub.metadata || {}), user_id: o.client_reference_id }
    const row = fromStripeSub(sub)
    if (row.user_id) await upsert(db, row)
    return {}
  }
  if (evt.type?.startsWith('customer.subscription.')) {
    const row = fromStripeSub(o)
    if (!row.user_id) return {}
    await upsert(db, row)
    if (evt.type === 'customer.subscription.trial_will_end') {
      const card = !!o.default_payment_method
      return {
        notify: {
          userId: row.user_id,
          payload: card
            ? { title: 'PRO trial ends in 3 days', body: 'Then your plan renews on the card you added. Cancel any time in Settings → PRO.', url: '/?pro=1', tag: 'trial' }
            : { title: 'PRO trial ends in 3 days', body: 'No card on file, so it just stops. Nothing is charged. Add a card in Settings → PRO to keep it.', url: '/?pro=1', tag: 'trial' }
        }
      }
    }
  }
  return {}
}

// RevenueCat webhook (App Store / Google Play). app_user_id is our user id (set by the app at login).
export async function revenuecatEvent(db, body) {
  const e = body?.event
  if (!e || e.type === 'TEST') return { ok: true, test: true }
  const userId = e.app_user_id
  if (!userId || String(userId).startsWith('$RCAnonymousID')) return { ok: true, skipped: true }
  const now = Date.now()
  const exp = e.expiration_at_ms || null
  const status = e.type === 'EXPIRATION' ? 'expired'
    : e.type === 'BILLING_ISSUE' ? 'past_due'
      : e.period_type === 'TRIAL' ? 'trialing'
        : exp && exp < now ? 'expired' : 'active'
  const plan = /year|annual/i.test(e.product_id || '') ? 'year' : 'month'
  await upsert(db, {
    id: `rc:${e.store || 'store'}:${userId}`,
    user_id: userId, source: e.store === 'PLAY_STORE' ? 'play' : 'appstore', plan, status,
    period_end: exp, trial_end: e.period_type === 'TRIAL' ? exp : null,
    cancel_at_end: e.type === 'CANCELLATION'
  })
  return { ok: true }
}

// Account deletion: stop any Stripe billing first, then the rows go with the user.
export async function cancelBilling(env, db, userId) {
  await ensureBillingSchema(db)
  const { results } = await db.prepare("SELECT id, status FROM subs WHERE user_id = ? AND source = 'stripe' AND id LIKE 'stripe:sub_%'").bind(userId).all()
  if (env.STRIPE_SECRET_KEY) {
    for (const r of results.filter(r => LIVE.includes(r.status))) {
      await stripe(env, 'subscriptions/' + r.id.slice(7), null, 'DELETE').catch(() => {})
    }
  }
  await db.prepare('DELETE FROM subs WHERE user_id = ?').bind(userId).run()
  return results.length
}
