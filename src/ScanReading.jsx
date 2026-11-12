import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo } from 'react'
import DeqCard from './DeqCard'
import { companyOf, roleOf } from './text'

const EASE = [0.32, 0.72, 0, 1]
const DAY = 24 * 60 * 60 * 1000

// The moment people film: while the AI reads the photo, the shot freezes under a
// sweep of light and a shimmering "deq". When the answer comes back, what it
// found lifts off as glass pills and drops into their card, which lands with a bounce.
// phase: 'reading' (waiting on the AI) | 'done' (found something, playing the payoff)
export default function ScanReading({ image, phase, person }) {
  const url = useMemo(() => (image ? URL.createObjectURL(image) : null), [image])
  useEffect(() => () => url && URL.revokeObjectURL(url), [url])
  const done = phase === 'done'

  const words = [person.name, roleOf(person), companyOf(person)].filter(Boolean).slice(0, 3)
  const first = (person.name ?? '').split(/\s+/)[0]
  const card = { id: 'reading', linkedin: '', email: '', lastContacted: Date.now() - DAY * 0, metAt: Date.now(), ...person }

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
            initial={{ opacity: 0, scale: 0.92, filter: 'blur(8px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 1.08, filter: 'blur(10px)', transition: { duration: 0.3, ease: EASE } }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.2 }}
          >
            <span className="scan-reading-word">deq</span>
            <span className="scan-reading-label">Reading the photo…</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* the payoff: found words fly into the card */}
      {done &&
        words.map((word, index) => (
          <motion.span
            key={word + index}
            className="scan-reading-chip"
            style={{ top: `${36 + index * 7}%` }}
            initial={{ opacity: 0, y: 12, scale: 0.9, x: '-50%' }}
            animate={{
              opacity: [0, 1, 1, 0],
              y: [12, -10, 220 - index * 40, 240 - index * 40],
              scale: [0.9, 1, 0.85, 0.6],
              x: '-50%',
            }}
            transition={{ duration: 1.05, times: [0, 0.3, 0.8, 1], ease: EASE, delay: 0.1 + index * 0.1 }}
          >
            {word}
          </motion.span>
        ))}

      {done && (
        <motion.div
          className="scan-reading-card"
          initial={{ y: '130%' }}
          animate={{ y: 0 }}
          transition={{ type: 'spring', bounce: 0.25, duration: 0.7, delay: 0.55 }}
        >
          <DeqCard person={card} interactive={false} />
        </motion.div>
      )}

      {done && (
        <motion.p
          className="scan-reading-done"
          initial={{ opacity: 0, y: -8, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', bounce: 0.3, duration: 0.5, delay: 0.95 }}
        >
          ✓ {first ? `Got ${first}` : 'Got it'}
        </motion.p>
      )}
    </motion.div>
  )
}
