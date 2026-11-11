import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import { useEffect } from 'react'
import { brandStyle } from './brands'
import DeqCard from './DeqCard'

const DAY = 24 * 60 * 60 * 1000
const SPRING = { type: 'spring', bounce: 0, duration: 0.5 }

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// The card lifted out of the deck: it flies up from where it sat (shared layoutId),
// the whole screen glows in the brand's colour, and the card tilts under your finger.
export default function ZoomView({ person, onClose }) {
  const brand = brandStyle(person.company)
  const glow = brand ?? { '--card-background': 'var(--deq-gradient)', '--card-ink': '#fff' }
  // Darken the glow under white text, lighten it under dark text, so the card stands
  // out from its own colour and the caption stays readable.
  const lightText = glow['--card-ink'].startsWith('#fff') || glow['--card-ink'].startsWith('rgba(255')
  const base = lightText ? '#000' : '#fff'
  const days = Math.floor((Date.now() - person.lastContacted) / DAY)
  const metAt = person.metAt ?? person.lastContacted
  const reminder = person.followUpDays
    ? formatDate((person.lastContacted ?? metAt) + person.followUpDays * DAY).replace(/^/, 'on ')
    : null

  // tilt follows the pointer, softened by a spring so it never feels twitchy
  const pointerX = useMotionValue(0)
  const pointerY = useMotionValue(0)
  const rotateY = useSpring(useTransform(pointerX, [-0.5, 0.5], [-10, 10]), { stiffness: 180, damping: 22 })
  const rotateX = useSpring(useTransform(pointerY, [-0.5, 0.5], [8, -8]), { stiffness: 180, damping: 22 })

  useEffect(() => {
    const onKey = event => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function onPointerMove(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    pointerX.set((event.clientX - rect.left) / rect.width - 0.5)
    pointerY.set((event.clientY - rect.top) / rect.height - 0.5)
  }

  function resetTilt() {
    pointerX.set(0)
    pointerY.set(0)
  }

  return (
    <motion.div
      className="zoom"
      style={{ color: glow['--card-ink'], background: base }}
      onClick={onClose}
      onPointerMove={onPointerMove}
      onPointerLeave={resetTilt}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
      transition={{ duration: 0.25 }}
    >
      <motion.div
        className="zoom-glow"
        style={glow}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.72 }}
        exit={{ opacity: 0, transition: { duration: 0.25 } }}
        transition={{ duration: 0.4 }}
      />

      <div className="zoom-stage">
        <motion.div
          className="zoom-card"
          layoutId={`card-${person.id}`}
          transition={SPRING}
          style={{ rotateX, rotateY }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0.1, bottom: 0.7 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 80 || info.velocity.y > 500) onClose()
          }}
        >
          <DeqCard person={person} interactive={false} />
        </motion.div>

        <motion.div
          className="zoom-caption"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0, transition: { ...SPRING, delay: 0.12 } }}
          exit={{ opacity: 0, y: 8, transition: { duration: 0.15 } }}
        >
          <h2 className="zoom-name">{person.name}</h2>
          <p className="zoom-meta">
            {[person.role, person.company].filter(Boolean).join(' · ')}
          </p>
          {person.note && <p className="zoom-note">“{person.note}”</p>}
          <p className="zoom-meta soft">
            Met {formatDate(metAt)}
            {person.place && ` at ${person.place}`} · {days === 0 ? 'spoke today' : `${days} ${days === 1 ? 'day' : 'days'} since you spoke`}
          </p>
          {reminder && <p className="zoom-meta soft">Reach out {reminder}</p>}
        </motion.div>
      </div>
    </motion.div>
  )
}