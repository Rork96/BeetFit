// Platform layer: the same code runs as a website/PWA and inside the Capacitor iOS/Android shells.
// Native plugins are imported lazily so the web bundle never waits on them.

export const isNative = () => {
  try { return !!window.Capacitor?.isNativePlatform?.() } catch { return false }
}

export const platform = () => {
  try { return window.Capacitor?.getPlatform?.() || 'web' } catch { return 'web' }
}

let hapticsP = null
const nativeHaptics = () => (hapticsP ??= import('@capacitor/haptics').catch(() => null))

const vibrate = p => { try { navigator.vibrate?.(p) } catch { /* unsupported (iOS Safari) */ } }

export function haptic(kind = 'light') {
  if (isNative()) {
    nativeHaptics().then(m => m?.Haptics.impact({ style: { light: 'LIGHT', medium: 'MEDIUM', heavy: 'HEAVY' }[kind] || 'LIGHT' }).catch(() => {}))
  } else vibrate(kind === 'heavy' ? 24 : kind === 'medium' ? 14 : 8)
}

export function hapticSuccess() {
  if (isNative()) nativeHaptics().then(m => m?.Haptics.notification({ type: 'SUCCESS' }).catch(() => {}))
  else vibrate([12, 60, 18])
}

export function hapticError() {
  if (isNative()) nativeHaptics().then(m => m?.Haptics.notification({ type: 'ERROR' }).catch(() => {}))
  else vibrate([30, 40, 30])
}

// Android hardware back → browser history, which the nav stack listens to.
export async function bindNativeBack() {
  if (!isNative()) return
  try {
    const { App } = await import('@capacitor/app')
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) history.back()
      else App.minimizeApp()
    })
  } catch { /* plugin missing */ }
}
