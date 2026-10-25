import { useCallback, useEffect, useState } from 'react'
import { cachedAccount, fetchAccount, signOut as apiSignOut, deleteAccount } from './account.js'
import { mergeStates } from './sync.js'
import { clearState, migrate } from './store.js'
import { disablePush, pushOn } from './push.js'

// Account state for the whole app. Signing in merges the account's data into this phone and turns sync on;
// signing out or deleting clears this phone (the device token stays, it maps to a fresh user).
export function useAccount(sync, setState) {
  const [value, setValue] = useState(cachedAccount)
  useEffect(() => { fetchAccount().then(a => setValue(a ?? null)) }, [])

  const onSignedIn = useCallback(r => {
    setValue(r.account)
    const data = r.doc?.data
    if (data?.profile) setState(cur => (cur?.profile ? mergeStates(cur, data) : migrate(data)))
    sync.setOn(true)
  }, [setState, sync])

  const wipe = async () => {
    if (pushOn()) await disablePush().catch(() => {})
    clearState()
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith('beetfit_') && k !== 'beetfit_device_token') localStorage.removeItem(k)
    } catch { /* ignore */ }
    location.replace('/')
  }
  const signOut = async () => { const r = await apiSignOut(); if (r.status === 200) await wipe(); return r }
  const del = async () => { const r = await deleteAccount(); if (r.status === 200) await wipe(); return r }

  return { value, onSignedIn, signOut, del }
}
