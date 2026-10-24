// Telegram WebApp helpers. Every call is guarded: old clients throw on unsupported methods.
export const tg = () => (typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined)

export function haptic(kind = 'light') {
  try { tg()?.HapticFeedback?.impactOccurred?.(kind) } catch { /* old client */ }
}

export function hapticSuccess() {
  try { tg()?.HapticFeedback?.notificationOccurred?.('success') } catch { /* old client */ }
}

export function hapticError() {
  try { tg()?.HapticFeedback?.notificationOccurred?.('error') } catch { /* old client */ }
}

// Raw initData string — sent to the Worker, which verifies the HMAC with the bot token.
export function initData() {
  try { return tg()?.initData || '' } catch { return '' }
}

export function firstName() {
  try { return tg()?.initDataUnsafe?.user?.first_name || '' } catch { return '' }
}
