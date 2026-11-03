import { useCallback, useEffect, useRef, useState } from 'react'
import { syncNow, mergeStates, stable, syncEnabled, setSyncEnabled } from './sync.js'
import { summarize } from './coach.js'

// Runs sync on start, when the app comes back to the foreground or online, and 3 s after local edits.
export function useSync(state, setState) {
  const [on, setOnRaw] = useState(syncEnabled)
  const [info, setInfo] = useState({ status: syncEnabled() ? 'idle' : 'off', at: 0, devices: 1 })
  const busy = useRef(false), again = useRef(false), last = useRef(''), ref = useRef(state)
  ref.current = state

  const run = useCallback(async () => {
    if (!syncEnabled() || !ref.current?.profile) return
    if (busy.current) { again.current = true; return }
    busy.current = true
    setInfo(i => ({ ...i, status: 'syncing' }))
    const r = await syncNow(ref.current, summarize)
    if (r.status === 'ok') {
      last.current = stable(r.state)
      setState(cur => { const m = mergeStates(cur, r.state); return stable(m) === stable(cur) ? cur : m })
    }
    setInfo(i => ({ status: r.status, at: r.status === 'ok' ? Date.now() : i.at, devices: r.devices ?? i.devices }))
    busy.current = false
    if (again.current) { again.current = false; run() }
  }, [setState])

  const setOn = useCallback(v => { setSyncEnabled(v); setOnRaw(v); setInfo(i => ({ ...i, status: v ? 'idle' : 'off' })); if (v) run() }, [run])

  useEffect(() => {
    if (!on) return
    run()
    const vis = () => { if (document.visibilityState === 'visible') run() }
    document.addEventListener('visibilitychange', vis)
    window.addEventListener('online', run)
    return () => { document.removeEventListener('visibilitychange', vis); window.removeEventListener('online', run) }
  }, [on, run])

  useEffect(() => {
    if (!on || !state?.profile || stable(state) === last.current) return
    const t = setTimeout(run, 3000)
    return () => clearTimeout(t)
  }, [state, on, run])

  return { on, setOn, info, run }
}
