// Persistence: localStorage always, Telegram CloudStorage when available.
const KEY = 'fittrack_state_v1'
const tg = () => window.Telegram?.WebApp

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
  const cloud = tg()?.CloudStorage
  if (cloud?.setItem) {
    // CloudStorage item limit 4096 chars — chunk it
    for (let i = 0; i * 4000 < raw.length; i++) {
      cloud.setItem(`${KEY}_${i}`, raw.slice(i * 4000, (i + 1) * 4000), () => {})
    }
    cloud.setItem(`${KEY}_n`, String(Math.ceil(raw.length / 4000)), () => {})
  }
}

export function loadCloudState() {
  return new Promise(resolve => {
    const cloud = tg()?.CloudStorage
    if (!cloud?.getItem) return resolve(null)
    cloud.getItem(`${KEY}_n`, (err, n) => {
      const count = parseInt(n, 10)
      if (err || !count) return resolve(null)
      const keys = Array.from({ length: count }, (_, i) => `${KEY}_${i}`)
      cloud.getItems(keys, (err2, items) => {
        if (err2 || !items) return resolve(null)
        try {
          resolve(JSON.parse(keys.map(k => items[k] || '').join('')))
        } catch {
          resolve(null)
        }
      })
    })
  })
}
