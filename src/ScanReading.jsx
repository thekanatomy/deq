import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo } from 'react'
import DeqCard from './DeqCard'
import CardDust from './CardDust'

const EASE = [0.32, 0.72, 0, 1]
// slow in, slow out: the card eases into being rather than snapping
const EASE_IN_OUT = [0.65, 0, 0.35, 1]

// The moment people film: while the AI reads the photo, the shot freezes under a
// sweep of light and a shimmering "deq". When the answer comes back, their card
// comes into existence in the middle, out of a field of glittering dots, like Wallet.
// phase: 'reading' (waiting on the AI) | 'done' (found something, playing the payoff)
export default function ScanReading({ image, phase, person }) {
  const url = useMemo(() => (image ? URL.createObjectURL(image) : null), [image])
  useEffect(() => () => url && URL.revokeObjectURL(url), [url])
  const done = phase === 'done'

  const card = { id: 'reading', linkedin: '', email: '', lastContacted: Date.now(), metAt: Date.now(), ...person }

  return (
    <motion.div
      className="scan-reading"
      role="status"
      aria-live="polite"
      aria-label={done ? `Found ${person.name || 'them'}` : 'Reading the photo'}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(10px)', transition: { duration: 0.45, ease: EASE } }}
    >
      {/* the frozen shot, dimmer and softer once it's been read */}
      <motion.div
        className="scan-reading-photo"
        style={url ? { backgroundImage: `url(${url})` } : undefined}
        initial={{ filter: 'brightness(1) blur(0px)', scale: 1 }}
        animate={done ? { filter: 'brightness(0.35) blur(8px)', scale: 1.04 } : { filter: 'brightness(0.55) blur(0px)', scale: 1 }}
        transition={{ duration: done ? 0.6 : 0.5, ease: EASE }}
      />
      <div className="scan-reading-sweep" />
      <motion.div className="scan-reading-flash" initial={{ opacity: 0.85 }} animate={{ opacity: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }} />

      <AnimatePresence>
        {!done && (
          <motion.div
            key="badge"
            className="scan-reading-badge"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.08, filter: 'blur(10px)', transition: { duration: 0.35, ease: EASE_IN_OUT } }}
            transition={{ duration: 0.3 }}
          >
            {/* the logo grows out of a blur into focus, right in the middle */}
            <motion.span
              className="scan-reading-word"
              initial={{ opacity: 0, scale: 0.45, filter: 'blur(16px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              transition={{ duration: 1.0, ease: EASE_IN_OUT, delay: 0.15 }}
            >
              deq
            </motion.span>
            <motion.span
              className="scan-reading-label"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, ease: EASE_IN_OUT, delay: 0.9 }}
            >
              Reading the photo…
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Apple Wallet's "Adding Card": a field of glittering dots in the card's shape,
          which dissolves as the real card comes into focus underneath */}
      {done && (
        <div className="scan-reading-card">
          <motion.div
            initial={{ opacity: 0, scale: 0.94, filter: 'blur(8px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            transition={{ duration: 1.1, ease: EASE_IN_OUT, delay: 0.45 }}
          >
            <DeqCard person={card} interactive={false} />
          </motion.div>
          <CardDust appearAt={80} appearFor={500} dissolveAt={650} dissolveFor={800} />
        </div>
      )}

    </motion.div>
  )
}
