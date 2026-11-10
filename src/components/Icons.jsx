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
  protein: <><path className="f" d="M13.4 13.7c-3-.8-4.6-4.2-3.2-7.1 1.3-2.8 4.8-3.9 7.5-2.4 2.6 1.5 3.4 5 1.6 7.5-1.4 1.9-3.8 2.7-5.9 2z" /><path d="M12.6 13.3l-4.4 4.4" /><circle cx="6.4" cy="17.4" r="1.6" /><circle cx="7.9" cy="19.6" r="1.6" /></>,
  carbs: <><path className="f" d="M5.5 10.6C4 10.1 3.3 9 3.3 7.8 3.3 5.5 5.8 4 8.6 4h6.8c2.8 0 5.3 1.5 5.3 3.8 0 1.2-.7 2.3-2.2 2.8V19a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19z" /></>,
  fat: <><path className="f" d="M12 3c-2.6 0-4.3 3.2-5.2 6.4C5.7 13.1 5 15 5 16.6 5 19.1 7.9 21 12 21s7-1.9 7-4.4c0-1.6-.7-3.5-1.8-7.2C16.3 6.2 14.6 3 12 3z" /><circle cx="12" cy="15.6" r="2.6" /></>,
  scale: <><rect className="f" x="3.5" y="3.5" width="17" height="17" rx="4" /><path d="M8.5 9.5a5 5 0 0 1 7 0L12 12.5z" /></>,
  target: <><circle cx="12" cy="12" r="8.5" /><circle className="f" cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></>,
  trend: <><path d="M3.5 7.5l6 6 3.5-3.5 7.5 7.5" /><path d="M15 17.5h5.5V12" /></>,
  sets: <><rect className="f" x="3.5" y="9" width="4" height="6" rx="1" /><rect className="f" x="10" y="9" width="4" height="6" rx="1" /><rect x="16.5" y="9" width="4" height="6" rx="1" /></>,
  reps: <><path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" /><path d="M18 3v4h-4M6 21v-4h4" /></>,
  weight: <><circle className="f" cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="2.6" /></>,
  lock: <><rect className="f" x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" /></>,
  phone: <><rect className="f" x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M10.5 18.5h3" /></>,
  barcode: <><path d="M3.5 7.5v-3h3M17.5 4.5h3v3M20.5 16.5v3h-3M6.5 19.5h-3v-3" /><path d="M7.5 8v8M10 8v8M13 8v8M16.5 8v8" /></>,
  people: <><circle className="f" cx="9" cy="8.5" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><circle cx="17" cy="9.5" r="2.6" /><path d="M17.5 14.6c2.3.3 3.7 1.9 4 4.4" /></>,
    sunrise: <><path d="M3.5 18.5h17M7 18.5a5 5 0 0 1 10 0M12 4.5v3M5.4 9.4l1.8 1.8M18.6 9.4l-1.8 1.8" /></>,
  sun: <><circle className="f" cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" /></>,
  moon: <path className="f" d="M19.5 14.6A7.8 7.8 0 1 1 9.4 4.5a6.3 6.3 0 0 0 10.1 10.1z" />,
  apple: <><path className="f" d="M12 7.5c-1.5-1.1-5.4-1.3-6.4 2.2-1.1 3.7 1.6 10.8 4.1 10.8 1 0 1.3-.6 2.3-.6s1.3.6 2.3.6c2.5 0 5.2-7.1 4.1-10.8-1-3.5-4.9-3.3-6.4-2.2z" /><path d="M12 7.5c0-1.7.8-3 2.4-3.8" /></>,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></>,
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

// Free-tier allowance as pips: filled = left today. Caps at 10 pips so big limits stay one line.
export function Pips({ left, limit }) {
  if (left == null || !limit || limit > 10) return null
  return <span className="pips" aria-hidden="true">{Array.from({ length: limit }, (_, i) => <i key={i} className={i < left ? 'on' : ''} />)}</span>
}
