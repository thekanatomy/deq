import { motion } from 'motion/react'
import SignIn from './SignIn'

// Shown once you have 5 people: the moment losing them would actually hurt.
// mode 'save': the 5th-card ask. mode 'signin': "I already have a deq" on the welcome screen.
export default function SaveSheet({ mode = 'save', count, onClose }) {
  const returning = mode === 'signin'
  return (
    <motion.div
      className="scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      onClick={onClose}
    >
      <motion.div
        className="sheet save-sheet"
        role="dialog"
        aria-label={returning ? 'Sign in' : 'Save your deq'}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%', transition: { type: 'spring', bounce: 0, duration: 0.3 } }}
        transition={{ type: 'spring', bounce: 0, duration: 0.45 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.05, bottom: 0.6 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 80 || info.velocity.y > 500) onClose()
        }}
        onClick={event => event.stopPropagation()}
      >
        <span className="grabber" />
        <h2 className="save-title">{returning ? 'Welcome back' : 'Save your deq'}</h2>
        <p className="save-text">
          {returning
            ? 'Sign in and everyone in your deq comes back to this phone.'
            : `${count} people are in here. Sign in so they’re safe if you lose this phone, and there on any device you use.`}
        </p>
        <SignIn />
        <button className="flow-skip save-later" onClick={onClose}>Not Now</button>
      </motion.div>
    </motion.div>
  )
}
