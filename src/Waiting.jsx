import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { db } from './db'
import { CloseIcon } from './icons'
import { cascade } from './MenuSheet.jsx'
import { companyOf, roleOf } from './text'

const DAY = 24 * 60 * 60 * 1000
const ROW = { type: 'spring', bounce: 0, duration: 0.45 }

// "Waiting on you": who needs you, sorted by why. Your own reminders first, then
// the people you really clicked with, then everyone quietly fading into the back.
// Each row has the two things you'd do (Slack's "Later" list on Mobbin):
// log that you spoke, or push it back a week.
const SECTIONS = [
  { id: 'reminders', name: 'Reminders', note: 'You asked deq to nudge you.', colour: '#FF3B30' },
  { id: 'important', name: 'Important', note: 'You really clicked. Don’t let these go cold.', colour: '#FF9500' },
  { id: 'fading', name: 'Fading into the back', note: 'It’s been a while. A quick hello still works.', colour: '#8E8E93' },
  { id: 'soon', name: 'Coming up', note: 'Reminders in the next 7 days.', colour: 'var(--tint-fill)' },
]

const dueAt = person => (person.followUpDays ? person.lastContacted + person.followUpDays * DAY : null)

function sectionOf(person, now) {
  const due = dueAt(person)
  if (due && now >= due) return 'reminders'
  if (due && due - now <= 7 * DAY) return 'soon'
  if (due) return null // a reminder further out: not waiting yet
  if (now - person.lastContacted <= 30 * DAY) return null
  return person.vibe >= 4 ? 'important' : 'fading'
}

function reason(person, section, now) {
  const days = n => `${n} ${n === 1 ? 'day' : 'days'}`
  const due = dueAt(person)
  if (section === 'reminders') {
    const late = Math.floor((now - due) / DAY)
    return late === 0 ? 'Reminder due today' : `Reminder was due ${days(late)} ago`
  }
  if (section === 'soon') {
    const left = Math.ceil((due - now) / DAY)
    return left <= 1 ? 'Reminder tomorrow' : `Reminder in ${days(left)}`
  }
  return `${days(Math.floor((now - person.lastContacted) / DAY))} since you spoke`
}

export default function Waiting({ people, onOpenPerson, onClose }) {
  const now = Date.now()
  const [show, setShow] = useState('all')

  const groups = useMemo(() => {
    const byId = Object.fromEntries(SECTIONS.map(section => [section.id, []]))
    for (const person of people) {
      const id = sectionOf(person, now)
      if (id) byId[id].push(person)
    }
    // most overdue first; coming up: soonest first
    byId.reminders.sort((a, b) => dueAt(a) - dueAt(b))
    byId.soon.sort((a, b) => dueAt(a) - dueAt(b))
    byId.important.sort((a, b) => a.lastContacted - b.lastContacted)
    byId.fading.sort((a, b) => a.lastContacted - b.lastContacted)
    return byId
  }, [people, now])

  const options = [
    { id: 'all', name: 'All', count: groups.reminders.length + groups.important.length + groups.fading.length },
    ...SECTIONS.map(section => ({ id: section.id, name: section.id === 'fading' ? 'Fading' : section.name, count: groups[section.id].length })),
  ].filter(option => option.id === 'all' || option.count > 0)

  // a chosen option that emptied out goes back to All
  useEffect(() => {
    if (!options.some(option => option.id === show)) setShow('all')
  }, [options, show])

  const shown = SECTIONS.filter(section => groups[section.id].length > 0 && (show === 'all' || show === section.id))
  const waitingCount = options[0].count

  async function spoke(person) {
    await db.cards.update(person.id, { lastContacted: Date.now(), lastChannel: person.lastChannel ?? 'In person' })
  }
  async function later(person) {
    // due again a week from today
    const since = Math.ceil((Date.now() - person.lastContacted) / DAY)
    await db.cards.update(person.id, { followUpDays: since + 7 })
  }

  let index = 0
  return (
    <motion.div
      className="menu insights waiting"
      role="dialog"
      aria-label="Waiting on you"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.18 } }}
      transition={{ duration: 0.22 }}
    >
      <div className="menu-bar">
        <span />
        <button className="menu-icon" aria-label="Close" onClick={onClose}>
          <CloseIcon size={24} />
        </button>
      </div>

      <div className="insights-scroll">
        <motion.h1 className="categories-title" {...cascade(index++)}>
          Waiting
          <br />
          on you
        </motion.h1>

        <motion.p className="waiting-lead" {...cascade(index++)}>
          {waitingCount === 0
            ? 'You’re all caught up.'
            : `${waitingCount} ${waitingCount === 1 ? 'person' : 'people'} to get back to.`}
        </motion.p>

        {options.length > 1 && (
          <motion.div className="waiting-options" role="tablist" {...cascade(index++)}>
            {options.map(option => (
              <button
                key={option.id}
                role="tab"
                aria-selected={show === option.id}
                className={show === option.id ? 'waiting-option active' : 'waiting-option'}
                onClick={() => setShow(option.id)}
              >
                {option.name}
                <b>{option.count}</b>
              </button>
            ))}
          </motion.div>
        )}

        {shown.length === 0 && (
          <motion.div className="waiting-empty" {...cascade(index++)}>
            <span aria-hidden="true">✓</span>
            <p>No one’s waiting. Nice work.</p>
          </motion.div>
        )}

        {shown.map(section => (
          <motion.section key={section.id} className="waiting-section" {...cascade(index++)}>
            <p className="insight-label" style={{ color: section.colour }}>
              {section.name} <span className="waiting-count">{groups[section.id].length}</span>
            </p>
            <p className="waiting-note">{section.note}</p>
            <ul className="waiting-list">
              <AnimatePresence initial={false}>
                {groups[section.id].map(person => (
                  <motion.li
                    key={person.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, x: 40, transition: { duration: 0.25 } }}
                    transition={ROW}
                    className="waiting-row"
                  >
                    <button className="waiting-person" onClick={() => onOpenPerson(person.id)}>
                      <Avatar person={person} />
                      <span className="waiting-who">
                        <b>{person.name}</b>
                        <span>{[roleOf(person), companyOf(person)].filter(Boolean).join(' · ')}</span>
                        <span className={section.id === 'reminders' ? 'waiting-why due' : 'waiting-why'}>{reason(person, section.id, now)}</span>
                      </span>
                    </button>
                    <div className="waiting-actions">
                      <button className="waiting-done" onClick={() => spoke(person)}>
                        Spoke
                      </button>
                      <button className="waiting-later" aria-label={`Remind me about ${person.name} in a week`} onClick={() => later(person)}>
                        <ClockIcon />
                      </button>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </motion.section>
        ))}
      </div>
    </motion.div>
  )
}

function Avatar({ person }) {
  const url = useMemo(() => (person.photo ? URL.createObjectURL(person.photo) : null), [person.photo])
  useEffect(() => () => url && URL.revokeObjectURL(url), [url])
  const letters = (person.name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0].toUpperCase())
    .join('')
  return <span className="waiting-avatar">{url ? <img src={url} alt="" /> : letters}</span>
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  )
}
