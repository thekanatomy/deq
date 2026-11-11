import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { escapeToBrowser, isIOS, recall, remember } from './browser'

// Shown when deq.one is opened inside Instagram, TikTok, LinkedIn… On Android we
// jump to the real browser by ourselves; on iPhone only the person can, so we point
// at the ••• button the app puts in the top-right corner.
export default function InAppGate({ app, onContinue }) {
  const [copied, setCopied] = useState(false)
  const [tried, setTried] = useState(() => isIOS || Boolean(recall('deq-escape-tried')))

  useEffect(() => {
    // Android: one automatic jump per visit (so a failed jump can't loop); if we're
    // still here a moment later, it didn't work and the instructions take over
    if (isIOS) return undefined
    if (!recall('deq-escape-tried')) {
      remember('deq-escape-tried', '1')
      escapeToBrowser()
    }
    const timer = setTimeout(() => setTried(true), 1500)
    return () => clearTimeout(timer)
  }, [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  function stay() {
    remember('deq-stay-in-app', '1')
    onContinue()
  }

  const browser = isIOS ? 'Safari' : 'your browser'

  return (
    <motion.div
      className="gate"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      role="dialog"
      aria-label={`Open deq in ${browser}`}
    >
      {isIOS && (
        <motion.svg
          className="gate-arrow"
          viewBox="0 0 36 54"
          aria-hidden="true"
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 1.4, repeat: 3, ease: [0.45, 0, 0.55, 1] }}
        >
          <path d="M18 52 V8 M6 20 L18 6 L30 20" />
        </motion.svg>
      )}

      <div className="gate-body">
        <p className="gate-eyebrow">You’re in {app}’s browser</p>
        <h1 className="gate-title">Open deq in {browser} to keep your cards.</h1>
        {isIOS ? (
          <p className="gate-text">
            Tap <b>•••</b> at the top right, then <b>Open in external browser</b>.
          </p>
        ) : (
          <p className="gate-text">
            {tried ? 'If nothing happened, tap ••• and choose Open in browser.' : 'Opening your browser…'}
          </p>
        )}
      </div>

      <div className="gate-actions">
        <button className="primary-button dark" onClick={copy}>
          {copied ? 'Link copied. Paste it in ' + (isIOS ? 'Safari' : 'Chrome') : 'Copy link'}
        </button>
        <button className="flow-skip" onClick={stay}>Continue here anyway</button>
      </div>
    </motion.div>
  )
}
