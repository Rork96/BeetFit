import { useCallback, useEffect, useState } from 'react'
import { billingConfig, fetchStatus, cachedStatus } from './billing.js'

// PRO status + price list, refreshed on start, on return from Stripe, and when the app comes back.
export function usePro(enabled = true) {
  const [status, setStatus] = useState(cachedStatus)
  const [config, setConfig] = useState(null)
  const [sheet, setSheet] = useState(null) // null | { reason }
  const refresh = useCallback(async () => { const s = await fetchStatus(); if (s) setStatus(s); return s }, [])

  useEffect(() => {
    if (!enabled) return
    billingConfig().then(setConfig)
    refresh()
    const vis = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', vis)
    return () => document.removeEventListener('visibilitychange', vis)
  }, [enabled, refresh])

  // Back from Checkout: the webhook can land a few seconds after the redirect. Poll briefly.
  const afterCheckout = useCallback(async () => {
    for (let i = 0; i < 8; i++) {
      const s = await refresh()
      if (s?.pro) return s
      await new Promise(r => setTimeout(r, 1500))
    }
    return null
  }, [refresh])

  return {
    status, config, refresh, afterCheckout,
    pro: !!status?.pro || (config && !config.on), // billing off → everything open
    on: !!config?.on,
    sheet, open: (reason = null) => setSheet({ reason }), close: () => setSheet(null)
  }
}
