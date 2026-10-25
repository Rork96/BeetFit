import React, { useEffect, useMemo, useState } from 'react'
import { haptic, hapticSuccess } from '../lib/platform.js'
import { speak } from '../lib/voice.js'

// Pick a routine, then a guided player: timed moves count down and auto-advance, rep moves wait for "Done".
export const ROUTINES = {
  lower: { name: 'Lower body', moves: [['Leg swings', 30], ['Hip circles', 30], ['Bodyweight squats', '10 reps'], ['Glute bridges', '10 reps'], ['Reverse lunges', '6 each'], ['Jumping jacks', 30]] },
  upper: { name: 'Upper body', moves: [['Arm circles', 30], ['Shoulder taps', 30], ['Scap push-ups', '10 reps'], ['Cat-cow', 30], ['Wall slides', '10 reps'], ['Jumping jacks', 30]] },
  full: { name: 'Full body', moves: [['Jumping jacks', 30], ['Arm circles', 30], ['Bodyweight squats', '10 reps'], ['Inchworms', '5 reps'], ['Hip hinges', '10 reps'], ['Leg swings', 30]] },
  quick: { name: 'Quick 2 min', moves: [['Jumping jacks', 45], ['Arm circles', 30], ['Bodyweight squats', '10 reps'], ['Hip hinges', '10 reps']] }
}

const CUES = {
  'Leg swings': 'Hold a wall, swing front to back. Switch legs halfway.',
  'Hip circles': 'Hands on hips, big slow circles. Change direction halfway.',
  'Bodyweight squats': 'Easy depth first, a little deeper each rep.',
  'Glute bridges': 'Squeeze at the top, ribs down.',
  'Reverse lunges': 'Step back softly, torso tall.',
  'Jumping jacks': 'Light on your feet. Breathe.',
  'Arm circles': 'Small to big. Forward, then backward.',
  'Shoulder taps': 'From a high plank, tap the opposite shoulder. Hips still.',
  'Scap push-ups': 'Arms straight — only the shoulder blades move.',
  'Cat-cow': 'On all fours, round then arch the spine slowly.',
  'Wall slides': 'Back to the wall, slide the arms up and down.',
  Inchworms: 'Walk the hands out to plank, then back to the feet.',
  'Hip hinges': 'Soft knees, push the hips back, flat back.'
}

export const suggestRoutine = dayName => (/lower|leg/i.test(dayName) ? 'lower' : /upper|push|pull/i.test(dayName) ? 'upper' : 'full')

const totalSecs = r => r.moves.reduce((a, [, d]) => a + (typeof d === 'number' ? d : 25), 0)

export default function Warmup({ dayName, status, onDone, onSkip }) {
  const [pick, setPick] = useState(() => suggestRoutine(dayName))
  const [i, setI] = useState(-1) // -1 = picker
  const [left, setLeft] = useState(0)
  const [paused, setPaused] = useState(false)
  const r = ROUTINES[pick]
  const move = r.moves[i]
  const timed = move && typeof move[1] === 'number'

  const go = idx => {
    if (idx >= r.moves.length) { hapticSuccess(); speak('Warm-up done'); onDone(pick); return }
    setI(idx)
    const [name, d] = r.moves[idx]
    setLeft(typeof d === 'number' ? d : 0)
    setPaused(false)
    haptic('medium')
    speak(typeof d === 'number' ? `${name}, ${d} seconds` : `${name}, ${d}`)
  }

  useEffect(() => {
    if (i < 0 || !timed || paused) return
    if (left <= 0) { go(i + 1); return }
    if (left <= 3) haptic('light')
    const id = setTimeout(() => setLeft(x => x - 1), 1000)
    return () => clearTimeout(id)
  }, [i, left, paused, timed]) // eslint-disable-line react-hooks/exhaustive-deps

  const mins = useMemo(() => Math.max(1, Math.round(totalSecs(r) / 60)), [r])

  if (status !== 'todo') {
    return (
      <div className="card ss-warm done">
        <div className="row"><span className="label">Warm-up</span><span className="ex-cam">{status === 'skipped' ? 'skipped' : `✓ ${ROUTINES[status]?.name || 'done'}`}</span></div>
      </div>
    )
  }

  if (i < 0) {
    return (
      <div className="card ss-warm">
        <div className="row"><span className="label">Warm-up first</span><span className="td-small num">~{mins} min</span></div>
        <div className="chips wrap">
          {Object.entries(ROUTINES).map(([id, x]) => (
            <button key={id} className={'chip' + (pick === id ? ' on' : '')} onClick={() => { haptic(); setPick(id) }}>{x.name}</button>
          ))}
        </div>
        <ol className="wu-list stk" key={pick}>
          {r.moves.map(([n, d]) => <li key={n}><span>{n}</span><span className="num td-small">{typeof d === 'number' ? `${d} s` : d}</span></li>)}
        </ol>
        <button className="btn" onClick={() => go(0)}>Start warm-up</button>
        <button className="ct-link" style={{ color: 'var(--hint)' }} onClick={onSkip}>Skip warm-up</button>
      </div>
    )
  }

  const R = 34, C = 2 * Math.PI * R
  return (
    <div className="card ss-warm wu-play">
      <div className="row">
        <span className="label">{r.name} · {i + 1}/{r.moves.length}</span>
        <div className="wu-dots">{r.moves.map((_, k) => <i key={k} className={k < i ? 'd' : k === i ? 'c' : ''} />)}</div>
      </div>
      <div className="wu-now" key={i}>
        {timed ? (
          <div className="wu-ring">
            <svg viewBox="0 0 80 80"><circle cx="40" cy="40" r={R} className="trk" /><circle cx="40" cy="40" r={R} className="val" style={{ strokeDasharray: C, strokeDashoffset: C * (1 - left / move[1]) }} /></svg>
            <b className="num">{left}</b>
          </div>
        ) : <div className="wu-reps num">{move[1]}</div>}
        <div>
          <h3>{move[0]}</h3>
          <p className="hint">{CUES[move[0]]}</p>
        </div>
      </div>
      {r.moves[i + 1] && <p className="td-small">Next: {r.moves[i + 1][0]}</p>}
      <div className="row" style={{ gap: 8 }}>
        {timed
          ? <button className="btn secondary" onClick={() => { haptic(); setPaused(p => !p) }}>{paused ? 'Resume' : 'Pause'}</button>
          : <button className="btn" onClick={() => go(i + 1)}>Done</button>}
        <button className="btn secondary" onClick={() => go(i + 1)}>{i + 1 < r.moves.length ? 'Skip move' : 'Finish'}</button>
      </div>
    </div>
  )
}
