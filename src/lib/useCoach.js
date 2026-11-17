import { useCallback, useEffect, useRef, useState } from 'react'
import { coachLink, coachJoin, coachLeave, coachSend, coachSeen } from './coach.js'

// Client side of coach mode: who my coach is, our thread, and any target override.
// Cached so targets set by the coach still apply offline.
const KEY = 'beetfit_coach'
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null } catch { return null } }
const write = v => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY) } catch { /* ignore */ } }

export function useCoach(enabled) {
  const [link, setLinkRaw] = useState(read) // { coach: { name, since }, msgs: [], override } | null
  const [error, setError] = useState('')
  const busy = useRef(false)
  const setLink = useCallback(v => { setLinkRaw(prev => { const n = typeof v === 'function' ? v(prev) : v; write(n?.coach ? n : null); return n?.coach ? n : null }) }, [])

  const refresh = useCallback(async () => {
    if (!enabled || busy.current) return
    busy.current = true
    const r = await coachLink()
    busy.current = false
    if (r.status === 200) { setError(''); setLink(r.coach ? { coach: r.coach, msgs: r.msgs || [], override: r.override || null } : null) }
    else setError(r.error || `http_${r.status}`)
  }, [enabled, setLink])

  useEffect(() => {
    if (!enabled) return
    refresh()
    const vis = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', vis)
    return () => document.removeEventListener('visibilitychange', vis)
  }, [enabled, refresh])

  // Poll while connected and on screen, so replies show up without a reload.
  const linked = !!link?.coach
  useEffect(() => {
    if (!enabled || !linked) return
    const t = setInterval(() => { if (document.visibilityState === 'visible') refresh() }, 45000)
    return () => clearInterval(t)
  }, [enabled, linked, refresh])

  const join = useCallback(async code => {
    const r = await coachJoin(code)
    if (r.status === 200) setLink({ coach: r.coach, msgs: [], override: null })
    return r
  }, [setLink])

  const leave = useCallback(async () => { const r = await coachLeave(); if (r.status === 200) setLink(null); return r }, [setLink])

  const send = useCallback(async text => {
    const tmp = { id: `tmp${Date.now()}`, by: 'client', text, at: Date.now(), seen: false, pending: true }
    setLink(l => l && { ...l, msgs: [...l.msgs, tmp] })
    const r = await coachSend(text)
    setLink(l => l && { ...l, msgs: l.msgs.map(m => (m.id === tmp.id ? (r.status === 200 ? r.msg : { ...m, pending: false, failed: true }) : m)) })
    return r
  }, [setLink])

  const markSeen = useCallback(async () => {
    setLink(l => l && { ...l, msgs: l.msgs.map(m => (m.by === 'coach' ? { ...m, seen: true } : m)) })
    await coachSeen()
  }, [setLink])

  const unread = (link?.msgs || []).filter(m => m.by === 'coach' && !m.seen)
  return { link, unread, error, refresh, join, leave, send, markSeen }
}
