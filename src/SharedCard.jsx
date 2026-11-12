import { motion } from 'motion/react'
import { meshImage } from './brands'
import DeqCard from './DeqCard'

const EASE = [0.32, 0.72, 0, 1] // Apple's ease: quick to start, long soft landing

// Opened from someone's Deq card (their Wallet pass QR or link). Their card
// rises slowly out of a soft glow of its own colours, like a pass arriving in
// Wallet; "What's deq?" up top, "Add to your deq" at the bottom.
export default function SharedCard({ person, onAdd, onIntro, onClose }) {
  const now = Date.now()
  const first = person.name.split(' ')[0]

  return (
    <motion.div
      className="shared"
      role="dialog"
      aria-label={`${person.name}'s card`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35, ease: EASE } }}
      transition={{ duration: 0.6, ease: EASE }}
    >
      <motion.div
        className="shared-glow"
        style={{ backgroundImage: meshImage(person.company) }}
        initial={{ opacity: 0, scale: 1.25 }}
        animate={{ opacity: 0.55, scale: 1.1 }}
        transition={{ duration: 2.4, ease: EASE }}
      />

      <motion.header
        className="shared-top"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE, delay: 1.1 }}
      >
        <span className="shared-mark">deq</span>
        <button className="shared-intro" onClick={onIntro}>
          What’s deq?
        </button>
      </motion.header>

      <div className="shared-stage">
        <motion.p
          className="shared-kicker"
          initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 1, ease: EASE, delay: 0.25 }}
        >
          {first} shared their card with you
        </motion.p>

        {/* the slow rise: from low and soft to sharp and settled */}
        <motion.div
          className="shared-card"
          initial={{ opacity: 0, y: 140, scale: 0.92, filter: 'blur(14px)' }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 1.6, ease: EASE, delay: 0.45 }}
        >
          <DeqCard person={{ id: 'shared', ...person, place: '', metAt: now, lastContacted: now }} interactive={false} />
        </motion.div>
      </div>

      <motion.footer
        className="shared-bottom"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: EASE, delay: 1.35 }}
      >
        <button className="primary-button dark" onClick={onAdd}>
          Add {first} to your deq
        </button>
        <button className="flow-skip" onClick={onClose}>
          Not now
        </button>
      </motion.footer>
    </motion.div>
  )
}
