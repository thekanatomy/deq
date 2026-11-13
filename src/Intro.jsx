import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

// The front door of an empty deq: the film (made in Remotion, public/intro.mp4)
// loops edge to edge like a living graphic, muted and with no controls, and the
// + to add someone sits on top of it the whole time. Install (top left) and a
// quiet Skip (top right) are always there too.
export default function Intro({ onAdd, onDone, onInstall, onBringOver }) {
  const film = useRef(null)
  const [bringing, setBringing] = useState('idle') // idle | working | nothing | failed

  // iPhone Home Screen app: paste in the people copied from Safari
  async function bringOver() {
    setBringing('working')
    try {
      const added = await onBringOver()
      setBringing(added > 0 ? 'idle' : 'nothing') // added people: the deck fills and the film steps aside
    } catch {
      setBringing('failed')
    }
  }

  useEffect(() => {
    const video = film.current
    if (!video) return undefined
    // iPhones in Low Power Mode block autoplay. The poster holds the first scene,
    // and the first touch anywhere starts the film.
    const start = () => video.play().catch(() => {})
    start()
    window.addEventListener('pointerdown', start, { once: true })
    // coming back to the tab can leave it paused
    const wake = () => document.visibilityState === 'visible' && start()
    document.addEventListener('visibilitychange', wake)
    return () => {
      window.removeEventListener('pointerdown', start)
      document.removeEventListener('visibilitychange', wake)
    }
  }, [])

  return (
    <motion.div
      className="intro-film"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04, filter: 'blur(12px)', transition: { duration: 0.5, ease: [0.32, 0.72, 0, 1] } }}
      transition={{ duration: 0.4 }}
    >
      <video
        ref={film}
        className="intro-video"
        src="/intro.mp4"
        poster="/intro.jpg"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        disableRemotePlayback
        controls={false}
        aria-label="What deq does: save anyone you meet in five seconds, with the context that matters, and a nudge before it goes cold."
      />

      {onInstall && (
        <button className="install-pill intro-install" onClick={onInstall}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" />
          </svg>
          Install
        </button>
      )}

      <button className="intro-skip" onClick={onDone}>
        Skip
      </button>

      {onBringOver && (
        <motion.div
          className="intro-bring"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', bounce: 0, duration: 0.6, delay: 0.8 }}
        >
          <button onClick={bringOver} disabled={bringing === 'working'}>
            {bringing === 'working' ? 'Bringing them over…' : 'Bring over your people from Safari'}
          </button>
          {bringing === 'nothing' && <p>Nothing copied yet. In Safari, open deq.one and tap Install, then come back.</p>}
          {bringing === 'failed' && <p>Couldn’t paste. Tap again and choose Paste.</p>}
        </motion.div>
      )}

      <motion.button
        className="intro-add"
        aria-label="Add someone"
        onClick={onAdd}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', bounce: 0.2, duration: 0.6, delay: 0.6 }}
        whileTap={{ scale: 0.92 }}
      >
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </motion.button>
    </motion.div>
  )
}
