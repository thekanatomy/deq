import { motion } from 'motion/react'
import { useEffect } from 'react'
import DeqCard from './DeqCard'

// Apple Wallet's confirmation: the new card large, a checkmark drawn beside the title,
// then it hands off to the deck on its own.
const STAY_MS = 1600

export default function AddedMoment({ person, onDone }) {
  useEffect(() => {
    navigator.vibrate?.([15, 60, 25])
    const timer = setTimeout(onDone, STAY_MS)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <motion.div
      className="added"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      onClick={onDone}
    >
      <motion.div
        className="added-card"
        initial={{ y: 60, scale: 0.92, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ type: 'spring', bounce: 0.15, duration: 0.55 }}
      >
        <DeqCard person={person} interactive={false} />
      </motion.div>

      <motion.h2
        className="sheet-title added-title"
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.4, delay: 0.15 }}
      >
        <span className="added-heading">
          Added
          <svg className="added-check" viewBox="0 0 24 24" aria-hidden="true">
            <motion.path
              d="M4.5 12.5l5 5 10-11"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.35, delay: 0.35, ease: [0.23, 1, 0.32, 1] }}
            />
          </svg>
        </span>
        <span className="sheet-subtitle">
          {person.name.split(' ')[0]} is in your deq.
          {person.followUpDays ? ` We’ll remind you ${remindIn(person.followUpDays)}.` : ''}
        </span>
      </motion.h2>
    </motion.div>
  )
}

function remindIn(days) {
  if (days === 7) return 'in a week'
  if (days === 14) return 'in 2 weeks'
  if (days === 30) return 'in a month'
  if (days === 90) return 'in 3 months'
  return `in ${days} days`
}
