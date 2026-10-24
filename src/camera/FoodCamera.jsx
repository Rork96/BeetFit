import React, { useEffect, useRef, useState } from 'react'
import { useCamera } from './useCamera.js'
import { getBarcodeDetector, validGtin } from './barcode.js'
import { lookupBarcode, snapMeal } from '../lib/api.js'
import { haptic, hapticError, hapticSuccess } from '../lib/platform.js'
import './camera.css'
import './food.css'

// One camera screen, two modes: barcode scan (Open Food Facts) and meal photo (Gemini via the Worker).
// onAdd(items) receives [{ name, grams, kcal, p, c, f, source, code? }].
export default function FoodCamera({ initialMode = 'barcode', slotLabel = 'today', onAdd, onClose }) {
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

      {camFailed && !(mode === 'barcode' && preset) ? (
        <div className="ct-sheet stk">
          <div className="ct-h">{cam.status === 'denied' ? 'Camera access is off' : 'Camera unavailable'}</div>
          <p className="ct-p">Allow camera access for BeetFit in your browser or phone settings to scan barcodes or photograph a meal. Nothing leaves your device until you take a photo.</p>
          <button className="ct-btn" onClick={() => cam.start()}>Try again</button>
          {mode === 'barcode' && <ManualCode onCode={setPreset} />}
        </div>
      ) : mode === 'snap' ? (
        <SnapFlow cam={cam} slotLabel={slotLabel} onAdd={onAdd} />
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
            <ManualCode onCode={lookup} />
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
  const [g, setG] = useState(item.servingG || 100)
  const x = portion(item, g)
  return (
    <div className="fc-card">
      <div className="fc-prod">
        {item.image ? <img src={item.image} alt="" /> : <span className="fc-ph" />}
        <div>
          <div className="fc-name">{item.name}</div>
          <div className="ct-p dim">{item.brand || (item.source === 'usda' ? 'USDA' : 'Open Food Facts')} · <span className="num">{item.per100.kcal}</span> kcal / 100 g</div>
        </div>
      </div>
      <Stepper value={g} onChange={setG} step={g >= 100 ? 25 : 10} unit="g" />
      <Macros x={x} />
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
      <div className="fc-chip">▣ barcode <span className="num">{code}</span></div>
      <input placeholder="Product name" value={f.name} onChange={set('name')} />
      <div className="fc-grid">
        <label>kcal/100g<input inputMode="decimal" value={f.kcal} onChange={set('kcal')} /></label>
        <label>protein<input inputMode="decimal" value={f.p} onChange={set('p')} /></label>
        <label>carbs<input inputMode="decimal" value={f.c} onChange={set('c')} /></label>
        <label>fat<input inputMode="decimal" value={f.f} onChange={set('f')} /></label>
      </div>
      <Stepper value={+f.grams} onChange={v => setF(s => ({ ...s, grams: v }))} step={10} unit="g" />
      <button className="ct-btn" disabled={!ok} onClick={add}>Save & add to {slotLabel}</button>
      <button className="ct-link" onClick={onRescan}>Scan again</button>
    </div>
  )
}

/* ---------------- Snap ---------------- */

function SnapFlow({ cam, slotLabel, onAdd }) {
  const [stage, setStage] = useState('idle') // idle | busy | result | error
  const [res, setRes] = useState(null)
  const [err, setErr] = useState(null)
  const [shot, setShot] = useState(null)

  async function take() {
    haptic('heavy')
    const blob = await cam.capture(1024)
    if (!blob) return
    setShot(URL.createObjectURL(blob))
    setStage('busy')
    const r = await snapMeal(blob).catch(() => ({ error: 'network' }))
    if (r.items?.length) {
      setRes({ title: r.title, items: r.items.map((it, i) => ({ ...it, id: i, base: it.grams })) })
      setStage('result'); hapticSuccess()
    } else {
      setErr(r.error === 'offline' || r.error === 'snap_not_configured' || r.status === 404 ? 'no_api' : r.error === 'daily_limit' ? 'limit' : r.items ? 'empty' : 'failed')
      setStage('error'); hapticError()
    }
  }
  useEffect(() => () => shot && URL.revokeObjectURL(shot), [shot])

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
            <p className="ct-p center">Get the whole plate in frame</p>
            <button className="fc-shutter" onClick={take} disabled={cam.status !== 'live'} aria-label="Take photo"><i /></button>
          </div>
        </>
      )}
      {stage === 'busy' && (
        <div className="ct-sheet">
          <div className="fc-skel big"><i /><i /><i /></div>
          <div className="ct-h sm center">Analyzing…</div>
        </div>
      )}
      {stage === 'error' && (
        <div className="ct-sheet stk">
          <div className="ct-h sm">{{ no_api: 'Photo recognition is not connected', limit: "You've hit today's photo limit", empty: "Couldn't find food in that photo", failed: 'Recognition failed' }[err]}</div>
          <p className="ct-p dim">{err === 'no_api' ? 'The BeetFit server is offline or has no Gemini key yet. Scan a barcode instead.' : 'Try again with the plate centred and good light, or scan a barcode.'}</p>
          <button className="ct-btn" onClick={() => { setStage('idle'); setShot(null) }}>Retake</button>
        </div>
      )}
      {stage === 'result' && res && (
        <div className="ct-sheet fc-result">
          <div className="ct-h sm">Looks like {res.title || 'a meal'} — check the amounts</div>
          <div className="fc-items stk">
            {res.items.map(raw => {
              const it = scaled(raw)
              const sure = raw.confidence >= 0.7
              return (
                <div className="fc-item" key={raw.id}>
                  <div className="fc-item-top">
                    <span className="fc-name">{it.name}</span>
                    <span className={'fc-conf ' + (sure ? 'ok' : 'warn')}>{sure ? 'high confidence' : 'check amount'}</span>
                  </div>
                  <div className="fc-item-row">
                    <Stepper value={raw.grams} unit="g" step={10}
                      onChange={g => setRes(r => ({ ...r, items: r.items.map(x => (x.id === raw.id ? { ...x, grams: g } : x)) }))} />
                    <span className="num fc-kcal">{it.kcal} kcal</span>
                  </div>
                </div>
              )
            })}
          </div>
          <button className="ct-btn" onClick={() => onAdd(res.items.map(scaled).map(({ id, base, confidence, ...x }) => ({ ...x, source: 'snap' })))}>
            Log all to {slotLabel} · <span className="num">{res.items.map(scaled).reduce((a, x) => a + x.kcal, 0)}</span> kcal
          </button>
          <button className="ct-link" onClick={() => { setStage('idle'); setShot(null) }}>Retake</button>
        </div>
      )}
    </>
  )
}

/* ---------------- shared ---------------- */

function Stepper({ value, onChange, step = 10, unit }) {
  return (
    <div className="fc-step">
      <button onClick={() => { haptic(); onChange(Math.max(step, value - step)) }} aria-label="Less">−</button>
      <span className="num">{value}<small>{unit}</small></span>
      <button onClick={() => { haptic(); onChange(value + step) }} aria-label="More">+</button>
    </div>
  )
}

function Macros({ x }) {
  return (
    <div className="fc-macros">
      <div><b className="num">{x.kcal}</b><span>kcal</span></div>
      <div><b className="num">{x.p}</b><span>protein</span></div>
      <div><b className="num">{x.c}</b><span>carbs</span></div>
      <div><b className="num">{x.f}</b><span>fat</span></div>
    </div>
  )
}

export { PortionCard, portion }
