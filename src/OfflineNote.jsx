import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'

// A small note when deq.one can't be reached: offline, or a Wi-Fi that blocks it
// (the phone still shows Wi-Fi then, so deq asks /api/ping instead of trusting it).
// Cards work anyway; only scanning, wallet passes, maps and place search need the network.
async function reachable() {
  if (!navigator.onLine) return false
  try {
    const response = await fetch('/api/ping', { cache: 'no-store', signal: AbortSignal.timeout(5000) })
    return response.ok
  } catch {
    return false
  }
}

export default function OfflineNote() {
  const [offline, setOffline] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let alive = true
    const check = () =>
      reachable().then(ok => {
        if (!alive) return
        setOffline(!ok)
        if (ok) setDismissed(false)
      })
    const onVisible = () => document.visibilityState === 'visible' && check()
    check()
    window.addEventListener('online', check)
    window.addEventListener('offline', check)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      window.removeEventListener('online', check)
      window.removeEventListener('offline', check)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return (
    <AnimatePresence>
      {offline && !dismissed && (
        <motion.button
          className="offline-note"
          role="status"
          onClick={() => setDismissed(true)}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
        >
          <b>No connection</b> · cards still work, scanning needs internet
        </motion.button>
      )}
    </AnimatePresence>
  )
}
