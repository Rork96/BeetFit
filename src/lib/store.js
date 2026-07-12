// Persistence: localStorage always, Telegram CloudStorage when supported (6.9+).
// Every Telegram call is wrapped: on old clients CloudStorage methods THROW
// synchronously (WebAppMethodUnsupported) — an uncaught throw blanks the app.
const KEY = 'fittrack_state_v1'
const tg = () => window.Telegram?.WebApp

function cloudSupported() {
  try {
    const t = tg()
    return !!t?.CloudStorage && (t.isVersionAtLeast ? t.isVersionAtLeast('6.9') : false)
  } catch {
    return false
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveState(state) {
  const raw = JSON.stringify(state)
  try {
    localStorage.setItem(KEY, raw)
  } catch { /* ignore */ }
  if (!cloudSupported()) return
  try {
    const cloud = tg().CloudStorage
    // CloudStorage item limit 4096 chars — chunk it
    for (let i = 0; i * 4000 < raw.length; i++) {
      cloud.setItem(`${KEY}_${i}`, raw.slice(i * 4000, (i + 1) * 4000), () => {})
    }
    cloud.setItem(`${KEY}_n`, String(Math.ceil(raw.length / 4000)), () => {})
  } catch { /* cloud sync is best-effort */ }
}

export function loadCloudState() {
  return new Promise(resolve => {
    if (!cloudSupported()) return resolve(null)
    try {
      const cloud = tg().CloudStorage
      cloud.getItem(`${KEY}_n`, (err, n) => {
        const count = parseInt(n, 10)
        if (err || !count) return resolve(null)
        const keys = Array.from({ length: count }, (_, i) => `${KEY}_${i}`)
        try {
          cloud.getItems(keys, (err2, items) => {
            if (err2 || !items) return resolve(null)
            try {
              resolve(JSON.parse(keys.map(k => items[k] || '').join('')))
            } catch {
              resolve(null)
            }
          })
        } catch {
          resolve(null)
        }
      })
    } catch {
      resolve(null)
    }
  })
}
