import { motion } from 'motion/react'
import { useState } from 'react'
import { isStandalone } from './browser'
import { meshImage } from './brands'
import Privacy from './Privacy'
import SignIn from './SignIn'

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase()
// newest card in front, the others fanned behind it
const fanSlot = (index, total) => (index === 0 ? 'front' : total === 2 || index === 1 ? 'left' : 'right')

// Shown once you have 5 people: the moment losing them would actually hurt.
// mode 'save': the 5th-card ask. mode 'signin': "I already have a deq" on the welcome screen.
export default function SaveSheet({ mode = 'save', count, people = [], onClose }) {
  const returning = mode === 'signin'
  const [reading, setReading] = useState(false) // the privacy page, inside this sheet
  // the 7-day rule is Safari's; the Home Screen app keeps its cards
  const inSafari = !isStandalone()
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
        {reading ? (
          <div className="save-privacy">
            <button className="flow-skip save-back" onClick={() => setReading(false)}>Back</button>
            <Privacy />
          </div>
        ) : (
          <>
            {/* Fixtured-style hero: your three latest cards fanned inside dotted rings.
                CSS only (no images, no canvas); the mesh backgrounds are already cached. */}
            {!returning && people.length > 0 && (
              <div className="save-hero" aria-hidden="true">
                <span className="save-ring save-ring-outer" />
                <span className="save-ring save-ring-inner" />
                <div className="save-fan">
                  {people.slice(0, 3).map((person, index, shown) => (
                    <span
                      key={person.id}
                      className={`save-mini save-mini-${fanSlot(index, shown.length)}`}
                      style={{ backgroundImage: meshImage(person.company) }}
                    >
                      <span className="save-mini-co">{person.company}</span>
                      <span className="save-mini-av">{initials(person.name)}</span>
                      <span className="save-mini-name">{person.name}</span>
                    </span>
                  ))}
                  <span className="save-badge">{count}</span>
                </div>
              </div>
            )}
            <h2 className="save-title">{returning ? 'Welcome back' : 'Sign in so you don’t lose them.'}</h2>
            <p className="save-text">
              {returning
                ? 'Add your email and everyone in your deq comes back to this phone.'
                : `${count} ${count === 1 ? 'card lives' : 'cards live'} only on this phone right now.`}
            </p>
            <SignIn />
            {!returning && inSafari && (
              <p className="save-footnote">Safari deletes everything from sites you don’t open for 7&nbsp;days.</p>
            )}
            <button className="flow-skip save-later" onClick={onClose}>Not Now</button>
            <button className="save-privacy-link" onClick={() => setReading(true)}>Privacy Policy</button>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}
