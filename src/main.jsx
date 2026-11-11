import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/manrope'
import '@fontsource-variable/bricolage-grotesque'
import './index.css'
import App from './App.jsx'

// Shows the error on screen instead of a blank page.
class ErrorScreen extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <pre style={{ padding: 20, whiteSpace: 'pre-wrap', color: '#d70015', fontSize: 13 }}>
        {String(this.state.error?.stack || this.state.error)}
      </pre>
    )
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorScreen>
      <App />
    </ErrorScreen>
  </StrictMode>,
)