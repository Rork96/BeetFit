// Beet, the in-app assistant: compact context from the user's own data + the chat call.
import { api } from './api.js'
import { dayKey, addDays, targets, eaten, waterOf, program, nextDayIndex, setsLogged, currentWeight } from './day.js'
import { overview } from './coach.js'

export function buildContext(state, today = dayKey()) {
  const p = state.profile, t = targets(state), e = eaten(state, today)
  const ov = overview(state, today)
  const prog = program(state)
  const next = prog.days[nextDayIndex(state, today)]
  const foods = (state.foodLog?.[today] || []).map(f => `${f.name} ${f.kcal} kcal`).slice(0, 12)
  const pain = (state.painFlags || []).filter(f => f.date >= addDays(today, -13)).map(f => `${f.date} ${f.area} during ${f.exercise}${f.note ? ` ("${f.note}")` : ''}`)
  const weights = (state.weightLog || []).slice(-8).map(w => `${w.date} ${w.kg}`)
  const it = state.intake || {}
  const lines = [
    `Name: ${state.settings?.name || 'n/a'}. Units: ${state.settings?.units || 'kg'}.`,
    `Profile: ${p.sex}, ${p.age} y, ${p.heightCm} cm, ${currentWeight(state)} kg now (started ${p.weightKg}), goal ${p.goal}, target ${p.targetKg} kg.`,
    `Setup: trains at ${it.loc || 'n/a'}, ${it.daysWk || prog.days.length} days/week, experience ${it.exp || 'n/a'}${it.injuries ? `, avoid loading: ${it.injuries}` : ''}.`,
    `Daily targets${t.coach ? ' (set by their coach)' : ''}: ${t.kcal} kcal, protein ${t.protein} g, carbs ${t.carbs} g, fat ${t.fat} g, water ${t.water} glasses.`,
    `Today so far: ${e.kcal} kcal, P ${e.p} g, C ${e.c} g, F ${e.f} g; water ${waterOf(state, today)}/${t.water}; ${setsLogged(state, today) ? 'trained today' : 'not trained yet today'}.`,
    foods.length ? `Logged today: ${foods.join('; ')}.` : 'Nothing logged to eat today.',
    `Plan "${prog.name}": ${prog.days.map(d => `${d.name} [${d.exercises.map(x => x.name).join(', ')}]`).join(' | ')}.`,
    next ? `Next session: ${next.name}.` : '',
    `Last 7 days: ${ov.week.sessions}/${ov.week.planned} sessions, food logged ${ov.week.logDays}/7 days${ov.week.kcal ? `, avg ${ov.week.kcal} kcal` : ''}, adherence ${ov.week.adh}%.`,
    weights.length ? `Recent weights (kg): ${weights.join(', ')}${ov.rate != null ? `; trend ${ov.rate} kg/week` : ''}.` : '',
    ov.checkin ? `Latest check-in ${ov.checkin.date}: sleep ${ov.checkin.sleep ?? '?'} h, mood ${ov.checkin.mood ?? '?'}/5, energy ${ov.checkin.energy ?? '?'}/5, hunger ${ov.checkin.hunger ?? '?'}/5.` : '',
    pain.length ? `Pain reports (14 days): ${pain.join('; ')}.` : 'No pain reported recently.',
    state.coach?.name ? `Has a human coach: ${state.coach.name}${state.coach.override?.note ? ` (note: ${state.coach.override.note})` : ''}.` : ''
  ]
  return lines.filter(Boolean).join('\n')
}

export function suggestions(state, today = dayKey()) {
  const e = eaten(state, today), t = targets(state)
  const out = []
  const pain = (state.painFlags || []).filter(f => f.date >= addDays(today, -13)).pop()
  if (pain) out.push(`My ${pain.area.toLowerCase()} hurt during ${pain.exercise}. What can I do instead?`)
  if (e.items === 0) out.push('What should I eat today to hit my protein?')
  else if (t.protein - e.p > 40) out.push(`I’m ${Math.round(t.protein - e.p)} g short on protein. Easy dinner ideas?`)
  out.push(setsLogged(state, today) ? 'How should I recover tonight?' : 'I only have 20 minutes today. What should I do?')
  out.push('Why isn’t my weight moving?')
  out.push('How does the camera count my reps?')
  return out.slice(0, 4)
}

const KEY = 'beetfit_beet_chat'
export const loadChat = () => { try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] } }
export const saveChat = msgs => { try { localStorage.setItem(KEY, JSON.stringify(msgs.slice(-40))) } catch { /* ignore */ } }

export async function askBeet(history, state) {
  return api('/api/chat', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: history.filter(m => !m.error).map(m => ({ role: m.role, text: m.text })), context: buildContext(state), today: dayKey() })
  })
}

export const BEET_ERR = {
  daily_limit: 'That’s today’s 40 questions. Beet is back tomorrow.',
  chat_not_configured: 'Beet isn’t set up on the server yet (GEMINI_API_KEY).',
  unauthorized: 'Server key missing (DEVICE_SECRET).',
  offline: 'No connection. Try again when you’re online.',
  server_error: 'Beet hit a snag. Try again in a moment.'
}
