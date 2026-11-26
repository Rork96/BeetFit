import { describe, it, expect, afterEach, vi } from 'vitest'
import { pushAsk, snoozePushAsk } from './push.js'

// pushAsk decides whether Today offers reminders. It reads the browser, so the browser is stubbed here.
function browser({ perm = 'default', push = true, ios = false, standalone = false, on = false } = {}) {
  const store = new Map(on ? [['beetfit_push_on', '1']] : [])
  vi.stubGlobal('localStorage', { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) })
  vi.stubGlobal('navigator', { userAgent: ios ? 'iPhone' : 'Chrome', serviceWorker: {}, standalone, platform: '', maxTouchPoints: 0 })
  const win = { matchMedia: () => ({ matches: standalone }), Notification: {}, ...(push ? { PushManager: {} } : {}) }
  vi.stubGlobal('window', win)
  vi.stubGlobal('Notification', { permission: perm })
}

describe('pushAsk', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('offers reminders where web push works and nothing was decided yet', () => { browser(); expect(pushAsk()).toBe('ask') })
  it('stays quiet once reminders are on', () => { browser({ on: true }); expect(pushAsk()).toBe(null) })
  it('stays quiet when notifications are blocked', () => { browser({ perm: 'denied' }); expect(pushAsk()).toBe(null) })
  it('stays quiet in iPhone Safari outside the Home Screen app', () => { browser({ ios: true, push: false }); expect(pushAsk()).toBe(null) })
  it('a "not now" holds it back for a week', () => {
    browser()
    snoozePushAsk(7)
    expect(pushAsk()).toBe(null)
  })
})
