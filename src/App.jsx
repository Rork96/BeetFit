import React, { useEffect, useRef, useState } from 'react'
import { loadState, saveState, loadCloudState } from './lib/store.js'
import Onboarding from './components/Onboarding.jsx'
import ProfileTab from './components/ProfileTab.jsx'
import MealsTab from './components/MealsTab.jsx'
import WorkoutTab from './components/WorkoutTab.jsx'
import { haptic } from './lib/tg.js'

// 2px geometric line icons (square-based), per the design system's icon guidance.
const Icon = {
  profile: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="8" y="3" width="8" height="8" /><path d="M4 21v-3a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v3" /></svg>,
  meals: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" /><path d="M3 12h18M12 12v9" /></svg>,
  workout: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="9" width="4" height="6" /><rect x="18" y="9" width="4" height="6" /><path d="M6 12h12" /><rect x="6" y="6" width="3" height="12" /><rect x="15" y="6" width="3" height="12" /></svg>
}

const TABS = [
  { id: 'profile', label: 'Body' },
  { id: 'meals', label: 'Meals' },
  { id: 'workout', label: 'Workout' }
]

export default function App() {
  const [state, setState] = useState(() => loadState())
  const [tab, setTab] = useState('workout')
  const prevTab = useRef(tab)

  // try Telegram CloudStorage if nothing local
  useEffect(() => {
    if (!state) loadCloudState().then(s => { if (s) setState(s) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { if (state) saveState(state) }, [state])

  // Accepts a patch object or a function of the previous state (needed for rapid camera logs).
  const update = patch => setState(s => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }))

  if (!state?.profile) {
    return <Onboarding onDone={profile => setState({
      profile,
      weightLog: [{ date: new Date().toISOString().slice(0, 10), kg: profile.weightKg }],
      mealPlan: null,
      workoutLog: {},
      foodLog: {}
    })} />
  }

  const order = TABS.map(t => t.id)
  const back = order.indexOf(tab) < order.indexOf(prevTab.current)
  const go = id => { if (id === tab) return; haptic(); prevTab.current = tab; setTab(id) }

  return (
    <>
      <div key={tab} className={back ? 'tab-back' : ''}>
        {tab === 'profile' && <ProfileTab state={state} update={update} />}
        {tab === 'meals' && <MealsTab state={state} update={update} />}
        {tab === 'workout' && <WorkoutTab state={state} update={update} />}
      </div>
      <nav className="tabbar">
        {TABS.map(t => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => go(t.id)}>
            {Icon[t.id]}
            {t.label}
          </button>
        ))}
      </nav>
    </>
  )
}
