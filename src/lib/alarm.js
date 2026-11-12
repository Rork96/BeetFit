// A ringing alarm for habit time while the app is open (a web page can't play a custom sound from a push; the system plays its own).
let ctx = null, timer = null, stopAt = 0

const beep = (t0, f, dur = 0.16) => {
  const o = ctx.createOscillator(), g = ctx.createGain()
  o.type = 'sine'; o.frequency.value = f
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + dur + 0.02)
}

export function alarmSupported() { return typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext) }

// Rings (three rising beeps, a pause, repeat) until stopAlarm() or `maxMs`. Silent if the browser hasn't allowed audio yet (no tap in this session).
export function startAlarm(maxMs = 60000) {
  if (timer || !alarmSupported()) return false
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  } catch { return false }
  stopAt = Date.now() + maxMs
  const round = () => {
    if (Date.now() > stopAt) return stopAlarm()
    if (ctx.state === 'running') { const t = ctx.currentTime + 0.05; beep(t, 660); beep(t + 0.22, 880); beep(t + 0.44, 1100, 0.28) }
    try { navigator.vibrate?.([300, 150, 300]) } catch { /* ignore */ }
  }
  round(); timer = setInterval(round, 1600)
  return true
}
export function stopAlarm() {
  if (timer) { clearInterval(timer); timer = null }
  try { navigator.vibrate?.(0) } catch { /* ignore */ }
}
export const alarmRinging = () => !!timer

// Which habit should be ringing right now: loud, on, scheduled today, not done, inside the 15 minutes after its time, not snoozed.
export function dueHabit(habits, state, now, key, isScheduled, isDone, snoozed = {}) {
  const mins = now.getHours() * 60 + now.getMinutes()
  return habits.find(h => {
    if (!h.on || h.loud === false || !isScheduled(h, key) || isDone(state, h.id, key)) return false
    if ((snoozed[h.id] || 0) > now.getTime()) return false
    const at = h.h * 60 + h.m
    return mins >= at && mins < at + 15
  }) || null
}
