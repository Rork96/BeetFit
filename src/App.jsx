import React, { useEffect, useMemo, useRef, useState } from 'react'
import Ic from './components/Icons.jsx'
import { motion, MotionConfig } from 'motion/react'
import { getMotionLevel } from './lib/motion.js'
import { loadState, saveState, loadNativeBackup, liveSession, persistStorage } from './lib/store.js'
import Onboarding from './components/Onboarding.jsx'
import TodayTab from './components/TodayTab.jsx'
import ProgressTab from './components/ProgressTab.jsx'
import MealsTab from './components/MealsTab.jsx'
import WorkoutTab from './components/WorkoutTab.jsx'
import Settings from './components/Settings.jsx'
import { haptic, isNative } from './lib/platform.js'
import { track } from './lib/track.js'
import { useBackClose } from './lib/hooks.js'
import { dayKey } from './lib/day.js'
import { useSync } from './lib/useSync.js'
import { useCoach } from './lib/useCoach.js'
import { useAccount } from './lib/useAccount.js'
import { usePro } from './lib/usePro.js'
import ProSheet from './components/Pro.jsx'
import { CoachChat, CoachHome } from './components/Coach.jsx'
import BeetChat from './components/Beet.jsx'
import Guides from './components/Read.jsx'
import Calendar from './components/Calendar.jsx'
import { remindersOf, updatePush, pushOn } from './lib/push.js'
import { stable } from './lib/sync.js'
import { planEvents, setWeekPlan } from './lib/plans.js'

const REM_SENT = 'beetfit_rem_sent'

// Top-level keys merged as a whole during sync: remember when each was last edited on this device.
const STAMPED = ['profile', 'settings', 'intake', 'program', 'mealPlan', 'plans', 'pauses', 'exNotes', 'myEx']

// 2px geometric line icons, square-based.
const ICON_OF = { today: 'today', workout: 'train', meals: 'food', beet: 'beet', progress: 'progress' }

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'workout', label: 'Train' },
  { id: 'meals', label: 'Food' },
  { id: 'beet', label: 'Beet' },
  { id: 'progress', label: 'Progress' }
]

export default function App() {
  const [state, setState] = useState(() => loadState())
  // Reopen Train if a workout was running when the app was killed or reloaded.
  const [tab, setTab] = useState(() => (liveSession()?.date === dayKey() ? 'workout' : 'today'))
  const [intent, setIntent] = useState(null) // cross-tab action, e.g. { start: true } for Train
  const [settings, setSettings] = useState(false)
  const [clients, setClients] = useState(false)
  useBackClose(clients, () => setClients(false))
  const [chat, setChat] = useState(false)
  const [guides, setGuides] = useState(null) // null | { first: guide id or null }
  const [cal, setCal] = useState(null) // null | { day, plan }
  const prevTab = useRef(tab)

  useEffect(() => { if (!state) loadNativeBackup().then(s => { if (s) setState(s) }) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (state) saveState(state) }, [state])
  useEffect(() => { track('open') }, [])
  useEffect(() => { if (state?.profile) persistStorage() }, [!!state?.profile]) // eslint-disable-line react-hooks/exhaustive-deps
  useBackClose(!!settings, () => setSettings(false))
  useBackClose(chat, () => setChat(false))
  useBackClose(!!guides, () => setGuides(null))
  useBackClose(!!cal, () => setCal(null))

  // Accepts a patch object or a function of the previous state (camera logs arrive in bursts).
  const update = patch => setState(s => {
    const p = typeof patch === 'function' ? patch(s) : patch
    const hit = STAMPED.filter(k => k in p)
    return { ...s, ...p, ...(hit.length ? { _t: { ...(s._t || {}), ...Object.fromEntries(hit.map(k => [k, Date.now()])) } } : {}) }
  })
  const sync = useSync(state, setState)
  const account = useAccount(sync, setState)
  const pro = usePro(!!state?.profile)
  // Right after the plan is built: coaches go to coach setup; everyone else gets the free-trial offer once.
  const hasPlan = !!state?.profile
  useEffect(() => {
    if (!hasPlan) return
    try {
      if (localStorage.getItem('beetfit_coach_intent')) { localStorage.removeItem('beetfit_coach_intent'); setSettings('setup'); return }
      if (localStorage.getItem('beetfit_paywall') && pro.config) {
        localStorage.removeItem('beetfit_paywall')
        if (pro.config.on && !isNative() && !pro.status?.pro && !pro.status?.trialUsed) setTimeout(() => pro.open('welcome'), 500)
      }
    } catch { /* ignore */ }
  }, [hasPlan, pro.config]) // eslint-disable-line react-hooks/exhaustive-deps
  const coachHook = useCoach(sync.on)
  // Joining a coach turns sync on: the coach reads the synced copy.
  const coach = { ...coachHook, join: async code => { const r = await coachHook.join(code); if (r.status === 200) sync.setOn(true); return r } }
  // Components read targets through state.coach.override; it never goes into the synced document.
  const link = coachHook.link
  const view = useMemo(() => (state && link?.coach ? { ...state, coach: { name: link.coach.name, override: link.override } } : state), [state, link])

  // Reminder times live in settings and calendar plans in state.plans (both sync). Reschedule this
  // phone when either changes, and on open (calendar reminders only cover the next two weeks).
  const remKey = state?.profile ? stable({ prefs: remindersOf(state), events: planEvents(state) }) : ''
  useEffect(() => {
    if (!remKey || !pushOn()) return
    let last = null
    try { last = localStorage.getItem(REM_SENT) } catch { /* ignore */ }
    if (last === remKey) return
    const t = setTimeout(() => {
      const { prefs, events } = JSON.parse(remKey)
      updatePush(prefs, events).then(r => { if (r?.ok) try { localStorage.setItem(REM_SENT, remKey) } catch { /* ignore */ } })
    }, 1200)
    return () => clearTimeout(t)
  }, [remKey])

  // Deep links from notifications: /?tab=meals, /?chat=coach, /?coach=1, /?cal=2026-10-28
  const openLink = href => {
    const q = new URL(href, location.origin).searchParams
    const t = q.get('tab')
    if (t && TABS.some(x => x.id === t)) { prevTab.current = tab; setTab(t) }
    if (q.get('chat') === 'coach') setChat(true)
    if (q.get('coach') === '1') setSettings('coach')
    if (/^\d{4}-\d{2}-\d{2}$/.test(q.get('cal') || '')) setCal({ day: q.get('cal') })
    if (q.get('pro') === '1') pro.open()
    const b = q.get('billing') // back from Stripe
    if (b === 'success') pro.open('success')
    else if (b === 'cancel') { pro.refresh(); pro.open() } // closed Checkout: put the plans back in front of them
    else if (b === 'portal') pro.refresh()
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
    return <Onboarding account={account} onRestore={data => { setState(data); sync.setOn(true); window.scrollTo(0, 0) }} onDone={({ profile, intake, program, settings, coachCode, asCoach }) => {
      setState({
        _t: Object.fromEntries(STAMPED.map(k => [k, Date.now()])),
        profile, intake, program, settings,
        plans: intake.weekdays?.length ? setWeekPlan([], intake.weekdays, '18:00', false) : [],
        weightLog: [{ date: dayKey(), kg: profile.weightKg }],
        mealPlan: null, workoutLog: {}, foodLog: {}, water: {}
      })
      if (coachCode) coach.join(coachCode)
      track('plan_built')
      try { localStorage.setItem(asCoach ? 'beetfit_coach_intent' : 'beetfit_paywall', '1') } catch { /* ignore */ }
    }} />
  }

  const order = TABS.map(t => t.id)
  const back = order.indexOf(tab) < order.indexOf(prevTab.current)
  const go = (id, it = null) => { if (id !== tab) { haptic(); prevTab.current = tab; setTab(id); window.scrollTo(0, 0) } setIntent(it) }

  const ml = getMotionLevel()
  return (
    <MotionConfig reducedMotion={ml === 'off' ? 'always' : ml === 'full' || ml === 'lite' ? 'never' : 'user'}>
      <div key={tab} className={'tabv' + (back ? ' tab-back' : '')}>
        {tab === 'today' && <TodayTab state={view} update={update} go={go} openSettings={() => setSettings(true)} coach={coach} openChat={() => setChat(true)} openClients={() => setClients(true)} askBeet={q => go('beet', q ? { first: q } : null)} openRead={id => setGuides({ first: id })} openCalendar={o => setCal(o || {})} sync={sync} />}
        {tab === 'workout' && <WorkoutTab state={view} update={update} intent={intent} clearIntent={() => setIntent(null)} pro={pro} />}
        {tab === 'meals' && <MealsTab state={view} update={update} onUpgrade={pro.on && !pro.pro ? r => pro.open(r) : null} />}
        {tab === 'beet' && <BeetChat embedded state={view} first={intent?.first} onUpgrade={pro.on && !pro.pro ? () => pro.open('chat') : null} />}
        {tab === 'progress' && <ProgressTab state={view} update={update} openCalendar={day => setCal({ day })} pro={pro} />}
      </div>
      <nav className="tabbar">
        {TABS.map(t => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => go(t.id)} aria-label={t.label} aria-current={tab === t.id ? 'page' : undefined}>
            {tab === t.id && <motion.span layoutId="tab-ind" className="tab-ind" transition={{ type: 'spring', stiffness: 520, damping: 40 }} />}
            <Ic n={ICON_OF[t.id]} />
            <span className="tab-l">{t.label}</span>
          </button>
        ))}
      </nav>
      {settings && <Settings state={view} update={update} sync={sync} coach={coach} account={account} pro={pro} openChat={() => setChat(true)} startCoach={settings === 'coach'} focusCoach={settings === 'setup'} onClose={() => history.back()} />}
      {chat && <CoachChat coach={coach} onClose={() => history.back()} />}
      {clients && <CoachHome onClose={() => history.back()} onUpgrade={pro.on && !pro.pro ? r => pro.open(r) : null} />}
      {guides && <Guides first={guides.first} onClose={() => history.back()} />}
      {cal && <Calendar state={view} update={update} first={cal.day} planWeek={cal.plan} onClose={() => history.back()}
        onStartWorkout={() => { history.back(); setTimeout(() => go('workout', { start: true }), 60) }} />}
      {pro.sheet && <ProSheet pro={pro} account={account} reason={pro.sheet.reason} onClose={pro.close} />}
    </MotionConfig>
  )
}
