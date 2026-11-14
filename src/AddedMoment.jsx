import { motion } from 'motion/react'
import { useEffect } from 'react'
import { linkedinUrl } from './contact'
import DeqCard from './DeqCard'

// Apple Wallet's confirmation: the new card large, a checkmark drawn beside the title,
// then it hands off to the deck on its own.
// With the LinkedIn button it stays longer, so there's time to tap it.
const STAY_MS = 1600
const STAY_WITH_ACTION_MS = 5000

// Right after adding someone: connect while you still remember them. Their LinkedIn
// if the scan had it, otherwise a LinkedIn people search for their name (and company).
// linkedin.com links open the LinkedIn app when it's installed.
export function linkedinFor(person) {
  if (person.linkedin) return { href: linkedinUrl(person.linkedin), label: 'Open LinkedIn' }
  const keywords = [person.name, person.company].filter(Boolean).join(' ')
  return {
    href: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`,
    label: `Find ${person.name.split(' ')[0]} on LinkedIn`,
  }
}

export default function AddedMoment({ person, onDone }) {
  const link = person.name ? linkedinFor(person) : null
  const hasLink = Boolean(link)
  useEffect(() => {
    navigator.vibrate?.([15, 60, 25])
    // the timer only runs while deq is on screen: picking Apple Calendar opens another
    // app, and coming back should still find this screen and its LinkedIn button
    let timer = null
    const start = () => {
      clearTimeout(timer)
      timer = setTimeout(onDone, hasLink ? STAY_WITH_ACTION_MS : STAY_MS)
    }
    const onVisibility = () => (document.visibilityState === 'visible' ? start() : clearTimeout(timer))
    if (document.visibilityState === 'visible') start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [onDone, hasLink])

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

      {link && (
        <motion.a
          className="added-linkedin"
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', bounce: 0, duration: 0.4, delay: 0.3 }}
          onClick={event => {
            event.stopPropagation()
            setTimeout(onDone, 300)
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4v11H3v-11Zm6.5 0h3.8v1.5h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1v5.45h-4v-4.83c0-1.15-.02-2.63-1.6-2.63-1.6 0-1.85 1.25-1.85 2.55v4.91h-4v-11Z" />
          </svg>
          {link.label}
        </motion.a>
      )}
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
