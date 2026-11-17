import React from 'react'
import { useOnline } from '../lib/hooks.js'
import { haptic } from '../lib/platform.js'

const ago = t => {
  if (!t) return ''
  const m = Math.round((Date.now() - t) / 60000)
  return m < 1 ? 'now' : m < 60 ? `${m} min` : `${Math.round(m / 60)} h`
}

// Where your data is right now, in two words. Sync failures used to be silent.
export function syncLabel(sync, online) {
  const s = sync?.info?.status
  if (!sync?.on) return { kind: 'local', text: 'On this phone' }
  if (!online) return { kind: 'off', text: 'Offline · saved here' }
  if (s === 'syncing') return { kind: 'busy', text: 'Syncing' }
  if (s === 'ok' || s === 'idle') return { kind: 'ok', text: sync.info.at ? `Synced ${ago(sync.info.at)}` : 'Synced' }
  return { kind: 'bad', text: 'Not synced · tap' }
}

export default function SyncBadge({ sync, onOpen }) {
  const online = useOnline()
  const l = syncLabel(sync, online)
  return (
    <button className={'sb sb-' + l.kind} onClick={() => { haptic(); if (l.kind === 'bad' && online) sync.run(); else onOpen?.() }}
      aria-label={`Data: ${l.text}`}>
      <i />{l.text}
    </button>
  )
}
