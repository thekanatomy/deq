import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useBack } from './back'
import DeqCard from './DeqCard'
import { placeOf, roleKind } from './filters'
import { talkingPoints } from './history'
import { CloseIcon } from './icons'
import { companyOf } from './text'

const DAY = 24 * 60 * 60 * 1000
const EASE = [0.32, 0.72, 0, 1]
const WHEN = [
  { id: 'week', label: 'This week', test: age => age < 7 * DAY },
  { id: 'month', label: 'This month', test: age => age < 31 * DAY },
  { id: 'months', label: 'Last 3 months', test: age => age < 92 * DAY },
  { id: 'earlier', label: 'Earlier', test: age => age >= 92 * DAY },
]

// The most common answers first, so the chips are the ones most likely to help
function top(values, limit) {
  const counts = new Map()
  for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([value]) => value)
}

const metOf = person => person.metAt ?? person.lastContacted
const pointsOf = person => talkingPoints(person.note).map(point => point.toLowerCase())

// "I forgot who someone is": answer what you remember, like a friend asking you
// questions. Every chip comes from your own deq; every tap narrows it down live,
// and the best guesses show as real cards. Forgiving: someone who matches most of
// what you tapped still shows, best match first.
export default function Forgot({ people, onOpenPerson, onClose }) {
  useBack(true, onClose)
  const [picked, setPicked] = useState({}) // question id -> Set of answers

  const questions = useMemo(() => {
    const now = Date.now()
    return [
      { id: 'place', ask: 'Where did you meet?', options: top(people.map(placeOf), 8), test: (person, answer) => placeOf(person) === answer },
      {
        id: 'when',
        ask: 'Roughly when?',
        options: WHEN.filter(when => people.some(person => when.test(now - metOf(person)))).map(when => when.label),
        test: (person, answer) => WHEN.find(when => when.label === answer).test(now - metOf(person)),
      },
      { id: 'role', ask: 'What did they do?', options: top(people.map(roleKind), 8), test: (person, answer) => roleKind(person) === answer },
      { id: 'company', ask: 'Where do they work or study?', options: top(people.map(companyOf), 8), test: (person, answer) => companyOf(person) === answer },
      {
        id: 'note',
        ask: 'Anything that stood out?',
        options: top(people.flatMap(person => talkingPoints(person.note)), 10),
        test: (person, answer) => pointsOf(person).includes(answer.toLowerCase()),
      },
    ].filter(question => question.options.length > 0)
  }, [people])

  const answered = questions.filter(question => picked[question.id]?.size)
  const ranked = useMemo(() => {
    if (!answered.length) return []
    return people
      .map(person => ({
        person,
        score: answered.filter(question => [...picked[question.id]].some(answer => question.test(person, answer))).length,
      }))
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score || metOf(b.person) - metOf(a.person))
      .slice(0, 12)
  }, [people, picked, answered])
  const exact = ranked.filter(entry => entry.score === answered.length).length

  function toggle(question, answer) {
    setPicked(current => {
      const next = new Set(current[question])
      if (next.has(answer)) next.delete(answer)
      else next.add(answer)
      return { ...current, [question]: next }
    })
    navigator.vibrate?.(6)
  }

  return createPortal(
    <motion.div
      className="forgot"
      role="dialog"
      aria-label="Find someone you forgot"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%', transition: { type: 'spring', bounce: 0, duration: 0.3 } }}
      transition={{ type: 'spring', bounce: 0, duration: 0.45 }}
    >
      <div className="forgot-top">
        <button className="w2-close" aria-label="Close" onClick={onClose}>
          <CloseIcon size={20} />
        </button>
      </div>

      <div className="forgot-scroll">
        <h1 className="forgot-title">Who was it?</h1>
        <p className="forgot-sub">Tap what you remember. Skip what you don’t.</p>
        {questions.map(question => (
          <section key={question.id} className="forgot-q">
            <p>{question.ask}</p>
            <div className="forgot-chips">
              {question.options.map(answer => {
                const on = picked[question.id]?.has(answer)
                return (
                  <button key={answer} className={on ? 'on' : ''} aria-pressed={on} onClick={() => toggle(question.id, answer)}>
                    {answer}
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="forgot-results" aria-live="polite">
        <p className="forgot-count">
          {!answered.length
            ? 'Your matches show up here'
            : exact
              ? `${exact} ${exact === 1 ? 'person matches' : 'people match'}`
              : ranked.length
                ? 'No exact match. Closest guesses'
                : 'No one matches yet. Try fewer answers'}
          {ranked.length > 1 && <span> · swipe</span>}
        </p>
        <div className="forgot-strip">
          <AnimatePresence initial={false} mode="popLayout">
            {ranked.map(({ person, score }) => (
              <motion.button
                key={person.id}
                layout
                className={score === answered.length ? 'forgot-card' : 'forgot-card partial'}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3, ease: EASE }}
                onClick={() => {
                  onClose()
                  onOpenPerson(person.id)
                }}
                aria-label={`Open ${person.name}`}
              >
                <DeqCard person={person} interactive={false} />
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>,
    document.body,
  )
}
