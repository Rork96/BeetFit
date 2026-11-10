import React, { useEffect, useRef, useState } from 'react'
import Ic, { Pips } from '../components/Icons.jsx'
import { MacroRing, MacroTiles, MacroChips, MacroBar, KcalRange } from '../components/Nutri.jsx'
import BeetMascot from '../components/BeetMascot.jsx'
import { useCamera } from './useCamera.js'
import { getBarcodeDetector, validGtin } from './barcode.js'
import { lookupBarcode, snapMeal, warmApi } from '../lib/api.js'
import { SAUCES, COMMON_SAUCES, sauceItem } from '../data/sauces.js'
import { haptic, hapticError, hapticSuccess } from '../lib/platform.js'
import { fetchStatus, useUsage, usageLeft } from '../lib/billing.js'
import { FAT_OPTIONS, fatItem, kcalRange } from '../lib/foods.js'
import './camera.css'
import './food.css'

// One camera screen, two modes: barcode scan (Open Food Facts) and meal photo (Gemini via the Worker).
// onAdd(items) receives [{ name, grams, kcal, p, c, f, source, code? }].
export default function FoodCamera({ initialMode = 'barcode', slotLabel = 'today', onAdd, onClose, onUpgrade }) {
  const cam = useCamera({ facing: 'environment', width: 1280, height: 720 })
  const [mode, setMode] = useState(initialMode)
  const [preset, setPreset] = useState(null) // barcode typed by hand while the camera is unavailable
  const camFailed = ['denied', 'unavailable', 'error'].includes(cam.status)

  return (
    <div className="ct fc" data-mode={mode}>
      <video ref={cam.videoRef} className="ct-video" playsInline muted />
      <div className="ct-vignette" />
      <header className="ct-top">
        <div>
          <div className="ct-title">{mode === 'barcode' ? 'Scan barcode' : 'Snap your meal'}</div>
          <div className="fc-seg">
            <button className={mode === 'barcode' ? 'on' : ''} onClick={() => { haptic(); setMode('barcode') }}>Barcode</button>
            <button className={mode === 'snap' ? 'on' : ''} onClick={() => { haptic(); setMode('snap') }}>Photo</button>
          </div>
        </div>
        <div className="ct-actions">
          {cam.torch.supported && (
            <button className={'ct-icon' + (cam.torch.on ? ' on' : '')} onClick={() => cam.setTorch(!cam.torch.on)} aria-label="Torch">ϟ</button>
          )}
          <button className="ct-btn ghost" onClick={onClose}>Cancel</button>
        </div>
      </header>

      {camFailed && mode === 'barcode' && !preset ? (
        <div className="ct-sheet stk">
          <div className="ct-h">{cam.status === 'denied' ? 'Camera access is off' : 'Camera unavailable'}</div>
          <p className="ct-p">Allow camera access for BeetFit in your browser or phone settings to scan barcodes or photograph a meal. Nothing leaves your device until you take a photo.</p>
          <button className="ct-btn" onClick={() => cam.start()}>Try again</button>
          {mode === 'barcode' && <ManualCode onCode={setPreset} />}
        </div>
      ) : mode === 'snap' ? (
        <SnapFlow cam={cam} slotLabel={slotLabel} onAdd={onAdd} onUpgrade={onUpgrade} />
      ) : (
        <BarcodeFlow cam={cam} slotLabel={slotLabel} onAdd={onAdd} presetCode={preset} key={preset || 'scan'} />
      )}
    </div>
  )
}

/* ---------------- Barcode ---------------- */

function BarcodeFlow({ cam, slotLabel, onAdd, presetCode }) {
  const [stage, setStage] = useState(presetCode ? 'lookup' : 'scan') // scan | lookup | found | notfound | error
  const [code, setCode] = useState(presetCode)
  const [item, setItem] = useState(null)
  const busy = useRef(false)

  useEffect(() => { if (presetCode) lookup(presetCode) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (stage !== 'scan' || cam.status !== 'live') return
    let alive = true, id
    getBarcodeDetector().then(det => {
      const tick = async () => {
        if (!alive) return
        const v = cam.videoRef.current
        if (v && v.readyState >= 2 && !busy.current) {
          busy.current = true
          try {
            const found = await det.detect(v)
            const hit = found.map(f => f.rawValue).find(validGtin)
            if (hit && alive) { haptic('medium'); lookup(hit); return }
          } catch { /* frame not ready */ } finally { busy.current = false }
        }
        id = setTimeout(tick, 180)
      }
      tick()
    }).catch(() => alive && setStage('error'))
    return () => { alive = false; clearTimeout(id) }
  }, [stage, cam.status]) // eslint-disable-line react-hooks/exhaustive-deps

  const [fileMiss, setFileMiss] = useState(false)
  async function scanFile(file) {
    if (!file) return
    setFileMiss(false)
    try {
      const det = await getBarcodeDetector()
      const bmp = await createImageBitmap(file)
      const hit = (await det.detect(bmp)).map(f => f.rawValue).find(validGtin)
      if (hit) { haptic('medium'); lookup(hit) } else { hapticError(); setFileMiss(true) }
    } catch { setFileMiss(true) }
  }

  async function lookup(c) {
    setCode(c); setStage('lookup')
    try {
      const r = await lookupBarcode(c)
      if (r.found) { setItem(r.item); setStage('found'); hapticSuccess() } else { setStage('notfound'); hapticError() }
    } catch { setStage('notfound') }
  }

  return (
    <>
      <div className={'fc-frame bar' + (stage === 'found' ? ' hit' : '')}>
        {stage === 'scan' && <i className="fc-scan" />}
        <b /><b /><b /><b />
      </div>
      <div className="ct-sheet">
        {stage === 'scan' && (
          <>
            <p className="ct-p center">Point the frame at a product barcode</p>
            <div className="fc-shoot">
              <PickPhoto onFile={scanFile} label="From photo" />
              <ManualCode onCode={lookup} />
            </div>
            {fileMiss && <p className="ct-p dim center">No barcode found in that photo. Try a sharper, closer shot.</p>}
          </>
        )}
        {stage === 'lookup' && (
          <div className="fc-look">
            <div className="ct-h sm">Looking up product…</div>
            <div className="ct-p dim">Open Food Facts · <span className="num">{code}</span></div>
            <div className="fc-skel"><i /><i /></div>
          </div>
        )}
        {stage === 'found' && item && (
          <PortionCard item={item} slotLabel={slotLabel} onAdd={g => onAdd([portion(item, g)])} onRescan={() => setStage('scan')} />
        )}
        {stage === 'notfound' && (
          <CustomFood code={code} slotLabel={slotLabel} onAdd={x => onAdd([x])} onRescan={() => setStage('scan')} />
        )}
        {stage === 'error' && (
          <>
            <div className="ct-h sm">Scanner failed to load</div>
            <ManualCode onCode={lookup} />
          </>
        )}
      </div>
    </>
  )
}

function ManualCode({ onCode }) {
  const [open, setOpen] = useState(false)
  const [v, setV] = useState('')
  if (!open) return <button className="ct-link" onClick={() => setOpen(true)}>Type the number instead</button>
  const ok = validGtin(v)
  return (
    <div className="fc-manual">
      <input inputMode="numeric" autoFocus placeholder="EAN / UPC digits" value={v} onChange={e => setV(e.target.value.replace(/\D/g, '').slice(0, 14))} />
      <button className="ct-btn" disabled={!ok} onClick={() => onCode(v)}>Look up</button>
    </div>
  )
}

const portion = (item, g) => ({
  name: item.brand ? `${item.name} · ${item.brand}` : item.name,
  grams: g,
  kcal: Math.round((item.per100.kcal * g) / 100),
  p: Math.round((item.per100.p * g) / 10) / 10,
  c: Math.round((item.per100.c * g) / 10) / 10,
  f: Math.round((item.per100.f * g) / 10) / 10,
  source: item.source, code: item.code
})

function PortionCard({ item, slotLabel, onAdd, onRescan, backLabel = 'Scan another' }) {
  const [g, setG] = useState(Math.round(item.servingG || 100))
  const x = portion(item, g)
  return (
    <div className="fc-card">
      <div className="fc-prod">
        {item.image ? <img src={item.image} alt="" /> : <span className="fc-ph"><Ic n={item.code ? 'barcode' : 'food'} /></span>}
        <div style={{ minWidth: 0 }}>
          <div className="fc-name">{item.name}</div>
          <div className="fc-tags">
            <span className="fc-tag">{item.brand || (item.source === 'usda' ? 'USDA' : 'Open Food Facts')}</span>
            <span className="fc-tag num" aria-label={`${item.per100.kcal} kcal per 100 g`}><Ic n="flame" />{item.per100.kcal}<small>/100g</small></span>
          </div>
        </div>
      </div>
      <div className="fc-portion">
        <MacroRing kcal={x.kcal} p={x.p} c={x.c} f={x.f} size={104} />
        <div className="fc-portion-r">
          <span className="label">Portion</span>
          <Stepper value={g} onChange={setG} step={g >= 100 ? 25 : 10} unit="g" />
          <MacroChips p={x.p} c={x.c} f={x.f} />
        </div>
      </div>
      <button className="ct-btn" onClick={() => { hapticSuccess(); onAdd(g) }}>Add to {slotLabel}</button>
      <button className="ct-link" onClick={onRescan}>{backLabel}</button>
    </div>
  )
}

function CustomFood({ code, slotLabel, onAdd, onRescan }) {
  const [f, setF] = useState({ name: '', kcal: '', p: '', c: '', f: '', grams: 100 })
  const set = k => e => setF(s => ({ ...s, [k]: e.target.value }))
  const ok = f.name.trim() && +f.kcal > 0
  const add = () => {
    const item = { source: 'custom', code, name: f.name.trim(), brand: null, per100: { kcal: +f.kcal, p: +f.p || 0, c: +f.c || 0, f: +f.f || 0 } }
    hapticSuccess(); onAdd(portion(item, +f.grams || 100))
  }
  return (
    <div className="fc-card">
      <div className="ct-h sm">Not in the database yet</div>
      <div className="fc-chip"><Ic n="barcode" /> <span className="num">{code}</span></div>
      <input placeholder="Product name" value={f.name} onChange={set('name')} />
      <div className="fc-grid">
        <label><span><Ic n="flame" />kcal/100g</span><input inputMode="decimal" value={f.kcal} onChange={set('kcal')} /></label>
        <label style={{ '--c': 'var(--accent)' }}><span><Ic n="protein" className="solid" />protein</span><input inputMode="decimal" value={f.p} onChange={set('p')} /></label>
        <label style={{ '--c': 'var(--data-2)' }}><span><Ic n="carbs" className="solid" />carbs</span><input inputMode="decimal" value={f.c} onChange={set('c')} /></label>
        <label style={{ '--c': 'var(--water)' }}><span><Ic n="fat" className="solid" />fat</span><input inputMode="decimal" value={f.f} onChange={set('f')} /></label>
      </div>
      <Stepper value={+f.grams} onChange={v => setF(s => ({ ...s, grams: v }))} step={10} unit="g" />
      <button className="ct-btn" disabled={!ok} onClick={add}>Save & add to {slotLabel}</button>
      <button className="ct-link" onClick={onRescan}>Scan again</button>
    </div>
  )
}

/* ---------------- Snap ---------------- */

function SnapFlow({ cam, slotLabel, onAdd, onUpgrade }) {
  const [stage, setStage] = useState('idle') // idle | busy | result | error
  const [res, setRes] = useState(null)
  const [err, setErr] = useState(null)
  const [shot, setShot] = useState(null)
  const [moreSauces, setMoreSauces] = useState(false)
  const [fat, setFat] = useState(null) // id from FAT_OPTIONS; asked every time because photos can't see oil
  useEffect(() => { warmApi(); if (onUpgrade) fetchStatus() }, [onUpgrade])
  const usage = useUsage()
  const left = usageLeft(usage, 'snaps')

  async function take() {
    haptic('heavy')
    analyze(await cam.capture(1024))
  }
  async function fromFile(file) {
    if (!file) return
    haptic()
    analyze(await resizeImage(file, 1024))
  }
  async function analyze(blob) {
    if (!blob) return
    setShot(URL.createObjectURL(blob))
    setStage('busy')
    const r = await snapMeal(blob).catch(() => ({ error: 'network' }))
    if (onUpgrade) fetchStatus()
    if (r.items?.length) {
      setRes({ title: r.title, items: r.items.map((it, i) => ({ ...it, id: i, base: it.grams })) })
      setFat(null)
      setStage('result'); hapticSuccess()
    } else {
      setErr(explain(r))
      setStage('error'); hapticError()
    }
  }
  useEffect(() => () => shot && URL.revokeObjectURL(shot), [shot])

  const addSauce = sc => {
    haptic()
    const it = sauceItem(sc)
    setRes(r => ({ ...r, items: [...r.items, { ...it, id: Math.max(-1, ...r.items.map(x => x.id)) + 1, base: it.grams, confidence: 1, extra: true }] }))
  }
  const dropItem = id => setRes(r => ({ ...r, items: r.items.filter(x => x.id !== id) }))

  const scaled = it => {
    const k = it.grams / it.base
    return { ...it, kcal: Math.round(it.kcal * k), p: Math.round(it.p * k * 10) / 10, c: Math.round(it.c * k * 10) / 10, f: Math.round(it.f * k * 10) / 10 }
  }

  return (
    <>
      {shot && stage !== 'idle' && <img className="fc-shot" src={shot} alt="" />}
      {stage === 'idle' && (
        <>
          <div className="fc-frame plate"><b /><b /><b /><b /></div>
          <div className="ct-sheet center">
            <p className="ct-p center">{cam.status === 'live' ? 'Get the whole plate in frame' : 'Camera is off — upload a photo of your meal instead'}</p>
            {onUpgrade && left != null && (
              <button className={'fc-meter' + (left === 0 ? ' out' : '')} onClick={() => { haptic(); onUpgrade('snap') }}>
                <Pips left={left} limit={usage?.snaps?.limit} /><span className="num">{left}</span> free photo {left === 1 ? 'estimate' : 'estimates'} left today
              </button>
            )}
            <div className="fc-shoot">
              <PickPhoto onFile={fromFile} label="Upload" />
              <button className="fc-shutter" onClick={take} disabled={cam.status !== 'live'} aria-label="Take photo"><i /></button>
              <span style={{ width: 64 }} />
            </div>
          </div>
        </>
      )}
      {stage === 'busy' && (
        <div className="ct-sheet center fc-busy">
          <BeetMascot mood="think" size={84} tap={false} />
          <div className="ct-h sm center">Reading your plate…</div>
          <div className="fc-skel big"><i /><i /><i /></div>
        </div>
      )}
      {stage === 'error' && (
        <div className="ct-sheet stk">
          <div className="ct-h sm">{err.title}</div>
          <p className="ct-p dim">{err.text}</p>
          {err.code && <p className="ct-p dim num" style={{ fontSize: 11.5 }}>{err.code}</p>}
          {err.upgrade && onUpgrade
            ? <button className="ct-btn" onClick={() => onUpgrade('snap')}>See PRO · 30 a day</button>
            : <button className="ct-btn" onClick={() => { setStage('idle'); setShot(null) }}>Retake</button>}
        </div>
      )}
      {stage === 'result' && res && (() => {
        const items = res.items.map(scaled)
        const oil = fatItem(FAT_OPTIONS.find(o => o.id === fat)?.g || 0)
        const total = items.reduce((a, x) => a + x.kcal, 0) + (oil?.kcal || 0)
        const conf = res.items.reduce((a, x) => a + (x.confidence ?? 0.6), 0) / res.items.length
        const [lo, hi] = kcalRange(total, conf)
        const sum = [...items, ...(oil ? [oil] : [])].reduce((a, x) => ({ p: a.p + (+x.p || 0), c: a.c + (+x.c || 0), f: a.f + (+x.f || 0) }), { p: 0, c: 0, f: 0 })
        return (
          <div className="ct-sheet fc-result">
            <div className="fc-hero">
              {shot && <img className="fc-thumb" src={shot} alt="" />}
              <div className="fc-hero-t">
                <span className="label"><Ic n="cam" /> Photo estimate</span>
                <div className="ct-h sm">{res.title || 'Your meal'}</div>
                <span className={'fc-sure ' + (conf >= 0.7 ? 'ok' : 'warn')}><Ic n={conf >= 0.7 ? 'check' : 'target'} />{conf >= 0.7 ? 'Clear photo' : 'Check the grams'}</span>
              </div>
              <MacroRing kcal={total} p={sum.p} c={sum.c} f={sum.f} size={92} />
            </div>
            <KcalRange lo={lo} hi={hi} at={total} />
            <p className="ct-p dim fc-why"><Ic n="target" />Photos miss hidden oil and sauces. Check grams, add extras.</p>
            <div className="fc-items">
              {res.items.map(raw => {
                const it = scaled(raw)
                const sure = raw.confidence >= 0.7
                return (
                  <div className={'fc-item' + (sure || raw.extra ? '' : ' unsure')} key={raw.id}>
                    <div className="fc-item-top">
                      <span className={'fc-dot ' + (raw.extra ? 'x' : sure ? 'ok' : 'warn')} title={raw.extra ? 'Added by you' : sure ? 'Looks right' : 'Check the amount'} />
                      <span className="fc-name">{it.name}</span>
                      <span className="num fc-kcal"><Ic n="flame" />{it.kcal}</span>
                      {raw.extra && <button className="fc-x" onClick={() => dropItem(raw.id)} aria-label={`Remove ${it.name}`}>×</button>}
                    </div>
                    <div className="fc-item-row">
                      <Stepper value={raw.grams} unit="g" step={10}
                        onChange={g => setRes(r => ({ ...r, items: r.items.map(x => (x.id === raw.id ? { ...x, grams: g } : x)) }))} />
                      <div className="fc-item-m"><MacroBar p={it.p} c={it.c} f={it.f} w={56} /><MacroChips sm p={it.p} c={it.c} f={it.f} /></div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="fc-sauces">
              <span className="label">Missed a sauce?</span>
              <div className="fc-sc">
                {SAUCES.filter(sc => !res.items.some(x => x.name === sc.label) && (moreSauces || COMMON_SAUCES.includes(sc.id)))
                  .sort((a, b) => (moreSauces ? a.label.localeCompare(b.label) : COMMON_SAUCES.indexOf(a.id) - COMMON_SAUCES.indexOf(b.id)))
                  .map(sc => (
                    <button key={sc.id} onClick={() => addSauce(sc)}>+ {sc.label}<small className="num">{sauceItem(sc).kcal}</small></button>
                  ))}
                <button className="fc-more" onClick={() => { haptic(); setMoreSauces(m => !m) }}>{moreSauces ? 'Fewer' : 'More…'}</button>
              </div>
            </div>
            <div className="fc-fat">
              <span className="label">Cooked in oil or butter?</span>
              <div className="fc-seg wide">
                {FAT_OPTIONS.map(o => (
                  <button key={o.id} className={fat === o.id ? 'on' : ''} onClick={() => { haptic(); setFat(o.id) }}>
                    {o.label}{o.g > 0 && <small className="num">+{Math.round(o.g * 8.84)}</small>}
                  </button>
                ))}
              </div>
            </div>
            <button className="ct-btn" disabled={!fat} onClick={() => onAdd([...items.map(({ id, base, confidence, ...x }) => ({ ...x, source: 'snap', est: true })), ...(oil ? [oil] : [])])}>
              {fat ? <>Log to {slotLabel} · <span className="num">{total}</span> kcal</> : 'Pick an oil option to log'}
            </button>
            <button className="ct-link" onClick={() => { setStage('idle'); setShot(null) }}>Retake</button>
          </div>
        )
      })()}
    </>
  )
}

// Turn the Worker's answer into something the person can act on (and a code to send us).
function explain(r) {
  const code = `HTTP ${r.status ?? 0}${r.error ? ' · ' + r.error : ''}${r.detail ? ' · ' + r.detail : ''}`
  if (r.items && !r.items.length) return { title: "Couldn't find food in that photo", text: 'Try again with the plate centred and good light.', code: '' }
  if (r.status === 401 || r.error === 'not_configured') return { title: 'Server setup incomplete', text: 'DEVICE_SECRET is missing on the server. Scan a barcode meanwhile.', code }
  if (r.error === 'snap_not_configured') return { title: 'Photo recognition is off', text: 'GEMINI_API_KEY is missing on the server. Scan a barcode meanwhile.', code }
  if (r.error === 'daily_limit' && r.pro === false) return { title: `That was today's ${r.limit || 3} free photo estimates`, text: 'Barcode, search and quick add are free and unlimited. Photos reset at midnight.', code: '', upgrade: true }
  if (r.error === 'daily_limit') return { title: "You've hit today's photo limit", text: 'It resets at midnight. Barcode and search still work.', code: '' }
  if (r.error === 'offline' || r.status === 0) return { title: "Can't reach the server", text: 'Check your connection and try again.', code }
  return { title: 'Recognition failed', text: 'The AI service returned an error. Try again in a minute.', code }
}

/* ---------------- shared ---------------- */

// Gallery / files picker. On phones this offers "Photo Library" and "Take Photo".
function PickPhoto({ onFile, label }) {
  const ref = useRef(null)
  return (
    <>
      <input ref={ref} type="file" accept="image/*" hidden onChange={e => { onFile(e.target.files?.[0]); e.target.value = '' }} />
      <button className="fc-pick" onClick={() => ref.current?.click()}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" /><path d="M3 15l5-5 4 4 3-3 6 6" /></svg>
        {label}
      </button>
    </>
  )
}

export async function resizeImage(file, maxSide = 1024, quality = 0.82) {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
  return new Promise(res => c.toBlob(res, 'image/jpeg', quality))
}

function Stepper({ value, onChange, step = 10, unit }) {
  const [edit, setEdit] = useState(false)
  const [v, setV] = useState('')
  const commit = () => { const n = Math.round(+v); if (n > 0 && n < 5000) onChange(n); setEdit(false) }
  return (
    <div className="fc-step">
      <button onClick={() => { haptic(); onChange(Math.max(step, value - step)) }} aria-label="Less">−</button>
      {edit
        ? <input className="num fc-step-in" autoFocus inputMode="numeric" value={v} onChange={e => setV(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit() }} aria-label={`Amount in ${unit}`} />
        : <button className="fc-step-v num" onClick={() => { haptic(); setV(String(value)); setEdit(true) }} aria-label={`${value} ${unit}, tap to type`}>{value}<small>{unit}</small></button>}
      <button onClick={() => { haptic(); onChange(value + step) }} aria-label="More">+</button>
    </div>
  )
}

function Macros({ x }) { return <MacroTiles x={x} /> }

export { PortionCard, portion }
