import { motion } from 'motion/react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useBack } from './back'
import { db } from './db'
import { spokeNow } from './history'
import { CloseIcon } from './icons'
import DateWheel from './Wheel.jsx'

const DAY = 24 * 60 * 60 * 1000
const QUICK = [
  { label: 'Tomorrow', days: 1 },
  { label: 'Next week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: 'Next month', days: 30 },
]

const startOfDay = time => {
  const date = new Date(time)
  date.setHours(0, 0, 0, 0)
  return date
}

// Tapping "Reach out…" on a card: move the date, leave a note for that day, or log
// that you've already spoken. Every change is kept, so scrolling down shows how the
// plan for this person has moved.
export default function ReachOut({ person, onClose }) {
  useBack(true, onClose)
  const first = person.name.split(' ')[0]
  const today = startOfDay(Date.now())
  const current = person.followUpDays ? startOfDay(person.lastContacted + person.followUpDays * DAY) : new Date(today.getTime() + 7 * DAY)
  const [date, setDate] = useState(current < today ? new Date(today.getTime() + DAY) : current)
  const [note, setNote] = useState(person.next ?? '')
  // after "I already spoke…": ask whether to plan the next time, before showing the dates again
  const [again, setAgain] = useState(false)
  const [spokeAt, setSpokeAt] = useState(null)
  const changes = (person.history ?? []).filter(entry => entry.type === 'plan').reverse()
  const years = [today.getFullYear(), today.getFullYear() + 1]
  const inDays = Math.round((date - today) / DAY)

  async function save() {
    const due = date.getTime()
    const followUpDays = Math.max(1, Math.ceil((due - startOfDay(spokeAt ?? person.lastContacted).getTime()) / DAY))
    const history = [...(person.history ?? []), { type: 'plan', at: Date.now(), due, note: note.trim() }].slice(-30)
    await db.cards.update(person.id, { followUpDays, next: note.trim(), history })
    navigator.vibrate?.(12)
    onClose()
  }

  async function spokeToday() {
    const changes = spokeNow(person, person.lastChannel ?? 'In person')
    await db.cards.update(person.id, changes)
    navigator.vibrate?.(12)
    setSpokeAt(changes.lastContacted)
    setAgain(true)
  }

  // "Reach out again?" Yes: back to the dates, starting a week from today, with a fresh note
  function planAgain() {
    setDate(new Date(today.getTime() + 7 * DAY))
    setNote('')
    setAgain(false)
  }

  // No: no reminder for now; they stay in your deq, quietly
  async function noReminder() {
    await db.cards.update(person.id, { followUpDays: null, next: '' })
    onClose()
  }

  const long = time => new Date(time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

  return createPortal(
    <motion.div
      className="reach-page"
      role="dialog"
      aria-label={`Reach out to ${first}`}
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%', transition: { type: 'spring', bounce: 0, duration: 0.3 } }}
      transition={{ type: 'spring', bounce: 0, duration: 0.45 }}
      onClick={event => event.stopPropagation()}
    >
      <div className="reach-top">
        <button className="flow-icon" aria-label="Close" onClick={onClose}>
          <CloseIcon size={20} />
        </button>
      </div>

      {again ? (
        <motion.div
          className="reach-again"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
        >
          <span className="reach-again-tick" aria-hidden="true">
            ✓
          </span>
          <h2 className="reach-title">Nice, logged for today</h2>
          <p className="reach-in">Do you want to reach out to {first} again?</p>
          <button className="primary-button" onClick={planAgain}>
            Yes, pick a date
          </button>
          <button className="flow-skip reach-spoke" onClick={noReminder}>
            No, not for now
          </button>
        </motion.div>
      ) : (
      <div className="reach-scroll">
        <h2 className="reach-title">Reach out to {first}</h2>
        <p className="reach-date">{date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <p className="reach-in">{inDays <= 0 ? 'Today' : inDays === 1 ? 'Tomorrow' : `In ${inDays} days`}</p>

        <div className="reach-quick">
          {QUICK.map(option => (
            <button
              key={option.label}
              className={inDays === option.days ? 'active' : ''}
              onClick={() => setDate(new Date(today.getTime() + option.days * DAY))}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="reach-wheel">
          <DateWheel value={date} years={years} onChange={next => setDate(next < today ? today : next)} />
        </div>

        <label className="reach-label" htmlFor="reach-note">
          Note for that day
        </label>
        <textarea
          id="reach-note"
          className="answer note reach-note"
          rows={3}
          placeholder="Ask about the Seattle team, send my portfolio…"
          value={note}
          onChange={event => setNote(event.target.value)}
        />

        <button className="primary-button" onClick={save}>
          Save
        </button>
        {!spokeAt && (
          <button className="flow-skip reach-spoke" onClick={spokeToday}>
            I already spoke to {first} today
          </button>
        )}

        {changes.length > 0 && (
          <section className="reach-changes">
            <p className="zoom-label">Changes</p>
            <ol>
              {changes.map(change => (
                <li key={change.at}>
                  <b>Reach out {long(change.due)}</b>
                  {change.note && <span>{change.note}</span>}
                  <small>Changed {long(change.at)}</small>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
      )}
    </motion.div>,
    document.body,
  )
}
