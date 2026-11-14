import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import './index.css'
import App from './App.jsx'
import { busy } from './draft'

// After a new version goes live, a tab opened earlier still asks for the old
// version's files (the map, the scanner…), which no longer exist. Reload once to
// pick up the new version instead of showing "Importing a module script failed".
window.addEventListener('vite:preloadError', event => {
  let reloaded = null
  try {
    reloaded = sessionStorage.getItem('deq-reloaded-for-update')
  } catch {
    // private mode: still reload, at most once per page load
  }
  if (reloaded && Date.now() - Number(reloaded) < 10_000) return // already tried: let the error show
  event.preventDefault()
  try {
    sessionStorage.setItem('deq-reloaded-for-update', String(Date.now()))
  } catch {
    // nothing to remember
  }
  window.location.reload()
})

// The Home Screen app doesn't reload when you open it: iPhone and Android just
// wake the old page up. So when deq comes back to the front after a while, it
// checks whether a newer version is live and, if so, reloads into it.
if (import.meta.env.PROD) {
  const running = document.querySelector('script[type="module"][src*="/assets/"]')?.getAttribute('src')
  let hiddenAt = 0
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now()
      return
    }
    if (!running || Date.now() - hiddenAt < 30_000) return // a quick app switch: leave it be
    try {
      const page = await fetch(`/?check=${Date.now()}`, { cache: 'no-store' }).then(response => response.text())
      const live = page.match(/src="(\/assets\/[^"]+\.js)"/)?.[1]
      // never in the middle of adding someone: it waits for the next time you come back
      if (live && live !== running && !busy.adding) window.location.reload()
    } catch {
      // offline: keep using the version we have
    }
  })
}

// The offline copy (public build only): a phone that has opened deq before can open
// it again when the network fails, or on a Wi-Fi that blocks deq.one.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}

// which version is running, for checking a phone: open the browser's console
console.info(`deq build ${__BUILD__}`)

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