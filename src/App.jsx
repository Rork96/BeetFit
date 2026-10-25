import React, { useEffect, useMemo, useRef, useState } from 'react'
import { loadState, saveState, loadNativeBackup } from './lib/store.js'
import Onboarding from './components/Onboarding.jsx'
import TodayTab from './components/TodayTab.jsx'
import ProgressTab from './components/ProgressTab.jsx'
import MealsTab from './components/MealsTab.jsx'
import WorkoutTab from './components/WorkoutTab.jsx'
import Settings from './components/Settings.jsx'
import { haptic } from './lib/platform.js'
import { useBackClose } from './lib/hooks.js'
import { dayKey } from './lib/day.js'
import { useSync } from './lib/useSync.js'
import { useCoach } from './lib/useCoach.js'
import { CoachChat } from './components/Coach.jsx'
import BeetChat from './components/Beet.jsx'
import Guides from './components/Read.jsx'
import { remindersOf, updatePush, pushOn } from './lib/push.js'
import { stable } from './lib/sync.js'

// Top-level keys merged as a whole during sync: remember when each was last edited on this device.
const STAMPED = ['profile', 'settings', 'intake', 'program', 'mealPlan']

// 2px geometric line icons, square-based.
const Icon = {
  today: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" /><rect x="9" y="9" width="6" height="6" /></svg>,
  workout: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="9" width="4" height="6" /><rect x="18" y="9" width="4" height="6" /><path d="M6 12h12" /><rect x="6" y="6" width="3" height="12" /><rect x="15" y="6" width="3" height="12" /></svg>,
  meals: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" /><path d="M3 12h18M12 12v9" /></svg>,
  progress: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18" /><rect x="5" y="12" width="3" height="6" /><rect x="10.5" y="8" width="3" height="10" /><rect x="16" y="4" width="3" height="14" /></svg>
}

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'workout', label: 'Train' },
  { id: 'meals', label: 'Food' },
  { id: 'progress', label: 'Progress' }
]

export default function App() {
  const [state, setState] = useState(() => loadState())
  const [tab, setTab] = useState('today')
  const [intent, setIntent] = useState(null) // cross-tab action, e.g. { start: true } for Train
  const [settings, setSettings] = useState(false)
  const [chat, setChat] = useState(false)
  const [beet, setBeet] = useState(null) // null | { first: question or null }
  const [guides, setGuides] = useState(null) // null | { first: guide id or null }
  const prevTab = useRef(tab)

  useEffect(() => { if (!state) loadNativeBackup().then(s => { if (s) setState(s) }) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (state) saveState(state) }, [state])
  useBackClose(!!settings, () => setSettings(false))
  useBackClose(chat, () => setChat(false))
  useBackClose(!!beet, () => setBeet(null))
  useBackClose(!!guides, () => setGuides(null))

  // Accepts a patch object or a function of the previous state (camera logs arrive in bursts).
  const update = patch => setState(s => {
    const p = typeof patch === 'function' ? patch(s) : patch
    const hit = STAMPED.filter(k => k in p)
    return { ...s, ...p, ...(hit.length ? { _t: { ...(s._t || {}), ...Object.fromEntries(hit.map(k => [k, Date.now()])) } } : {}) }
  })
  const sync = useSync(state, setState)
  const coachHook = useCoach(sync.on)
  // Joining a coach turns sync on: the coach reads the synced copy.
  const coach = { ...coachHook, join: async code => { const r = await coachHook.join(code); if (r.status === 200) sync.setOn(true); return r } }
  // Components read targets through state.coach.override; it never goes into the synced document.
  const link = coachHook.link
  const view = useMemo(() => (state && link?.coach ? { ...state, coach: { name: link.coach.name, override: link.override } } : state), [state, link])

  // Reminder times live in settings (so they sync); reschedule this phone when they change.
  const remKey = state?.profile ? stable(remindersOf(state)) : ''
  const remSent = useRef(null)
  useEffect(() => {
    if (!remKey || !pushOn()) return
    if (remSent.current === null) { remSent.current = remKey; return } // first render: already scheduled
    if (remSent.current === remKey) return
    const t = setTimeout(() => { remSent.current = remKey; updatePush(JSON.parse(remKey)) }, 1200)
    return () => clearTimeout(t)
  }, [remKey])

  // Deep links from notifications: /?tab=meals, /?chat=coach, /?coach=1
  const openLink = href => {
    const q = new URL(href, location.origin).searchParams
    const t = q.get('tab')
    if (t && TABS.some(x => x.id === t)) { prevTab.current = tab; setTab(t) }
    if (q.get('chat') === 'coach') setChat(true)
    if (q.get('coach') === '1') setSettings('coach')
  }
  const openRef = useRef(openLink)
  openRef.current = openLink
  useEffect(() => {
    if (location.search) { const href = location.href; history.replaceState(null, '', '/'); openRef.current(href) }
    const onMsg = e => { if (e.data?.type === 'bf-open') openRef.current(e.data.url) }
    navigator.serviceWorker?.addEventListener('message', onMsg)
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg)
  }, [])

  if (!state?.profile) {
    return <Onboarding onRestore={data => { setState(data); sync.setOn(true); window.scrollTo(0, 0) }} onDone={({ profile, intake, program, settings, coachCode }) => {
      setState({
        _t: Object.fromEntries(STAMPED.map(k => [k, Date.now()])),
        profile, intake, program, settings,
        weightLog: [{ date: dayKey(), kg: profile.weightKg }],
        mealPlan: null, workoutLog: {}, foodLog: {}, water: {}
      })
      if (coachCode) coach.join(coachCode)
    }} />
  }

  const order = TABS.map(t => t.id)
  const back = order.indexOf(tab) < order.indexOf(prevTab.current)
  const go = (id, it = null) => { if (id !== tab) { haptic(); prevTab.current = tab; setTab(id); window.scrollTo(0, 0) } setIntent(it) }

  return (
    <>
      <div key={tab} className={back ? 'tab-back' : ''}>
        {tab === 'today' && <TodayTab state={view} update={update} go={go} openSettings={() => setSettings(true)} coach={coach} openChat={() => setChat(true)} askBeet={q => setBeet({ first: q })} openRead={id => setGuides({ first: id })} />}
        {tab === 'workout' && <WorkoutTab state={view} update={update} intent={intent} clearIntent={() => setIntent(null)} />}
        {tab === 'meals' && <MealsTab state={view} update={update} />}
        {tab === 'progress' && <ProgressTab state={view} update={update} />}
      </div>
      <nav className="tabbar">
        {TABS.map(t => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => go(t.id)}>
            {Icon[t.id]}
            {t.label}
          </button>
        ))}
      </nav>
      {settings && <Settings state={view} update={update} sync={sync} coach={coach} openChat={() => setChat(true)} startCoach={settings === 'coach'} onClose={() => history.back()} />}
      {chat && <CoachChat coach={coach} onClose={() => history.back()} />}
      {guides && <Guides first={guides.first} onClose={() => history.back()} />}
      {beet && <BeetChat state={view} first={beet.first} onClose={() => history.back()} />}
    </>
  )
}
