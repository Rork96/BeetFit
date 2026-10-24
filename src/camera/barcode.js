// Barcode detection: native BarcodeDetector when the WebView has it (Android Chrome),
// otherwise the ZXing-C++ WASM ponyfill (iOS, desktop). Both expose the same API.
import zxingWasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']
let detectorP = null

export function getBarcodeDetector() {
  if (detectorP) return detectorP
  detectorP = (async () => {
    if ('BarcodeDetector' in window) {
      try {
        const supported = await window.BarcodeDetector.getSupportedFormats()
        const formats = FORMATS.filter(f => supported.includes(f))
        if (formats.length) return new window.BarcodeDetector({ formats })
      } catch { /* fall through to the ponyfill */ }
    }
    const { BarcodeDetector, setZXingModuleOverrides } = await import('barcode-detector/ponyfill')
    setZXingModuleOverrides({ locateFile: (path, prefix) => (path.endsWith('.wasm') ? zxingWasmUrl : prefix + path) })
    return new BarcodeDetector({ formats: FORMATS })
  })()
  detectorP.catch(() => { detectorP = null })
  return detectorP
}

// EAN/UPC check digit — rejects most misreads before we hit the network.
export function validGtin(code) {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false
  const d = code.split('').map(Number)
  const check = d.pop()
  const sum = d.reverse().reduce((a, n, i) => a + n * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check
}
