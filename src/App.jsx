import React, { useEffect, useRef, useState } from 'react'
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
  const prevTab = useRef(tab)

  useEffect(() => { if (!state) loadNativeBackup().then(s => { if (s) setState(s) }) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (state) saveState(state) }, [state])
  useBackClose(settings, () => setSettings(false))

  // Accepts a patch object or a function of the previous state (camera logs arrive in bursts).
  const update = patch => setState(s => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }))

  if (!state?.profile) {
    return <Onboarding onDone={({ profile, intake, program, settings }) => setState({
      profile, intake, program, settings,
      weightLog: [{ date: dayKey(), kg: profile.weightKg }],
      mealPlan: null, workoutLog: {}, foodLog: {}, water: {}
    })} />
  }

  const order = TABS.map(t => t.id)
  const back = order.indexOf(tab) < order.indexOf(prevTab.current)
  const go = (id, it = null) => { if (id !== tab) { haptic(); prevTab.current = tab; setTab(id); window.scrollTo(0, 0) } setIntent(it) }

  return (
    <>
      <div key={tab} className={back ? 'tab-back' : ''}>
        {tab === 'today' && <TodayTab state={state} update={update} go={go} openSettings={() => setSettings(true)} />}
        {tab === 'workout' && <WorkoutTab state={state} update={update} intent={intent} clearIntent={() => setIntent(null)} />}
        {tab === 'meals' && <MealsTab state={state} update={update} />}
        {tab === 'progress' && <ProgressTab state={state} update={update} />}
      </div>
      <nav className="tabbar">
        {TABS.map(t => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => go(t.id)}>
            {Icon[t.id]}
            {t.label}
          </button>
        ))}
      </nav>
      {settings && <Settings state={state} update={update} onClose={() => history.back()} />}
    </>
  )
}
