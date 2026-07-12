import React, { useEffect, useState } from 'react'
import { loadState, saveState, loadCloudState } from './lib/store.js'
import Onboarding from './components/Onboarding.jsx'
import ProfileTab from './components/ProfileTab.jsx'
import MealsTab from './components/MealsTab.jsx'
import WorkoutTab from './components/WorkoutTab.jsx'

const TABS = [
  { id: 'profile', label: 'Profile', ic: '👤' },
  { id: 'meals', label: 'Meals', ic: '🍽' },
  { id: 'workout', label: 'Workout', ic: '💪' }
]

export default function App() {
  const [state, setState] = useState(() => loadState())
  const [tab, setTab] = useState('profile')

  // try Telegram CloudStorage if nothing local
  useEffect(() => {
    if (!state) loadCloudState().then(s => { if (s) setState(s) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { if (state) saveState(state) }, [state])

  const update = patch => setState(s => ({ ...s, ...patch }))

  if (!state?.profile) {
    return <Onboarding onDone={profile => setState({
      profile,
      weightLog: [{ date: new Date().toISOString().slice(0, 10), kg: profile.weightKg }],
      mealPlan: null,
      workoutLog: {}
    })} />
  }

  return (
    <>
      {tab === 'profile' && <ProfileTab state={state} update={update} />}
      {tab === 'meals' && <MealsTab state={state} update={update} />}
      {tab === 'workout' && <WorkoutTab state={state} update={update} />}
      <nav className="tabbar">
        {TABS.map(t => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            <span className="ic">{t.ic}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </>
  )
}
