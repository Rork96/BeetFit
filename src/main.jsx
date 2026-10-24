import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import { applyMotionLevel } from './lib/motion.js'
import { bindNativeBack, isNative } from './lib/platform.js'

applyMotionLevel()
bindNativeBack()
if (isNative()) document.documentElement.classList.add('native')

// Error boundary: show the error instead of a blank screen.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 20, fontFamily: 'monospace' }}>
          <h2 style={{ color: '#ff6b6b' }}>Something broke</h2>
          <p style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>
            {String(this.state.error?.message || this.state.error)}
          </p>
          <button style={{ marginTop: 12, padding: '10px 16px' }} onClick={() => location.reload()}>Reload</button>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
