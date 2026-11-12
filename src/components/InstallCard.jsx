import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { installMode, onInstallChange, promptInstall, snoozed, snooze } from '../lib/install.js'
import { haptic, hapticSuccess } from '../lib/platform.js'

const ShareIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5" /><path d="M5 12v8h14v-8" /></svg>

export default function InstallCard() {
  const [mode, setMode] = useState(installMode)
  const [hide, setHide] = useState(snoozed)
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  useEffect(() => onInstallChange(() => setMode(installMode())), [])
  if (!mode || hide) return null

  const close = () => { haptic(); snooze(); setHide(true) }
  const install = async () => { haptic(); if (await promptInstall() === 'accepted') hapticSuccess() }
  const copy = async () => { try { await navigator.clipboard.writeText(location.origin); setCopied(true); hapticSuccess() } catch { /* ignore */ } }

  return (
    <div className="card inst">
      <div className="row">
        <img className="inst-mark" src="/icons/icon-192.png" alt="" aria-hidden="true" />
        <div className="inst-t">
          <b>{mode === 'inapp' ? 'Open BeetFit in your browser' : 'Put BeetFit on your home screen'}</b>
          <span className="td-small">{mode === 'inapp' ? 'This in-app browser can’t keep your data or send reminders.' : 'Full screen, reminders, and storage the browser won’t clear.'}</span>
        </div>
        <button className="td-x" onClick={close} aria-label="Not now">✕</button>
      </div>
      {mode === 'prompt' && <button className="btn small" onClick={install}>Install app</button>}
      {mode === 'inapp' && <button className="btn small secondary" onClick={copy}>{copied ? 'Link copied — paste it in Safari or Chrome' : 'Copy link'}</button>}
      {mode === 'ios' && (
        <>
          <button className="btn small secondary" onClick={() => { haptic(); setOpen(o => !o) }} aria-expanded={open}>{open ? 'Hide steps' : 'Show me how · 3 taps'}</button>
          <AnimatePresence initial={false}>
            {open && (
              <motion.ol className="inst-steps" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 36 }}>
                <li><span className="num">1</span><span className="inst-l">Tap <b className="inst-share"><ShareIcon /> Share</b>. On iOS 26, tap <b>⋯</b> first.</span></li>
                <li><span className="num">2</span><span className="inst-l">Scroll and tap <b>Add to Home Screen</b></span></li>
                <li><span className="num">3</span><span className="inst-l">Tap <b>Add</b>, then open BeetFit from the icon</span></li>
              </motion.ol>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  )
}
