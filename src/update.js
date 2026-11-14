// Every push reaches every phone. The Home Screen app often just wakes up from memory
// with yesterday's version, so deq checks deq.one itself: when you open it, when you
// come back to it, and every few minutes while it's open. A newer version means a
// reload — never in the middle of adding someone (and that draft is kept anyway).
import { busy } from './draft'

const ENTRY = /\/assets\/index-[\w-]+\.js/
const running = () =>
  [...document.querySelectorAll('script[type="module"][src]')].map(script => new URL(script.src).pathname).find(path => ENTRY.test(path))

let waiting = false

async function newerVersion() {
  const mine = running()
  if (!mine || !navigator.onLine) return false
  try {
    const response = await fetch(`/?update-check=${Date.now()}`, { cache: 'no-store' })
    if (!response.ok) return false
    const latest = (await response.text()).match(ENTRY)?.[0]
    return Boolean(latest && latest !== mine)
  } catch {
    return false // offline or blocked: keep the version we have
  }
}

function reloadWhenFree() {
  if (busy.adding) {
    if (!waiting) {
      waiting = true
      const timer = setInterval(() => {
        if (busy.adding) return
        clearInterval(timer)
        window.location.reload()
      }, 1000)
    }
    return
  }
  window.location.reload()
}

export async function checkForUpdate() {
  navigator.serviceWorker?.getRegistration().then(registration => registration?.update()).catch(() => {})
  if (await newerVersion()) reloadWhenFree()
}

export function watchForUpdates() {
  if (!import.meta.env.PROD) return
  setTimeout(checkForUpdate, 3000)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && checkForUpdate())
  window.addEventListener('pageshow', event => event.persisted && checkForUpdate())
  window.addEventListener('focus', checkForUpdate)
  setInterval(() => document.visibilityState === 'visible' && checkForUpdate(), 5 * 60 * 1000)
}
