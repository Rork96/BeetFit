import React from 'react'

// Body silhouette parameterized by BMI. w(part) interpolates slim(BMI 17) → heavy(BMI 40).
function widthFor(bmiVal, slim, heavy) {
  const t = Math.min(1, Math.max(0, (bmiVal - 17) / 23))
  return slim + (heavy - slim) * t
}

export default function Avatar({ bmiValue, ghostBmi, height = 220 }) {
  const draw = (v, opacity, color) => {
    const torso = widthFor(v, 20, 52)
    const belly = widthFor(v, 18, 60)
    const hips = widthFor(v, 19, 50)
    const thigh = widthFor(v, 8, 20)
    const arm = widthFor(v, 5, 12)
    const neck = widthFor(v, 5, 11)
    const cx = 80
    return (
      <g opacity={opacity} fill={color}>
        <circle cx={cx} cy={22} r={14} />
        <rect x={cx - neck} y={34} width={neck * 2} height={8} rx={3} />
        {/* torso: shoulders → belly → hips */}
        <path d={`
          M ${cx - torso} 42
          C ${cx - torso - 4} 70, ${cx - belly - 4} 95, ${cx - hips} 122
          L ${cx + hips} 122
          C ${cx + belly + 4} 95, ${cx + torso + 4} 70, ${cx + torso} 42
          Z`} />
        {/* arms */}
        <rect x={cx - torso - arm * 2 - 2} y={44} width={arm * 2} height={62} rx={arm} />
        <rect x={cx + torso + 2} y={44} width={arm * 2} height={62} rx={arm} />
        {/* legs */}
        <rect x={cx - hips + 2} y={122} width={thigh * 2} height={74} rx={thigh} />
        <rect x={cx + hips - thigh * 2 - 2} y={122} width={thigh * 2} height={74} rx={thigh} />
      </g>
    )
  }

  return (
    <svg viewBox="0 0 160 200" style={{ height, display: 'block', margin: '0 auto' }}>
      {ghostBmi != null && draw(ghostBmi, 0.25, 'var(--ok)')}
      {draw(bmiValue, 1, 'var(--accent)')}
    </svg>
  )
}
