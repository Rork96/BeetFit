import React, { useEffect, useRef, useState } from 'react'
import { dayKey } from '../lib/day.js'
import { habitsOf, habitDone, scheduledOn } from '../lib/habits.js'
import { startAlarm, stopAlarm, dueHabit } from '../lib/alarm.js'
import { haptic } from '../lib/platform.js'
import './habitAlarm.css'

// While the app is open at a habit's time: ring until the person checks it or snoozes (10 min). Closed app → the push/notification does the work.
export default function HabitAlarm({ state, onCheck }) {
  const [due, setDue] = useState(null)
  const snoozed = useRef({})
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'visible') return
      const st = stateRef.current, now = new Date()
      const h = dueHabit(habitsOf(st), st, now, dayKey(now), scheduledOn, habitDone, snoozed.current)
      setDue(prev => (prev?.id === h?.id ? prev : h))
    }
    tick()
    const t = setInterval(tick, 10000)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', tick) }
  }, [state?.settings?.reminders?.habits, state?.habitLog]) // re-check when habits or ticks change, and every 10 s for the clock

  useEffect(() => {
    if (due) startAlarm(); else stopAlarm()
    return stopAlarm
  }, [due?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!due) return null
  return (
    <div className="ha" role="alertdialog" aria-live="assertive" aria-label={`${due.n} reminder`}>
      <div className="ha-t"><b>{due.n}</b><span>Show {due.ask || 'it'} to the camera to turn this off.</span></div>
      <div className="ha-a">
        <button className="btn secondary" onClick={() => { haptic(); snoozed.current[due.id] = Date.now() + 10 * 60000; setDue(null) }}>Snooze 10 min</button>
        <button className="btn" onClick={() => { haptic(); const h = due; snoozed.current[h.id] = Date.now() + 2 * 60000; setDue(null); onCheck(h) }}>Check now</button>
      </div>
    </div>
  )
}
