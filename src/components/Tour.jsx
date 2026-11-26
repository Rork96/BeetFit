import React from 'react'
import { createPortal } from 'react-dom'
import { useBackClose } from '../lib/hooks.js'
import { haptic } from '../lib/platform.js'
import { TOUR } from '../lib/tour.js'
import { track } from '../lib/track.js'

// The 15-second tour, full screen. Opened from a tap, so it may start with sound.
export function TourButton({ label = 'Watch the 15-second tour' }) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <button className="tour-btn" onClick={() => { haptic(); track('tour_open'); setOpen(true) }}>
        <span className="tour-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" /></svg></span>{label}
      </button>
      {open && <TourPlayer onClose={() => setOpen(false)} />}
    </>
  )
}

function TourPlayer({ onClose }) {
  useBackClose(true, onClose)
  return createPortal(
    <div className="tour" role="dialog" aria-label="BeetFit in 15 seconds">
      <div className="tour-back" onClick={() => history.back()} />
      <video className="tour-v" src={TOUR.src} poster={TOUR.poster} autoPlay playsInline controls width={720} height={1280} onEnded={() => history.back()} />
      <button className="tour-x" aria-label="Close" onClick={() => { haptic(); history.back() }}>✕</button>
      <p className="tour-cap">Real app screens with sample data. The camera scene uses a demo pose.</p>
    </div>,
    document.body
  )
}
