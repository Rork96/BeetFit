import React from 'react'

// One icon set for the whole app: 24 grid, 1.8 stroke, round joins. `.f` parts take a soft fill
// (accent-soft) when the parent is active, so tab icons read as "on" without changing shape.
const P = {
  today: <><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17" /><rect className="f" x="8" y="13" width="4" height="4" rx="1" /></>,
  train: <><rect className="f" x="5" y="6.5" width="3.5" height="11" rx="1" /><rect className="f" x="15.5" y="6.5" width="3.5" height="11" rx="1" /><path d="M2.5 9.5v5M21.5 9.5v5M8.5 12h7" /></>,
  food: <><path className="f" d="M3 12h18a9 8 0 0 1-18 0z" /><path d="M8 20.5h8M9 3.5c-1 1.4 1 2.3 0 4.5M14.5 3.5c-1 1.4 1 2.3 0 4.5" /></>,
  beet: <><path className="f" d="M12 9c4.4 0 6.6 2.8 6.2 6.1-.4 3.2-3.9 4.6-6.2 7-2.3-2.4-5.8-3.8-6.2-7C5.4 11.8 7.6 9 12 9z" /><path d="M12 9c-.8-2-.8-4.2 0-6.5M11.4 9C9.8 7.5 7.8 6.7 5.5 6.8M12.6 9c1.6-1.5 3.6-2.3 5.9-2.2" /></>,
  progress: <><path d="M3.5 20.5h17" /><path className="f" d="M4 16l5-5 3.5 3L20 6.5V17H4z" stroke="none" /><path d="M4 16l5-5 3.5 3L20 6.5" /><path d="M15.5 6.5H20V11" /></>,
  cam: <><path className="f" d="M3.5 8.5a2 2 0 0 1 2-2h2.2L9.2 4.5h5.6l1.5 2h2.2a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="3.4" /></>,
  water: <path className="f" d="M12 3.5s6 6.4 6 10.8a6 6 0 0 1-12 0C6 9.9 12 3.5 12 3.5z" />,
  flame: <path className="f" d="M12 21c-3.9 0-6.5-2.7-6.5-6.2 0-3.6 2.6-5.3 3.6-8.3 1.6 1.1 2.4 2.5 2.6 4 1-1.1 1.5-2.6 1.4-5.5 3.3 2 5.4 5.6 5.4 9.6 0 3.6-2.6 6.4-6.5 6.4z" />,
  protein: <><path className="f" d="M12 3.5c3.6 0 6.5 5 6.5 9.4 0 4.1-2.9 7.6-6.5 7.6s-6.5-3.5-6.5-7.6c0-4.4 2.9-9.4 6.5-9.4z" /></>,
  carbs: <><path d="M12 21V8" /><path className="f" d="M12 8c-2.4 0-3.5-1.8-3.5-4.5C11 3.5 12 5.3 12 8zM12 8c2.4 0 3.5-1.8 3.5-4.5C13 3.5 12 5.3 12 8zM12 13c-2.6 0-4-1.6-4.3-4.3 2.7 0 4.3 1.7 4.3 4.3zM12 13c2.6 0 4-1.6 4.3-4.3-2.7 0-4.3 1.7-4.3 4.3zM12 18c-2.6 0-4-1.6-4.3-4.3 2.7 0 4.3 1.7 4.3 4.3zM12 18c2.6 0 4-1.6 4.3-4.3-2.7 0-4.3 1.7-4.3 4.3z" /></>,
  fat: <><path className="f" d="M12 4c2.8 3.2 5 6.2 5 9.3a5 5 0 0 1-10 0C7 10.2 9.2 7.2 12 4z" /><path d="M10 14.5a2 2 0 0 0 2 2" /></>,
  scale: <><rect className="f" x="3.5" y="3.5" width="17" height="17" rx="4" /><path d="M8.5 9.5a5 5 0 0 1 7 0L12 12.5z" /></>,
  target: <><circle cx="12" cy="12" r="8.5" /><circle className="f" cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></>,
  trend: <><path d="M3.5 7.5l6 6 3.5-3.5 7.5 7.5" /><path d="M15 17.5h5.5V12" /></>,
  sets: <><rect className="f" x="3.5" y="9" width="4" height="6" rx="1" /><rect className="f" x="10" y="9" width="4" height="6" rx="1" /><rect x="16.5" y="9" width="4" height="6" rx="1" /></>,
  reps: <><path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" /><path d="M18 3v4h-4M6 21v-4h4" /></>,
  weight: <><circle className="f" cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="2.6" /></>,
  lock: <><rect className="f" x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" /></>,
  phone: <><rect className="f" x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M10.5 18.5h3" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  timer: <><circle className="f" cx="12" cy="13.5" r="7.5" /><path d="M12 13.5V10M10 2.5h4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  chevron: <path d="M9 5.5l6.5 6.5L9 18.5" />,
}

export default function Ic({ n, size, className = '', label }) {
  return (
    <svg className={'ic ' + className} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {label && <title>{label}</title>}
      {P[n]}
    </svg>
  )
}

export const ICONS = Object.keys(P)

// Number tile led by an icon; the word lives in aria-label/title, not on screen.
export function Stat({ icon, v, unit, label, color }) {
  return (
    <div className="stat ist" title={label} aria-label={`${label}: ${v}${unit ? ' ' + unit : ''}`}>
      <span className="ist-i" style={color ? { color } : undefined}><Ic n={icon} className="solid" /></span>
      <div className="v">{v}{unit && <small>{unit}</small>}</div>
    </div>
  )
}
