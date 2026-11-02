import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { d1 } from '../test/d1.js'
import worker, { issueToken } from './index.js'
import { verifyStripe, _clearPrices } from './billing.js'

const SECRET = 'billing-test-secret-0123456789'
const WH = 'whsec_test_123'
const kv = () => { const m = new Map(); return { get: async k => m.get(k) ?? null, put: async (k, v) => { m.set(k, v) } } }
const env = {
  DEVICE_SECRET: SECRET, DB: d1(), RATE: kv(), GEMINI_API_KEY: 'g', RESEND_API_KEY: 're_test', MAIL_FROM: 'BeetFit <login@x>',
  STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: WH, STRIPE_PRICE_MONTH: 'price_m', STRIPE_PRICE_YEAR: 'price_y', REVENUECAT_WEBHOOK_AUTH: 'rc-secret'
}
const calls = [], mails = []
let realFetch
const call = (tok, path, method = 'GET', body, headers = {}) => worker.fetch(new Request('https://beetfit.test' + path, {
  method, headers: { ...(tok && { authorization: `Bearer ${tok}` }), 'content-type': 'application/json', ...headers }, body: body == null ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
}), env, { waitUntil: () => {} }).then(async r => ({ status: r.status, ...(await r.json()) }))

async function sign(payload, t = Math.floor(Date.now() / 1000)) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(WH), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`))).toString('hex')
  return `t=${t},v1=${mac}`
}
const hook = async evt => { const raw = JSON.stringify(evt); return call(null, '/api/billing/stripe-webhook', 'POST', raw, { 'stripe-signature': await sign(raw) }) }

async function signedIn(email) {
  const tok = await issueToken(SECRET)
  await call(tok, '/api/auth/email/start', 'POST', { email })
  const code = mails.filter(m => m.to[0] === email).at(-1).subject.slice(0, 6)
  await call(tok, '/api/auth/email/verify', 'POST', { email, code })
  return tok
}

const sub = (id, userId, extra = {}) => ({
  id, object: 'subscription', customer: 'cus_1', status: 'trialing', metadata: { user_id: userId }, cancel_at_period_end: false,
  trial_end: Math.floor(Date.now() / 1000) + 14 * 86400,
  items: { data: [{ price: { recurring: { interval: 'year' } }, current_period_end: Math.floor(Date.now() / 1000) + 14 * 86400 }] }, ...extra
})

beforeAll(() => {
  realFetch = globalThis.fetch
  globalThis.fetch = async (url, init = {}) => {
    url = String(url)
    if (url.startsWith('https://api.resend.com/')) { mails.push(JSON.parse(init.body)); return Response.json({ id: 'm' }) }
    if (url.startsWith('https://api.stripe.com/v1/')) {
      const path = url.slice(26), body = init.body ? Object.fromEntries(new URLSearchParams(init.body)) : null
      calls.push({ path, method: init.method, body })
      if (path === 'prices/price_m') return Response.json({ unit_amount: 699, currency: 'usd' })
      if (path === 'prices/price_y') return Response.json({ unit_amount: 4999, currency: 'usd' })
      if (path === 'customers') return Response.json({ id: 'cus_1' })
      if (path === 'checkout/sessions') return Response.json({ id: 'cs_1', url: 'https://checkout.stripe.com/c/pay/cs_1' })
      if (path === 'billing_portal/sessions') return Response.json({ url: 'https://billing.stripe.com/p/session/1' })
      if (path.startsWith('subscriptions/') && init.method === 'DELETE') return Response.json({ id: path.slice(14), status: 'canceled' })
      return Response.json({ error: { message: 'unexpected ' + path } }, { status: 404 })
    }
    if (url.includes('generativelanguage.googleapis.com')) return Response.json({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] })
    return new Response('nope', { status: 404 })
  }
  _clearPrices()
})
afterAll(() => { globalThis.fetch = realFetch })

describe('billing', () => {
  it('config lists prices and trial; status starts free', async () => {
    const r = await worker.fetch(new Request('https://beetfit.test/api/billing/config'), env, {})
    expect(await r.json()).toMatchObject({ on: true, web: true, store: true, trialDays: 14, free: { snaps: 3, chats: 5 }, prices: { month: { amount: 699 }, year: { amount: 4999 } } })
    const tok = await issueToken(SECRET)
    expect(await call(tok, '/api/billing/status')).toMatchObject({ pro: false, on: true, trialUsed: false, manage: false })
  })

  it('checkout needs an account, then opens Stripe with a no-card 14-day trial', async () => {
    const anon = await issueToken(SECRET)
    expect((await call(anon, '/api/billing/checkout', 'POST', { plan: 'year' })).error).toBe('sign_in_first')
    const tok = await signedIn('pay@example.com')
    expect((await call(tok, '/api/billing/checkout', 'POST', { plan: 'weekly' })).error).toBe('bad_plan')
    const r = await call(tok, '/api/billing/checkout', 'POST', { plan: 'year' })
    expect(r).toMatchObject({ url: 'https://checkout.stripe.com/c/pay/cs_1', trial: true })
    const cs = calls.filter(c => c.path === 'checkout/sessions').at(-1).body
    expect(cs).toMatchObject({
      mode: 'subscription', customer: 'cus_1', 'line_items[0][price]': 'price_y', payment_method_collection: 'if_required',
      'subscription_data[trial_period_days]': '14', 'subscription_data[trial_settings][end_behavior][missing_payment_method]': 'cancel',
      success_url: 'https://beetfit.test/?billing=success'
    })
    expect(calls.find(c => c.path === 'customers').body['metadata[user_id]']).toBe(cs.client_reference_id)
    // the portal works right away (customer remembered before the webhook)
    expect((await call(tok, '/api/billing/portal', 'POST')).url).toMatch(/billing\.stripe\.com/)
  })

  it('webhook: bad signature rejected; trialing → PRO; second checkout has no trial; deleted → free', async () => {
    const tok = await signedIn('hook@example.com')
    const { appUserId: uid } = await call(tok, '/api/billing/status')
    const bad = await call(null, '/api/billing/stripe-webhook', 'POST', '{"type":"x"}', { 'stripe-signature': 't=1,v1=00' })
    expect(bad.status).toBe(400)
    expect((await hook({ type: 'customer.subscription.created', data: { object: sub('sub_A', uid) } })).received).toBe(true)
    const st = await call(tok, '/api/billing/status')
    expect(st).toMatchObject({ pro: true, plan: 'year', state: 'trialing', source: 'stripe', trialUsed: true })
    expect(st.trialEnd).toBeGreaterThan(Date.now())
    expect((await call(tok, '/api/billing/checkout', 'POST', { plan: 'month' })).error).toBe('already_pro')
    await hook({ type: 'customer.subscription.deleted', data: { object: sub('sub_A', uid, { status: 'canceled' }) } })
    expect((await call(tok, '/api/billing/status')).pro).toBe(false)
    await call(tok, '/api/billing/checkout', 'POST', { plan: 'month' })
    const cs = calls.filter(c => c.path === 'checkout/sessions').at(-1).body
    expect(cs['subscription_data[trial_period_days]']).toBeUndefined() // one trial per person
    expect(cs.payment_method_collection).toBeUndefined()
  })

  it('free devices get 5 Beet messages a day, PRO gets more', async () => {
    const tok = await signedIn('chat@example.com')
    const ask = () => call(tok, '/api/chat', 'POST', { messages: [{ role: 'user', text: 'hi' }] })
    for (let i = 0; i < 5; i++) expect((await ask()).text).toBe('ok')
    expect(await ask()).toMatchObject({ status: 429, error: 'daily_limit', pro: false, limit: 5 })
    const { appUserId: uid } = await call(tok, '/api/billing/status')
    await hook({ type: 'customer.subscription.updated', data: { object: sub('sub_C', uid, { status: 'active', trial_end: null }) } })
    expect((await ask()).text).toBe('ok')
  })

  it('RevenueCat webhook needs the shared secret and grants PRO', async () => {
    const tok = await issueToken(SECRET)
    const { appUserId: uid } = await call(tok, '/api/billing/status')
    const ev = { event: { type: 'INITIAL_PURCHASE', app_user_id: uid, product_id: 'beetfit_pro_annual', period_type: 'NORMAL', store: 'APP_STORE', expiration_at_ms: Date.now() + 365 * 864e5 } }
    expect((await call(null, '/api/billing/revenuecat', 'POST', ev, { authorization: 'Bearer wrong' })).status).toBe(401)
    expect((await call(null, '/api/billing/revenuecat', 'POST', ev, { authorization: 'Bearer rc-secret' })).ok).toBe(true)
    expect(await call(tok, '/api/billing/status')).toMatchObject({ pro: true, plan: 'year', source: 'appstore' })
    await call(null, '/api/billing/revenuecat', 'POST', { event: { ...ev.event, type: 'EXPIRATION', expiration_at_ms: Date.now() - 1000 } }, { authorization: 'rc-secret' })
    expect((await call(tok, '/api/billing/status')).pro).toBe(false)
  })

  it('deleting the account cancels the Stripe subscription first', async () => {
    const tok = await signedIn('gone@example.com')
    const { appUserId: uid } = await call(tok, '/api/billing/status')
    await hook({ type: 'customer.subscription.created', data: { object: sub('sub_D', uid, { status: 'active' }) } })
    expect((await call(tok, '/api/auth/delete', 'POST', { confirm: 'DELETE' })).ok).toBe(true)
    expect(calls.some(c => c.path === 'subscriptions/sub_D' && c.method === 'DELETE')).toBe(true)
  })

  it('verifyStripe rejects stale and malformed headers', async () => {
    const raw = '{}'
    expect(await verifyStripe(WH, raw, await sign(raw, Math.floor(Date.now() / 1000) - 600))).toBe(false)
    expect(await verifyStripe(WH, raw, 'garbage')).toBe(false)
    expect(await verifyStripe(WH, raw, await sign(raw))).toBe(true)
  })
})
