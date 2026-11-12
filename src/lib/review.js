// AI review of the generated plan. The server validates every swap against the same rules that built the plan.
import { api } from './api.js'

const cache = new Map() // same plan + answers → same review, so going back and forth costs nothing
const keyOf = (intake, program) => JSON.stringify([intake, program.map(d => d.exercises.map(e => e.id))])

export async function fetchReview(profile, intake, program) {
  const k = keyOf(intake, program)
  if (cache.has(k)) return cache.get(k)
  const r = await api('/api/program/review', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ profile, intake, program }) })
  if (r.status === 200 && r.summary) cache.set(k, r)
  return r
}

export const REVIEW_ERR = {
  offline: 'No connection.',
  daily_limit: 'You have used today’s reviews. Try again tomorrow.',
  review_not_configured: 'Reviews are not switched on yet.',
  no_review: 'Couldn’t write a review this time. Try again.',
  bad_request: 'Couldn’t read the plan. Try again.'
}
