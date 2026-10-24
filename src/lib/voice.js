// Voice coach on Web Speech API. No backend.
// iOS WebViews need a user gesture before the first utterance: call unlockVoice() inside a tap handler.
const KEY = 'bf_voice'

export function voiceEnabled() {
  try { return localStorage.getItem(KEY) !== '0' } catch { return true }
}

export function setVoiceEnabled(on) {
  try { localStorage.setItem(KEY, on ? '1' : '0') } catch { /* ignore */ }
  if (!on) cancelVoice()
}

export function speak(text) {
  if (!text || !voiceEnabled()) return
  try {
    const synth = window.speechSynthesis
    if (!synth) return
    synth.cancel() // never overlap: the newest phrase wins
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 1.05
    u.lang = 'en-US'
    synth.speak(u)
  } catch { /* unsupported */ }
}

export function cancelVoice() {
  try { window.speechSynthesis?.cancel() } catch { /* unsupported */ }
}

export function unlockVoice() {
  try {
    const synth = window.speechSynthesis
    if (!synth || synth.speaking) return
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    synth.speak(u)
  } catch { /* unsupported */ }
}
