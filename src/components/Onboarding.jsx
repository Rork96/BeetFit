import React, { useEffect, useMemo, useState } from 'react'
import { macros, bmr, tdee } from '../lib/calories.js'
import { DEFAULT_INTAKE, PREVPAT, MOTIVEPAT, mkProg, paceInfo, planWhy, activityFrom, exPool, stepsTarget } from '../lib/program.js'
import { EQLABEL } from '../data/library.js'
import { haptic, hapticSuccess } from '../lib/platform.js'
import { useCountUp } from '../lib/hooks.js'
import BodyFigure from './BodyFigure.jsx'
import { S16 } from '../lib/motion.js'
import { claimPairCode } from '../lib/sync.js'
import { SignIn } from './Account.jsx'
import { coachPeek, cleanCode, CODE_RE } from '../lib/coach.js'
import { migrate } from '../lib/store.js'
import './onboarding.css'

const STEPS = ['welcome', 'goal', 'body', 'days', 'training', 'building', 'ready']
const KG_LB = 2.20462

const CLAIM_ERR = {
  bad_code: 'That code is wrong or expired.',
  too_many_tries: 'Too many tries today. Try again tomorrow.',
  sync_not_configured: 'Sync is not set up on the server yet.',
  unauthorized: 'Server key missing. Try again later.',
  offline: 'No connection.'
}

const COACH_ERR = {
  bad_code: "That code isn't recognised. Check it with your coach.",
  own_code: 'That is your own coach code.',
  too_many_tries: 'Too many tries today. Try again tomorrow.',
  sync_not_configured: 'Coaching is not set up on the server yet.',
  unauthorized: 'Server key missing. Try again later.',
  offline: 'No connection.'
}

export default function Onboarding({ onDone, onRestore, account }) {
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [name, setName] = useState('')
  const [units, setUnits] = useState('kg')
  const [p, setP] = useState({ sex: 'male', age: 28, heightCm: 178, weightKg: 82, targetKg: 76, goal: 'lose' })
  const [it, setIt] = useState({ ...DEFAULT_INTAKE })
  const [coach, setCoach] = useState(null) // { code, name } picked on the welcome screen
  const setI = (k, v) => { haptic(); setIt(s => ({ ...s, [k]: v })) }
  const setPf = (k, v) => setP(s => ({ ...s, [k]: v }))

  const id = STEPS[step]
  const go = d => { haptic(); setDir(d); setStep(s => Math.max(0, Math.min(STEPS.length - 1, s + d))); window.scrollTo(0, 0) }

  const profile = useMemo(() => ({ ...p, activity: activityFrom(it) }), [p, it])
  const program = useMemo(() => mkProg(p.goal, it), [p.goal, it])
  const pace = paceInfo(profile, it)
  const valid = p.age >= 14 && p.age <= 100 && p.heightCm >= 120 && p.heightCm <= 230 && p.weightKg >= 35 && p.weightKg <= 250 && p.targetKg >= 35 && p.targetKg <= 250

  // Goal follows the target when the user sets one.
  useEffect(() => {
    const d = p.targetKg - p.weightKg
    if (Math.abs(d) < 0.5 && p.goal !== 'maintain') setPf('goal', 'maintain')
  }, [p.targetKg, p.weightKg]) // eslint-disable-line react-hooks/exhaustive-deps

  const finish = () => {
    hapticSuccess()
    window.scrollTo(0, 0)
    onDone({ profile, intake: it, program, settings: { name: name.trim(), units, waterTarget: 8, stepsTarget: stepsTarget(it) }, coachCode: coach?.code })
  }

  const progress = (step / (STEPS.length - 2)) * 100

  return (
    <div className="ob">
      {id !== 'welcome' && id !== 'building' && (
        <header className="ob-top">
          <button className="ob-back" onClick={() => go(-1)} aria-label="Back">←</button>
          <div className="ob-bar"><i style={{ transform: `scaleX(${Math.min(1, progress / 100)})` }} /></div>
          <span className="label num">{Math.min(step, 5)}/5</span>
        </header>
      )}
      <div className={'ob-step ' + (dir > 0 ? 'fwd' : 'back')} key={id}>
        {id === 'welcome' && <Welcome onStart={c => { setCoach(c || null); go(1) }} onRestore={onRestore} account={account} />}

        {id === 'goal' && (
          <Step title="What's your goal?" sub="Your program, calories and pace are built around it.">
            <div className="ob-cards stk">
              {[['lose', 'Lose fat', 'Calorie deficit, strength kept'], ['maintain', 'Get fit & stay', 'Same weight, more muscle, more energy'], ['gain', 'Build muscle', 'Small surplus, 4 lifting days']].map(([g, t, s]) => (
                <button key={g} className={'ob-card' + (p.goal === g ? ' on' : '')} onClick={() => { haptic(); setPf('goal', g); if (g === 'maintain') setPf('targetKg', p.weightKg) }}>
                  <span className="ob-sq" /><span><b>{t}</b><small>{s}</small></span>
                </button>
              ))}
            </div>
            <label>Your name<input value={name} placeholder="Optional" onChange={e => setName(e.target.value.slice(0, 24))} /></label>
            {p.goal !== 'gain' && (
              <div className="set-row">
                <div><div className="set-l">Add running?</div><div className="hint" style={{ fontSize: 12 }}>One easy run/walk day per week</div></div>
                <button className={'tgl' + (it.running ? ' on' : '')} role="switch" aria-checked={it.running} onClick={() => setI('running', !it.running)}><i /></button>
              </div>
            )}
            <Next onClick={() => go(1)} />
          </Step>
        )}

        {id === 'body' && (
          <Step title="About you" sub="Used for your calorie target. Stays on this device.">
            <div className="grid2">
              <Field label="Units"><Seg value={units} options={[['kg', 'kg / cm'], ['lb', 'lb / ft']]} onChange={setUnits} /></Field>
              <Field label="Sex"><Seg value={p.sex} options={[['male', 'Male'], ['female', 'Female']]} onChange={v => setPf('sex', v)} /></Field>
            </div>
            <div className="grid2">
              <Field label="Age"><Stepper value={p.age} min={14} max={100} onChange={v => setPf('age', v)} /></Field>
              <Field label={units === 'kg' ? 'Height, cm' : 'Height, ft·in'}><Height cm={p.heightCm} units={units} onChange={v => setPf('heightCm', v)} /></Field>
            </div>
            <div className="grid2">
              <Field label={`Weight, ${units}`}><Weight kg={p.weightKg} units={units} onChange={v => setPf('weightKg', v)} /></Field>
              <Field label={`Target, ${units}`}><Weight kg={p.targetKg} units={units} onChange={v => setPf('targetKg', v)} /></Field>
            </div>
            <Field label="Reach it in">
              <div className="row">
                <Stepper value={it.timeframe} min={1} max={18} suffix=" mo" onChange={v => setIt(s => ({ ...s, timeframe: v }))} />
                <div className={'ob-pace ' + pace.tone}>
                  <span className="num">{pace.line}</span>
                  {pace.hint && <small>{pace.hint}</small>}
                </div>
              </div>
              {pace.tone === 'warn' && (
                <button className="chip ob-fix" onClick={() => setI('timeframe', pace.sugg)}>Use {pace.sugg} months</button>
              )}
            </Field>
            <Field label="Work"><Chips value={it.work} options={['sedentary', 'on my feet', 'physical labor']} onChange={v => setI('work', v)} wrap /></Field>
            <Field label="Daily steps now"><Chips value={it.stepsR} options={['<5k', '5–7k', '7–10k', '10k+']} onChange={v => setI('stepsR', v)} /></Field>
            <Next onClick={() => go(1)} disabled={!valid} />
          </Step>
        )}

        {id === 'days' && (
          <Step title="Your days" sub="Honest answers make a better plan — nothing here is judged.">
            <div className="grid2">
              <Field label="Usual sleep"><Stepper value={it.sleepBase} min={4} max={11} step={0.5} suffix=" h" onChange={v => setIt(s => ({ ...s, sleepBase: v }))} /></Field>
              <Field label="Meals per day"><Stepper value={it.mealsN} min={2} max={6} onChange={v => setIt(s => ({ ...s, mealsN: v }))} /></Field>
            </div>
            <Field label="Stress"><Chips value={it.stress} options={['low', 'medium', 'high']} onChange={v => setI('stress', v)} /></Field>
            <Field label="Who cooks"><Chips value={it.cooks} options={['cook at home', 'mix', 'mostly eat out']} onChange={v => setI('cooks', v)} /></Field>
            <Field label="Sugary drinks"><Chips value={it.sugary} options={['never', 'sometimes', 'daily']} onChange={v => setI('sugary', v)} /></Field>
            <Field label="Alcohol"><Chips value={it.alcohol} options={['never', 'sometimes', 'weekly+']} onChange={v => setI('alcohol', v)} /></Field>
            <Field label="Fast food"><Chips value={it.fastfood} options={['rarely', 'weekly', 'often']} onChange={v => setI('fastfood', v)} /></Field>
            <Field label="Overeating"><Chips value={it.overeat} options={['none', 'evening–night', 'weekends']} onChange={v => setI('overeat', v)} /></Field>
            <Next onClick={() => go(1)} />
          </Step>
        )}

        {id === 'training' && (
          <Step title="Training & you" sub="This decides which exercises you get.">
            <Field label="Experience"><Chips value={it.exp} options={['beginner', 'irregular', 'regular']} onChange={v => setI('exp', v)} /></Field>
            <Field label="Where you'll train"><Chips value={it.loc} options={['home, no equipment', 'home, basic', 'gym']} onChange={v => setI('loc', v)} /></Field>
            {it.loc === 'home, basic' && (
              <Field label="Your kit">
                <div className="chips wrap">
                  {['dumbbell', 'kettlebell', 'bands', 'pullup_bar', 'bench'].map(e => {
                    const on = it.ownEq.includes(e)
                    return <button key={e} className={'chip' + (on ? ' on' : '')} onClick={() => setI('ownEq', on ? it.ownEq.filter(x => x !== e) : [...it.ownEq, e])}>{EQLABEL[e]}</button>
                  })}
                </div>
              </Field>
            )}
            <Field label="Days per week"><Stepper value={it.daysWk} min={2} max={5} onChange={v => setIt(s => ({ ...s, daysWk: v }))} /></Field>
            <Field label="Injuries or pain" hint="Movements that load what you name are left out.">
              <input value={it.injuries} placeholder="e.g. left knee, lower back" onChange={e => setIt(s => ({ ...s, injuries: e.target.value.slice(0, 80) }))} />
            </Field>
            <Field label="What happened last time?">
              <Chips value={it.prevAttempt} options={Object.keys(PREVPAT)} onChange={v => setI('prevAttempt', v)} wrap />
            </Field>
            <Field label="What's driving this?">
              <Chips value={it.motive} options={Object.keys(MOTIVEPAT)} onChange={v => setI('motive', v)} wrap />
            </Field>
            <p className="hint num">{exPool(it).length} exercises fit your setup.</p>
            <button className="btn" onClick={() => go(1)}>Build my plan</button>
          </Step>
        )}

        {id === 'building' && <Building it={it} profile={profile} program={program} onDone={() => go(1)} />}

        {id === 'ready' && <Ready profile={profile} it={it} program={program} name={name} onStart={finish} />}
      </div>
    </div>
  )
}

function Welcome({ onStart, onRestore, account }) {
  const [open, setOpen] = useState(null) // null | 'sync' | 'coach'
  const [linkCode, setLinkCode] = useState(false)
  const [note, setNote] = useState('')
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [coach, setCoach] = useState(null)
  const pick = v => { haptic(); setErr(''); setCode(''); setCoach(null); setOpen(open === v ? null : v) }
  const claim = async () => {
    haptic('medium'); setErr(''); setBusy(true)
    const r = await claimPairCode(code)
    setBusy(false)
    if (r.status !== 200) return setErr(CLAIM_ERR[r.error] || 'Could not link. Check your connection.')
    if (!r.data?.profile) return setErr('Linked, but that phone has not synced a plan yet. Open BeetFit there and try again.')
    onRestore(migrate(r.data))
  }
  const peek = async () => {
    haptic('medium'); setErr(''); setBusy(true)
    const r = await coachPeek(code)
    setBusy(false)
    if (r.status !== 200) return setErr(COACH_ERR[r.error] || 'Could not check the code. Check your connection.')
    hapticSuccess(); setCoach({ code, name: r.name })
  }

  if (coach) {
    return (
      <div className="ob-welcome ob-coach">
        <div className="ob-coach-hero stk">
          <div className="ob-coach-mark"><span>{coach.name.trim().charAt(0).toUpperCase()}</span></div>
          <span className="label">Coach found</span>
          <h1>{coach.name}</h1>
          <p>BeetFit builds your program from your answers. {coach.name} sees your logs and check-ins, can message you and can change your calorie and protein targets.</p>
        </div>
        <ul className="ob-privacy stk">
          <li>Your coach sees: weight, meals, workouts, water, check-ins and pain reports.</li>
          <li>Camera video never leaves your phone, not even for your coach.</li>
          <li>Disconnect any time in Settings → Your coach.</li>
        </ul>
        <button className="btn" onClick={() => onStart(coach)}>Continue with {coach.name.split(' ')[0]}</button>
        <button className="btn ghost" onClick={() => pick('coach')}>Start on my own instead</button>
      </div>
    )
  }

  return (
    <div className="ob-welcome">
      <div className="ob-logo"><span /><b>BeetFit</b></div>
      <div className="ob-hero stk">
        <div className="ob-glow" />
        <h1>Your week,<br />built around<br />you.</h1>
        <p>Answer a few questions. BeetFit builds a program that fits your kit, your days and your body — and the camera counts your reps.</p>
      </div>
      <ul className="ob-privacy stk">
        <li>Camera tracking runs on your phone and is never uploaded.</li>
        <li>Your data stays on this device unless you sign in or turn on sync. Export or erase it any time.</li>
        <li>Meal photos go to Google Gemini only when you tap the shutter.</li>
      </ul>
      <button className="btn" onClick={() => onStart(null)}>Get started</button>
      <div className="ob-alt">
        <button className={'chip' + (open === 'sync' ? ' on' : '')} onClick={() => { pick('sync'); setLinkCode(false); setNote('') }}>Sign in</button>
        <button className={'chip' + (open === 'coach' ? ' on' : '')} onClick={() => pick('coach')}>I have a coach code</button>
      </div>
      {open === 'sync' && !linkCode && (
        <div className="ob-claim stk" key="signin">
          <SignIn autoFocus onDone={r => {
            account?.onSignedIn(r)
            if (!r.doc?.data?.profile) setNote('Signed in. This account has no plan yet: tap Get started and it will be saved to your account.')
          }} />
          {note && <p className="hint ob-note">{note}</p>}
          <button className="ac-link" onClick={() => { haptic(); setLinkCode(true) }}>No account? Link with a code from your other phone</button>
        </div>
      )}
      {open === 'sync' && linkCode && (
        <div className="ob-claim stk" key="sync">
          <p className="hint">On your other phone: Settings → Sync & devices → Link another phone. Enter the code here.</p>
          <div className="sy-enter">
            <input inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" value={code} autoFocus
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            <button className="btn" disabled={code.length !== 6 || busy} onClick={claim}>{busy ? 'Linking…' : 'Link'}</button>
          </div>
          {err && <p className="sy-err">{err}</p>}
        </div>
      )}
      {open === 'coach' && (
        <div className="ob-claim stk" key="coach">
          <p className="hint">Your coach sends this with your invite. Six letters and numbers.</p>
          <div className="sy-enter">
            <input autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="K7PQ2X" value={code} autoFocus
              onChange={e => setCode(cleanCode(e.target.value))} />
            <button className="btn" disabled={!CODE_RE.test(code) || busy} onClick={peek}>{busy ? 'Checking…' : 'Connect'}</button>
          </div>
          {err && <p className="sy-err">{err}</p>}
        </div>
      )}
      <p className="hint" style={{ textAlign: 'center', fontSize: 11.5 }}>Not medical advice. Check with a physician before starting a new program.</p>
    </div>
  )
}

function Building({ it, profile, program, onDone }) {
  const kcal = macros(profile).kcal
  const pool = exPool(it).length
  const rows = [
    'Reading your answers',
    `Filtering the library → ${pool} exercises fit ${it.loc === 'gym' ? 'the gym' : 'home'}`,
    it.injuries.trim() ? `Leaving out movements that load: ${it.injuries.trim()}` : 'No injuries flagged',
    `One exercise per movement pattern → ${program.length} days`,
    `${program.flatMap(d => d.exercises).filter(e => e.trackerId).length} exercises set up for camera counting`,
    `Mifflin-St Jeor → ${kcal} kcal a day`
  ]
  const [n, setN] = useState(0)
  useEffect(() => {
    if (n >= rows.length) { const t = setTimeout(onDone, S16 * 6); return () => clearTimeout(t) }
    const t = setTimeout(() => { setN(x => x + 1); haptic() }, S16 * 4)
    return () => clearTimeout(t)
  }, [n]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="ob-build">
      <div className="ob-build-mark"><span /></div>
      <h2>Building your program</h2>
      <ul>
        {rows.slice(0, n).map(r => <li key={r}><i /> {r}</li>)}
      </ul>
    </div>
  )
}

function Ready({ profile, it, program, name, onStart }) {
  const m = macros(profile)
  const kcal = useCountUp(m.kcal, 900)
  const why = planWhy(it, program)
  return (
    <Step title={`${name ? name + ', y' : 'Y'}our plan is ready`} sub={`${program.length} training days · ${it.timeframe} months to target`}>
      <div className="card ob-kcal">
        <span className="label">Daily target</span>
        <div className="ob-kcal-n"><span className="ob-glow sm" /><b className="num">{kcal}</b><small>kcal</small></div>
        <div className="ob-macros">
          <span><b className="num">{m.protein}g</b> protein</span>
          <span><b className="num">{m.carbs}g</b> carbs</span>
          <span><b className="num">{m.fat}g</b> fat</span>
        </div>
        <p className="hint num">BMR {bmr(profile)} · TDEE {tdee(profile)} · activity: {profile.activity}</p>
      </div>
      <div className="card">
        <span className="label">Now → target</span>
        <BodyFigure sex={profile.sex} heightCm={profile.heightCm} startKg={profile.weightKg} currentKg={profile.weightKg} targetKg={profile.targetKg} goal={profile.goal} show="target" height={220} />
        <div className="bf-legend"><span><i className="now" />now {profile.weightKg} kg</span><span><i className="tgt" />in {it.timeframe} months {profile.targetKg} kg</span></div>
      </div>
      <div className="card">
        <span className="label">Why this plan</span>
        <ul className="ob-why stk">{why.map(w => <li key={w}>{w}</li>)}</ul>
      </div>
      <div className="card">
        <span className="label">Your week</span>
        {program.map((d, i) => (
          <div className="ex-row" key={d.name}>
            <span className="ob-day num">{i + 1}</span>
            <div className="ex-main">
              <div className="ex-name">{d.name}</div>
              <div className="ex-meta">{d.exercises.map(e => e.name).join(' · ')}</div>
            </div>
          </div>
        ))}
      </div>
      <button className="btn" onClick={onStart}>Start Day 1</button>
      <p className="hint" style={{ fontSize: 11.5 }}>These are formula estimates, not medical advice. Stop if you feel chest pain, dizziness or sharp joint pain.</p>
    </Step>
  )
}

/* ---------- building blocks ---------- */

function Step({ title, sub, children }) {
  return (
    <div className="page ob-page">
      <div className="hero"><span className="glow" /><h1>{title}</h1></div>
      {sub && <p className="hint">{sub}</p>}
      <div className="ob-fields stk">{children}</div>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div className="ob-field">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="hint" style={{ fontSize: 12 }}>{hint}</span>}
    </div>
  )
}

function Next({ onClick, disabled }) {
  return <button className="btn" disabled={disabled} onClick={onClick}>Continue</button>
}

function Chips({ value, options, onChange, wrap }) {
  return (
    <div className={'chips' + (wrap ? ' wrap' : '')}>
      {options.map(o => <button key={o} className={'chip' + (value === o ? ' on' : '')} onClick={() => onChange(o)}>{o}</button>)}
    </div>
  )
}

function Seg({ value, options, onChange }) {
  return (
    <div className="seg">
      {options.map(([v, l]) => <button key={v} className={value === v ? 'on' : ''} onClick={() => { haptic(); onChange(v) }}>{l}</button>)}
    </div>
  )
}

function Stepper({ value, min, max, step = 1, suffix = '', onChange }) {
  const set = v => { haptic(); onChange(Math.max(min, Math.min(max, Math.round(v * 10) / 10))) }
  return (
    <div className="fc-step mini">
      <button onClick={() => set(value - step)} aria-label="Less">−</button>
      <span className="num">{value}{suffix && <small>{suffix}</small>}</span>
      <button onClick={() => set(value + step)} aria-label="More">+</button>
    </div>
  )
}

function Weight({ kg, units, onChange }) {
  const shown = units === 'lb' ? Math.round(kg * KG_LB) : kg
  return (
    <input type="number" inputMode="decimal" value={shown}
      onChange={e => { const v = +e.target.value; if (!isNaN(v)) onChange(units === 'lb' ? Math.round((v / KG_LB) * 2) / 2 : v) }} />
  )
}

function Height({ cm, units, onChange }) {
  if (units === 'kg') return <input type="number" inputMode="numeric" value={cm} onChange={e => onChange(+e.target.value)} />
  const totalIn = Math.round(cm / 2.54)
  const ft = Math.floor(totalIn / 12), inch = totalIn % 12
  const set = (f, i) => onChange(Math.round((f * 12 + i) * 2.54))
  return (
    <div className="ob-ftin">
      <input type="number" inputMode="numeric" value={ft} onChange={e => set(+e.target.value, inch)} aria-label="Feet" /><span>ft</span>
      <input type="number" inputMode="numeric" value={inch} onChange={e => set(ft, +e.target.value)} aria-label="Inches" /><span>in</span>
    </div>
  )
}
