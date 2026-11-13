import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import { nextStep, spokeNow, talkingPoints, timelineOf } from './history'
import { lazy, Suspense, useEffect, useState } from 'react'
import { CALENDARS, followUpWindow, openReminder } from './calendar'
import { brandStyle } from './brands'
import { db } from './db'
import DeqCard from './DeqCard'
import { CloseIcon } from './icons'
import { companyOf, roleOf } from './text'

const DAY = 24 * 60 * 60 * 1000
const SPRING = { type: 'spring', bounce: 0, duration: 0.5 }
const EASE = [0.32, 0.72, 0, 1]

function linkedinUrl(value) {
  const path = value.trim().match(/linkedin\.com\/((?:in|company)\/[^/?#\s]+)/i)
  return path ? `https://www.linkedin.com/${path[1]}` : `https://www.linkedin.com/in/${value.trim().replace(/^@/, '')}`
}

function followUpText(person) {
  return [
    person.note && `Stood out: ${person.note}`,
    person.place && `Met at ${person.place}`,
    person.linkedin && `LinkedIn: ${linkedinUrl(person.linkedin)}`,
    person.email && `Email: ${person.email}`,
    'From deq.one',
  ]
    .filter(Boolean)
    .join('\n')
}

const MiniMap = lazy(() => import('./MiniMap.jsx'))
const VIBES = ['Quick hello', 'Nice chat', 'Good conversation', 'Really clicked', 'Must stay in touch']
const VIBE_COLOURS = ['#FF3B30', '#FF9500', '#F2B600', '#A3D94B', '#34C759']

// The person, up close. The card flies up from the deck; under it, their details
// (left-aligned, like Apple's contact cards) and round actions to stay in touch.
export default function ZoomView({ person, onClose }) {
  const brand = brandStyle(person.company)
  const glow = brand ?? { '--card-background': 'var(--deq-gradient)', '--card-ink': '#fff' }
  const lightText = glow['--card-ink'].startsWith('#fff') || glow['--card-ink'].startsWith('rgba(255')
  const base = lightText ? '#000' : '#fff'
  const first = person.name.split(' ')[0]
  const days = Math.floor((Date.now() - person.lastContacted) / DAY)
  const due = followUpWindow(person)
  const [spoke, setSpoke] = useState(false)

  // tilt follows the pointer on the card only, softened by a spring
  const pointerX = useMotionValue(0)
  const pointerY = useMotionValue(0)
  const rotateY = useSpring(useTransform(pointerX, [-0.5, 0.5], [-10, 10]), { stiffness: 180, damping: 22 })
  const rotateX = useSpring(useTransform(pointerY, [-0.5, 0.5], [8, -8]), { stiffness: 180, damping: 22 })

  useEffect(() => {
    const onKey = event => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // ---------- actions ----------

  // Remind: pick which calendar, then it opens straight into a new event
  const [choosing, setChoosing] = useState(false)
  const calendars = CALENDARS.map(calendar => ({ ...calendar, run: () => openReminder(person, calendar.id) }))

  function saveContact() {
    // a vCard: iPhone shows "Create New Contact" with everything filled in
    const [given, ...rest] = person.name.split(' ')
    const vcf = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `N:${rest.join(' ')};${given};;;`,
      `FN:${person.name}`,
      companyOf(person) && `ORG:${person.company}`,
      roleOf(person) && `TITLE:${person.role}`,
      person.email && `EMAIL:${person.email}`,
      person.linkedin && `URL:${linkedinUrl(person.linkedin)}`,
      `NOTE:${followUpText(person).replace(/\n/g, '\\n')}`,
      'END:VCARD',
    ]
      .filter(Boolean)
      .join('\r\n')
    window.location.href = `data:text/vcard;charset=utf-8,${encodeURIComponent(vcf)}`
  }

  async function share() {
    const text = [person.name, [roleOf(person), companyOf(person)].filter(Boolean).join(' · '), person.linkedin && linkedinUrl(person.linkedin), person.email]
      .filter(Boolean)
      .join('\n')
    try {
      if (navigator.share) await navigator.share({ title: person.name, text })
      else await navigator.clipboard.writeText(text)
    } catch {
      // closed the share sheet
    }
  }

  async function spokeToday() {
    await db.cards.update(person.id, spokeNow(person, 'In person'))
    setSpoke(true)
    navigator.vibrate?.(12)
  }

  function showOnMap() {
    onClose()
    window.dispatchEvent(new CustomEvent('deq:show-on-map', { detail: person.id }))
  }

  const mail = person.email
    ? `mailto:${person.email}?subject=${encodeURIComponent(`Great meeting you${person.place ? ` at ${person.place.split(',')[0]}` : ''}`)}`
    : null

  // the four that matter most sit right under the name: remind, log, reach out, where
  const message = person.linkedin
    ? { id: 'linkedin', label: 'LinkedIn', icon: <LinkedInIcon />, href: linkedinUrl(person.linkedin) }
    : mail && { id: 'mail', label: 'Mail', icon: <MailIcon />, href: mail }
  const quick = [
    { id: 'spoke', label: spoke ? 'Logged' : 'Spoke Today', icon: <CheckIcon />, run: spokeToday, done: spoke },
    message,
    person.place && { id: 'map', label: 'Map', icon: <PinIcon />, run: showOnMap },
  ].filter(Boolean)

  // more, further down
  const more = [
    person.linkedin && mail && { id: 'mail', label: 'Mail', icon: <MailIcon />, href: mail },
    { id: 'calendar', label: 'Calendar', icon: <CalendarPlusIcon />, run: () => setChoosing(true) },
    { id: 'contact', label: 'Save Contact', icon: <PersonPlusIcon />, run: saveContact },
    { id: 'share', label: 'Share', icon: <ShareIcon />, run: share },
  ].filter(Boolean)

  // ---------- what's on the page, top to bottom ----------
  const next = nextStep(person, days)
  const points = talkingPoints(person.note)
  const timeline = timelineOf(person)
  const vibe = person.vibe ? VIBES[person.vibe - 1] : null
  // the ring fills from the last time you spoke to the day you should reach out
  const fill = person.followUpDays ? Math.min(1, Math.max(0.04, (Date.now() - person.lastContacted) / (person.followUpDays * DAY))) : 0
  const ringColour = next.late ? '#ff3b30' : next.soon ? '#ff9f0a' : '#34c759'
  const short = time => new Date(time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

  const item = index => ({
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE, delay: 0.12 + index * 0.05 } },
    exit: { opacity: 0, transition: { duration: 0.12 } },
  })

  return (
    <motion.div
      className={lightText ? 'zoom light-ink' : 'zoom dark-ink'}
      style={{ color: glow['--card-ink'], background: base }}
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

      <button className="zoom-close" aria-label="Close" onClick={onClose}>
        <CloseIcon size={20} />
      </button>

      {/* the whole page scrolls (even starting on the card); pulling down past
          the top, iPhone's rubber band, closes it like a sheet */}
      <div className="zoom-scroll" onScroll={event => event.currentTarget.scrollTop < -90 && onClose()}>
        <motion.div
          className="zoom-card"
          layoutId={`card-${person.id}`}
          transition={SPRING}
          style={{ rotateX, rotateY, transformPerspective: 1200 }} // its own perspective: no 3D on the scroller, so the page scrolls on iPhone
          onPointerMove={event => {
            const rect = event.currentTarget.getBoundingClientRect()
            pointerX.set((event.clientX - rect.left) / rect.width - 0.5)
            pointerY.set((event.clientY - rect.top) / rect.height - 0.5)
          }}
          onPointerLeave={() => {
            pointerX.set(0)
            pointerY.set(0)
          }}
        >
          <DeqCard person={person} interactive={false} />
        </motion.div>

        <motion.div className="zoom-head" {...item(0)}>
          <h2 className="zoom-name">{person.name}</h2>
          {(roleOf(person) || companyOf(person)) && (
            <p className="zoom-meta">{[person.role, person.company].filter(Boolean).join(' · ')}</p>
          )}
        </motion.div>

        <motion.div className="zoom-actions" {...item(1)}>
          {quick.map(action => (
            <Circle key={action.id} action={action} />
          ))}
        </motion.div>

        {/* 1 · the next step, with a ring that fills as the day gets close */}
        <motion.div className="zoom-next" {...item(2)}>
          <svg className="zoom-ring" viewBox="0 0 60 60" width="60" height="60" aria-hidden="true">
            <circle cx="30" cy="30" r="25" pathLength="1" className="zoom-ring-track" />
            <motion.circle
              cx="30"
              cy="30"
              r="25"
              pathLength="1"
              stroke={ringColour}
              className="zoom-ring-fill"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: fill }}
              transition={{ type: 'spring', bounce: 0, duration: 1.1, delay: 0.35 }}
            />
          </svg>
          <div className="zoom-next-text">
            <b>{person.followUpDays ? (next.late ? 'Reach out now' : `Reach out ${short(next.due)}`) : 'No reminder yet'}</b>
            <span>{person.followUpDays ? next.detail || 'today' : next.label}</span>
          </div>
          <button className="zoom-next-button" onClick={() => setChoosing(true)}>
            Remind
          </button>
        </motion.div>

        {/* 2 · what to talk about */}
        {(points.length > 0 || person.next) && (
          <motion.section className="zoom-block" {...item(3)}>
            <p className="zoom-label">Talk about</p>
            {points.length > 0 && (
              <div className="zoom-chips">
                {points.map(point => (
                  <span key={point}>{point}</span>
                ))}
              </div>
            )}
            {person.next && <p className="zoom-quote">Next time: {person.next}</p>}
          </motion.section>
        )}

        {/* 3 · you and them, oldest first, then what's coming */}
        <motion.section className="zoom-block" {...item(4)}>
          <p className="zoom-label">You and {first}</p>
          <ol className="zoom-timeline">
            {timeline.map(entry => (
              <li key={`${entry.type}-${entry.at}`}>
                <i />
                <b>{entry.type === 'met' ? (person.place ? `Met at ${person.place.split(',')[0]}` : 'Added to your deq') : entry.channel && entry.channel !== 'In person' ? `Spoke on ${entry.channel}` : 'Spoke'}</b>
                <small>{short(entry.at)}</small>
              </li>
            ))}
            {person.followUpDays && (
              <li className={next.late ? 'future late' : 'future'}>
                <i />
                <b>Reach out</b>
                <small>
                  {short(next.due)}
                  {next.detail ? ` · ${next.detail}` : ''}
                </small>
              </li>
            )}
          </ol>
        </motion.section>

        {/* 4 · where you met */}
        {person.place && (
          <motion.section className="zoom-block" {...item(5)}>
            <p className="zoom-label">Where you met</p>
            <button className="zoom-map" onClick={showOnMap} aria-label={`Show ${person.place} on the map`}>
              {person.lat != null && person.lng != null && (
                <Suspense fallback={null}>
                  <MiniMap lat={person.lat} lng={person.lng} />
                </Suspense>
              )}
              <span className="zoom-map-place">{person.place.split(',')[0]}</span>
            </button>
          </motion.section>
        )}

        {/* 5 · how it went */}
        {vibe && (
          <motion.section className="zoom-block" {...item(6)}>
            <p className="zoom-label">How it went</p>
            <div className="zoom-vibe" role="img" aria-label={vibe}>
              {VIBES.map((name, index) => (
                <i key={name} style={index < person.vibe ? { background: VIBE_COLOURS[person.vibe - 1] } : undefined} />
              ))}
            </div>
            <p className="zoom-vibe-text">{vibe}</p>
          </motion.section>
        )}

        <motion.p className="zoom-section" {...item(7)}>
          Stay in touch with {first}
        </motion.p>
        <motion.div className="zoom-actions grid" {...item(8)}>
          {more.map(action => (
            <Circle key={action.id} action={action} />
          ))}
        </motion.div>
      </div>

      <AnimatePresence>
        {choosing && (
          <motion.div
            className="zoom-chooser-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setChoosing(false)}
          >
            <motion.div
              className="zoom-chooser"
              role="dialog"
              aria-label="Add a reminder"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
              onClick={event => event.stopPropagation()}
            >
              <p className="zoom-chooser-title">
                Remind you to follow up with {first}
                <span>{due.start.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}, 10:00</span>
              </p>
              {calendars.map(option => (
                <button
                  key={option.id}
                  onClick={() => {
                    setChoosing(false)
                    option.run()
                  }}
                >
                  {option.label}
                </button>
              ))}
              <button className="cancel" onClick={() => setChoosing(false)}>
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function Circle({ action }) {
  const inner = (
    <>
      <span className={action.done ? 'zoom-circle done' : 'zoom-circle'}>{action.icon}</span>
      <span className="zoom-circle-label">{action.label}</span>
    </>
  )
  return action.href ? (
    <a className="zoom-action" href={action.href} target="_blank" rel="noreferrer">
      {inner}
    </a>
  ) : (
    <button className="zoom-action" onClick={action.run}>
      {inner}
    </button>
  )
}

// ---------- icons, SF Symbols style ----------
const Svg = ({ children }) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)
const MailIcon = () => (
  <Svg>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
    <path d="m4.5 7 7.5 6 7.5-6" />
  </Svg>
)
const PinIcon = () => (
  <Svg>
    <path d="M12 21s-6.5-5.6-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.4-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10" r="2.3" />
  </Svg>
)
const LinkedInIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
    <path d="M6.94 8.5H3.56V20h3.38V8.5ZM5.25 3a1.97 1.97 0 1 0 0 3.94 1.97 1.97 0 0 0 0-3.94ZM20.44 13.4c0-3.1-1.66-4.54-3.87-4.54-1.78 0-2.58.98-3.02 1.67V8.5h-3.38c.04.95 0 11.5 0 11.5h3.38v-6.42c0-.34.02-.69.13-.93.27-.69.89-1.4 1.94-1.4 1.37 0 1.92 1.05 1.92 2.58V20h3.38v-6.6Z" />
  </svg>
)
const CalendarPlusIcon = () => (
  <Svg>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4M12 12.5v5M9.5 15h5" />
  </Svg>
)
const PersonPlusIcon = () => (
  <Svg>
    <circle cx="10" cy="8" r="3.5" />
    <path d="M3.5 19.5a6.5 6.5 0 0 1 13 0M19 8v5M16.5 10.5h5" />
  </Svg>
)
const ShareIcon = () => (
  <Svg>
    <path d="M12 3.5v11M8 7.5l4-4 4 4" />
    <path d="M8.5 10.5H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1.5" />
  </Svg>
)
const CheckIcon = () => (
  <Svg>
    <path d="m5.5 12.5 4.2 4.2 8.8-9.2" />
  </Svg>
)
