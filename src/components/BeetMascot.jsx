import React from 'react'
import './mascot.css'

// Beet, the mascot: an original beetroot in the brand palette (violet bulb, lime leaves).
// mood: idle | happy | cheer | tired | think. Pure SVG, no assets; animation lives in mascot.css.
const EYES = {
  idle: <><rect className="bm-eye" x="43" y="62" width="8" height="12" rx="2" /><rect className="bm-eye" x="69" y="62" width="8" height="12" rx="2" /></>,
  think: <><rect className="bm-eye" x="43" y="59" width="8" height="12" rx="2" /><rect className="bm-eye" x="69" y="59" width="8" height="12" rx="2" /></>,
  tired: <><rect x="43" y="68" width="9" height="4" rx="1.5" /><rect x="68" y="68" width="9" height="4" rx="1.5" /></>,
  happy: <><path className="bm-arc" d="M42 70q5-9 10 0" /><path className="bm-arc" d="M68 70q5-9 10 0" /></>,
}
EYES.cheer = EYES.happy

const MOUTH = {
  idle: <path className="bm-arc" d="M52 83q8 6 16 0" />,
  happy: <path className="bm-arc" d="M52 82q8 8 16 0" />,
  cheer: <path d="M49 80h22q-1 13-11 13T49 80z" className="bm-fill" />,
  tired: <path className="bm-arc" d="M54 86h12" />,
  think: <circle className="bm-fill" cx="60" cy="85" r="3.2" />,
}

export default function BeetMascot({ mood = 'idle', size = 96, className = '', title }) {
  const m = MOUTH[mood] ? mood : 'idle'
  return (
    <svg className={`bm ${m} ${className}`} width={size} height={size} viewBox="0 0 120 120" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <linearGradient id="bmBody" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#9a8fff" /><stop offset="1" stopColor="#534DC6" /></linearGradient>
        <linearGradient id="bmLeaf" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#B9E66A" /><stop offset="1" stopColor="#E0FD90" /></linearGradient>
      </defs>
      <ellipse className="bm-shadow" cx="60" cy="113" rx="22" ry="3.5" />
      <g className="bm-body">
        <g className="bm-leaves">
          <path d="M60 40C54 27 56 13 60 4c4 9 6 23 0 36z" fill="url(#bmLeaf)" />
          <path d="M55 41C43 35 31 27 25 14c15 0 28 9 34 25z" fill="url(#bmLeaf)" />
          <path d="M65 41c12-6 24-14 30-27-15 0-28 9-34 25z" fill="url(#bmLeaf)" />
        </g>
        <path d="M60 36c27 0 38 18 36 38-2 18-22 26-34 36h-4C46 100 26 92 24 74c-2-20 9-38 36-38z" fill="url(#bmBody)" />
        <path d="M33 58c3-10 11-16 21-18-9 6-15 15-17 28z" fill="#fff" opacity=".16" />
        {(m === 'happy' || m === 'cheer') && <><ellipse cx="37" cy="79" rx="6" ry="3.6" fill="#E0FD90" opacity=".55" /><ellipse cx="83" cy="79" rx="6" ry="3.6" fill="#E0FD90" opacity=".55" /></>}
        <g className="bm-face">{EYES[m]}{MOUTH[m]}</g>
        {m === 'think' && <g className="bm-dots"><circle cx="92" cy="46" r="2.4" /><circle cx="100" cy="38" r="3.2" /><circle cx="110" cy="28" r="4" /></g>}
      </g>
    </svg>
  )
}
