import React, { useEffect, useRef, useState } from 'react'
import { bodyJourney, bodyShapes, mixParams, VIEWBOX } from '../lib/bodyShape.js'
import { reducedMotion } from '../lib/motion.js'

// Body silhouette from Pavlo's parametric model (lib/bodyShape.js).
// Layers: start outline (faint), target ghost (lime dashed), current body (lime gradient fill).
// When the weight changes the shape morphs: every path has a fixed point count, so we tween the params.
export default function BodyFigure({ sex = 'male', heightCm, startKg, currentKg, targetKg, goal, show = 'all', height = 260, idle = true }) {
  const j = bodyJourney({ sex, heightCm, startKg, targetKg, goal: goal === 'maintain' ? 'auto' : goal })
  const want = j.at(currentKg)
  const [p, setP] = useState(want)
  const [pulse, setPulse] = useState(0)
  const from = useRef(want)

  useEffect(() => {
    const a = from.current, b = want
    if (Math.abs(a.fat - b.fat) + Math.abs(a.muscle - b.muscle) < 0.002) return
    setPulse(x => x + 1)
    if (reducedMotion()) { from.current = b; setP(b); return }
    const t0 = performance.now(), ms = 700
    let raf
    const step = now => {
      const t = Math.min(1, (now - t0) / ms)
      const e = 1 - Math.pow(1 - t, 3)
      setP(mixParams(a, b, e))
      if (t < 1) raf = requestAnimationFrame(step)
      else from.current = b
    }
    raf = requestAnimationFrame(step)
    return () => { cancelAnimationFrame(raf); from.current = b }
  }, [want.fat, want.muscle]) // eslint-disable-line react-hooks/exhaustive-deps

  const cur = bodyShapes(p)
  const tgt = bodyShapes(j.target)
  const st = bodyShapes(j.start)
  const vb = `${VIEWBOX.x} ${VIEWBOX.y} ${VIEWBOX.w} ${VIEWBOX.h + 14}`
  const gid = useRef('bf' + Math.random().toString(36).slice(2, 7)).current

  return (
    <svg viewBox={vb} style={{ height, width: 'auto', display: 'block', margin: '0 auto', overflow: 'visible' }} role="img"
      aria-label={`Body at ${currentKg} kg, target ${targetKg} kg`}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity=".55" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity=".14" />
        </linearGradient>
      </defs>
      <ellipse cx="0" cy={VIEWBOX.h - 6} rx="54" ry="7" fill="rgba(0,0,0,.35)" />

      {show === 'all' && <Outline s={st} stroke="rgba(255,255,255,.18)" dash="" />}
      {show !== 'current' && <Outline s={tgt} stroke="var(--accent)" dash="5 5" opacity=".75" />}

      <g className={idle ? 'bf-breathe' : ''} key={pulse} style={{ transformOrigin: '0px 420px' }}>
        <g className="bf-pulse">
          <path d={cur.armL} fill={`url(#${gid})`} stroke="var(--accent)" strokeWidth="1.2" />
          <path d={cur.armR} fill={`url(#${gid})`} stroke="var(--accent)" strokeWidth="1.2" />
          <path d={cur.torso} fill={`url(#${gid})`} stroke="var(--accent)" strokeWidth="1.4" />
          {cur.hair && <path d={cur.hair} fill="var(--accent)" opacity=".35" />}
          <ellipse {...cur.head} fill={`url(#${gid})`} stroke="var(--accent)" strokeWidth="1.4" />
          <path d={cur.definition} fill="none" stroke="var(--rork-ink)" strokeWidth="1.3" strokeLinecap="round" opacity={cur.definitionOpacity} />
        </g>
      </g>
    </svg>
  )
}

function Outline({ s, stroke, dash, opacity = 1 }) {
  const common = { fill: 'none', stroke, strokeWidth: 1.3, strokeDasharray: dash || undefined, opacity }
  return (
    <g>
      <path d={s.armL} {...common} />
      <path d={s.armR} {...common} />
      <path d={s.torso} {...common} />
      <ellipse {...s.head} {...common} />
    </g>
  )
}
