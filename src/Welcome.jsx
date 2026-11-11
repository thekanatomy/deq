import { motion } from 'motion/react'
import DeqCard from './DeqCard'
import { PlusIcon } from './icons'

// The first thing anyone sees: the product itself (three real cards, fanned like a
// hand of playing cards), one line, and one button that opens the camera.
// Pattern from Jomo / BitePal on Mobbin: show the thing, say one sentence, one action.
const DAY = 24 * 60 * 60 * 1000
const now = Date.now()

const SAMPLES = [
  { id: 's1', name: 'VIP', role: 'Product Designer', company: 'Walmart', place: 'Memorial Union', lastContacted: now - 200 * DAY, metAt: now - 200 * DAY, lastChannel: 'LinkedIn' },
  { id: 's2', name: 'VIP', role: 'Recruiter', company: 'Google', place: 'Career Fair', lastContacted: now - 12 * DAY, metAt: now - 40 * DAY, lastChannel: 'Mail' },
  { id: 's3', name: 'VIP', role: 'Founder', company: 'Apple', place: 'Hackathon', lastContacted: now, metAt: now },
].map(person => ({ linkedin: '', email: '', ...person }))

// where each card sits in the fan
const FAN = [
  { x: '-30%', y: 34, rotate: -11 },
  { x: '28%', y: 0, rotate: 8 },
  { x: '-2%', y: 70, rotate: -2 },
]

export default function Welcome({ onAdd, onSignIn }) {
  return (
    <section className="welcome" aria-label="Welcome to Deq">
      <div className="welcome-fan" aria-hidden="true">
        {SAMPLES.map((person, index) => (
          <motion.div
            key={person.id}
            className="welcome-card"
            initial={{ opacity: 0, y: 120, rotate: 0, x: '0%' }}
            animate={{ opacity: 1, ...FAN[index] }}
            transition={{ type: 'spring', bounce: 0.18, duration: 0.9, delay: 0.12 + index * 0.09 }}
          >
            <DeqCard person={person} interactive={false} />
          </motion.div>
        ))}
      </div>

      <motion.div
        className="welcome-copy"
        initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ type: 'spring', bounce: 0, duration: 0.7, delay: 0.45 }}
      >
        <h2 className="welcome-title">never forget.</h2>
        <p className="welcome-text">Everyone you meet, kept as a card. Scan a badge, business card or LinkedIn QR and they’re saved in seconds.</p>

        <button className="welcome-add" onClick={onAdd}>
          <span className="welcome-plus">
            <PlusIcon size={30} />
          </span>
          Add your first person
        </button>

        {onSignIn && (
          <button className="flow-skip welcome-signin" onClick={onSignIn}>
            I already have a deq
          </button>
        )}
      </motion.div>
    </section>
  )
}
