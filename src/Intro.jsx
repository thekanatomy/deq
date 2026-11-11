import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { meshImage } from './brands'
import { remember } from './browser'

// The six-second story shown once to someone who opens a deq link for the first time:
//   1. two people meet          "Met someone great?"
//   2. one snaps the other's badge   "Snap their badge."
//   3. it becomes a card              "never forget."
// The characters are simple shapes for now; real illustrated ones can replace the
// <Person> drawings later without touching the timing.
const BEATS = [
  { at: 0, line: 'Met someone great?' },
  { at: 2100, line: 'Snap their badge.' },
  { at: 4200, line: 'never forget.' },
]
const END = 6400
const SPRING = { type: 'spring', bounce: 0.25, duration: 0.7 }

export default function Intro({ onDone }) {
  const [beat, setBeat] = useState(0)

  useEffect(() => {
    const timers = BEATS.slice(1).map((step, index) => setTimeout(() => setBeat(index + 1), step.at))
    timers.push(setTimeout(finish, END))
    return () => timers.forEach(clearTimeout)
    // finish only reads stable props
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish() {
    remember('deq-intro-seen', '1', true)
    onDone()
  }

  return (
    <motion.div
      className="intro"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04, filter: 'blur(8px)', transition: { duration: 0.35 } }}
    >
      <button className="intro-skip" onClick={finish}>Skip</button>

      <div className="intro-stage" aria-hidden="true">
        {/* the person you meet: walks in from the right, wearing a badge */}
        <motion.div
          className="intro-person right"
          initial={{ x: 160, opacity: 0 }}
          animate={beat < 2 ? { x: 0, opacity: 1 } : { x: 40, opacity: 0, scale: 0.9 }}
          transition={SPRING}
        >
          <Person colour="#ff9f0a" badge waving={beat === 0} />
        </motion.div>

        {/* you: walks in from the left, then raises your phone */}
        <motion.div
          className="intro-person left"
          initial={{ x: -160, opacity: 0 }}
          animate={beat < 2 ? { x: 0, opacity: 1 } : { x: -40, opacity: 0, scale: 0.9 }}
          transition={{ ...SPRING, delay: 0.1 }}
        >
          <Person colour="#5ac8fa" />
          <AnimatePresence>
            {beat === 1 && (
              <motion.div
                className="intro-phone"
                initial={{ y: 40, opacity: 0, rotate: -12 }}
                animate={{ y: 0, opacity: 1, rotate: 0 }}
                exit={{ opacity: 0 }}
                transition={SPRING}
              >
                <motion.span
                  className="intro-flash"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 0.5, delay: 0.9 }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {beat === 0 && (
          <motion.span
            className="intro-hi"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...SPRING, delay: 0.7 }}
          >
            hi!
          </motion.span>
        )}

        {/* the card it becomes */}
        <AnimatePresence>
          {beat === 2 && (
            <motion.div
              className="intro-card"
              style={{ backgroundImage: meshImage('Walmart') }}
              initial={{ y: 120, scale: 0.4, rotate: -14, opacity: 0 }}
              animate={{ y: 0, scale: 1, rotate: -4, opacity: 1 }}
              transition={{ type: 'spring', bounce: 0.3, duration: 0.8 }}
            >
              <span className="intro-card-company">Walmart</span>
              <span className="intro-card-name">VIP</span>
              <span className="intro-card-days">Today · Memorial Union</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="intro-caption" aria-live="polite">
        <AnimatePresence mode="wait">
          <motion.p
            key={beat}
            className={beat === 2 ? 'intro-line big' : 'intro-line'}
            initial={{ y: 14, opacity: 0, filter: 'blur(6px)' }}
            animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
            exit={{ y: -10, opacity: 0, filter: 'blur(6px)' }}
            transition={{ type: 'spring', bounce: 0, duration: 0.45 }}
          >
            {BEATS[beat].line}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="intro-dots" aria-hidden="true">
        {BEATS.map((_, index) => (
          <span key={index} className={index <= beat ? 'on' : ''} />
        ))}
      </div>
    </motion.div>
  )
}

// A friendly round character: head, body, two eyes, an optional badge and wave.
function Person({ colour, badge = false, waving = false }) {
  return (
    <svg viewBox="0 0 100 150" className="intro-figure">
      <ellipse cx="50" cy="146" rx="30" ry="4" fill="rgba(0,0,0,0.08)" />
      <rect x="18" y="62" width="64" height="82" rx="30" fill={colour} />
      <circle cx="50" cy="38" r="28" fill={colour} />
      <circle cx="41" cy="36" r="3.6" fill="#1d1d1f" />
      <circle cx="59" cy="36" r="3.6" fill="#1d1d1f" />
      <path d="M43 47 Q50 53 57 47" fill="none" stroke="#1d1d1f" strokeWidth="3" strokeLinecap="round" />
      {badge && (
        <g>
          <rect x="36" y="84" width="28" height="20" rx="4" fill="#fff" />
          <rect x="41" y="90" width="18" height="3" rx="1.5" fill="#c7c7cc" />
          <rect x="41" y="96" width="12" height="3" rx="1.5" fill="#c7c7cc" />
        </g>
      )}
      {waving && (
        <motion.rect
          x="76"
          y="58"
          width="14"
          height="34"
          rx="7"
          fill={colour}
          style={{ originX: '83px', originY: '88px' }}
          animate={{ rotate: [0, -24, 8, -24, 0] }}
          transition={{ duration: 1.2, delay: 0.6 }}
        />
      )}
    </svg>
  )
}
