import { AnimatePresence, motion, useDragControls } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { db } from './db'
import { spokeNow } from './history'
import { CloseIcon } from './icons'
import ReachOut from './ReachOut'
import { companyOf, roleOf } from './text'

const DAY = 24 * 60 * 60 * 1000
const ROW = { type: 'spring', bounce: 0, duration: 0.45 }

// Who to get back to, like the Reminders app: plain sections in order of urgency,
// one round tick per person. Ticking is instant (the job is done); a sheet then asks,
// as a bonus, how you reached them, and fills in a missing contact once in a while.
const SECTIONS = [
  { id: 'late', name: 'Late', colour: '#ff453a' },
  { id: 'today', name: 'Today', colour: '#ff9f0a' },
  { id: 'week', name: 'This week', colour: 'var(--label-secondary)' },
  { id: 'cold', name: 'Haven’t talked in a while', colour: 'var(--label-secondary)' },
]

const startOfDay = time => {
  const date = new Date(time)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}
const dueAt = person => (person.followUpDays ? person.lastContacted + person.followUpDays * DAY : null)

function sectionOf(person, today) {
  const due = dueAt(person)
  if (due) {
    const day = startOfDay(due)
    if (day < today) return 'late'
    if (day === today) return 'today'
    if (day - today <= 7 * DAY) return 'week'
    return null
  }
  return Date.now() - person.lastContacted > 30 * DAY ? 'cold' : null
}

function lineFor(person, section, today) {
  const due = dueAt(person)
  const who = [roleOf(person), companyOf(person)].filter(Boolean).join(' · ')
  if (section === 'late') {
    const late = Math.round((today - startOfDay(due)) / DAY)
    return { who: roleOf(person) || companyOf(person), urgent: `${late} ${late === 1 ? 'day' : 'days'} late` }
  }
  if (section === 'today') return { who }
  if (section === 'week') {
    const days = Math.round((startOfDay(due) - today) / DAY)
    return { who: days === 1 ? 'Tomorrow' : new Date(due).toLocaleDateString('en-GB', { weekday: 'long' }) }
  }
  const days = Math.floor((Date.now() - person.lastContacted) / DAY)
  return { who: `Last spoke ${days} days ago` }
}

export default function Waiting({ people, onOpenPerson, onClose }) {
  const today = startOfDay(Date.now())
  // people ticked while this screen is open stay in their row (green), so a tick can be undone
  const [ticked, setTicked] = useState({}) // id -> { before, section, person }
  const [asking, setAsking] = useState(null) // the person the channel sheet is about
  const [changing, setChanging] = useState(null) // the person whose date is being changed
  const drag = useDragControls()

  const groups = useMemo(() => {
    const byId = Object.fromEntries(SECTIONS.map(section => [section.id, []]))
    for (const person of people) {
      if (ticked[person.id]) continue
      const id = sectionOf(person, today)
      if (id) byId[id].push(person)
    }
    for (const { section, person } of Object.values(ticked)) byId[section].push(person)
    for (const list of Object.values(byId)) list.sort((a, b) => (dueAt(a) ?? a.lastContacted) - (dueAt(b) ?? b.lastContacted))
    return byId
  }, [people, ticked, today])

  const open = SECTIONS.reduce((sum, section) => sum + groups[section.id].length, 0) - Object.keys(ticked).length

  async function tick(person, section) {
    if (ticked[person.id]) {
      // undo: put the card back exactly as it was
      const { before } = ticked[person.id]
      await db.cards.update(person.id, before)
      setTicked(current => {
        const next = { ...current }
        delete next[person.id]
        return next
      })
      return
    }
    const before = { lastContacted: person.lastContacted, lastChannel: person.lastChannel ?? null, history: person.history ?? [] }
    setTicked(current => ({ ...current, [person.id]: { before, section, person } }))
    navigator.vibrate?.(12)
    await db.cards.update(person.id, spokeNow(person, null))
    setAsking(person.id)
  }

  const askingPerson = asking ? people.find(person => person.id === asking) : null
  const changingPerson = changing ? people.find(person => person.id === changing) : null

  return (
    <motion.div
      className="menu waiting2"
      role="dialog"
      aria-label="Reach out"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%', transition: { type: 'spring', bounce: 0, duration: 0.3 } }}
      transition={{ type: 'spring', bounce: 0, duration: 0.45 }}
      drag="y"
      dragControls={drag}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.6 }}
      onDragEnd={(_event, info) => (info.offset.y > 120 || info.velocity.y > 600) && onClose()}
    >
      {/* the grabber says "swipe me down"; dragging starts from the top area only, so the list still scrolls */}
      <div className="w2-handle" onPointerDown={event => drag.start(event)}>
        <span className="grabber" aria-hidden="true" />
        <button className="w2-close" aria-label="Close" onClick={onClose}>
          <CloseIcon size={20} />
        </button>
        <h1 className="w2-title">Reach out</h1>
        <p className="w2-lead">
          {open > 0 ? `${open} ${open === 1 ? 'person' : 'people'} to get back to` : 'You’re all caught up'}
        </p>
      </div>

      <div className="w2-scroll">
        {SECTIONS.filter(section => groups[section.id].length > 0).map(section => (
          <section key={section.id} className="w2-section">
            <p className="w2-head" style={{ color: section.colour }}>
              {section.name} <span>{groups[section.id].length}</span>
            </p>
            <ul className="w2-list">
              <AnimatePresence initial={false}>
                {groups[section.id].map(person => {
                  const done = Boolean(ticked[person.id])
                  const line = done ? { who: 'Reached out today' } : lineFor(person, section.id, today)
                  return (
                    <motion.li key={person.id} layout transition={ROW} className={done ? 'w2-row done' : 'w2-row'}>
                      <button
                        className="w2-tick"
                        aria-label={done ? `Undo: reached out to ${person.name}` : `I reached out to ${person.name}`}
                        aria-pressed={done}
                        onClick={() => tick(person, section.id)}
                      >
                        <motion.span initial={false} animate={{ scale: done ? [1, 1.25, 1] : 1 }} transition={{ duration: 0.3 }}>
                          {done && (
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="m5.5 12.5 4 4 9-9" />
                            </svg>
                          )}
                        </motion.span>
                      </button>
                      <button className="w2-person" onClick={() => (done ? onOpenPerson(person.id) : setChanging(person.id))}>
                        <Avatar person={person} />
                        <span className="w2-who">
                          <b>{person.name}</b>
                          <small>
                            {line.who}
                            {line.urgent && (
                              <>
                                {line.who ? ' · ' : ''}
                                <em>{line.urgent}</em>
                              </>
                            )}
                          </small>
                        </span>
                        <span className="w2-chev" aria-hidden="true">›</span>
                      </button>
                    </motion.li>
                  )
                })}
              </AnimatePresence>
            </ul>
          </section>
        ))}

        {open === 0 && Object.keys(ticked).length === 0 && (
          <div className="waiting-empty">
            <span aria-hidden="true">✓</span>
            <p>No one’s waiting. Nice work.</p>
          </div>
        )}

        <p className="w2-hint">Tap the circle when you’ve reached out. Tap a name to change the date.</p>
      </div>

      <AnimatePresence>
        {askingPerson && <ChannelSheet key="channel" person={askingPerson} onClose={() => setAsking(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {changingPerson && <ReachOut key="reach" person={changingPerson} onClose={() => setChanging(null)} />}
      </AnimatePresence>
    </motion.div>
  )
}

// ---------- "How did you reach them?" ----------
const CHANNELS = [
  { id: 'In person', label: 'In person', bg: '#34c759', icon: '🤝' },
  { id: 'LinkedIn', label: 'LinkedIn', bg: '#0a66c2', icon: 'in', field: 'linkedin', ask: 'LinkedIn', placeholder: 'linkedin.com/in/…' },
  { id: 'Messages', label: 'Messages', bg: '#30d158', icon: '💬', field: 'phone', ask: 'phone number', placeholder: '+1 480 555 0100', type: 'tel' },
  { id: 'Instagram', label: 'Instagram', bg: 'linear-gradient(45deg,#f9a825,#e91e63,#8e24aa)', icon: '◎', field: 'instagram', ask: 'Instagram', placeholder: 'username', prefix: '@' },
  { id: 'WhatsApp', label: 'WhatsApp', bg: '#25d366', icon: '✆', field: 'phone', ask: 'phone number', placeholder: '+1 480 555 0100', type: 'tel' },
  { id: 'Mail', label: 'Email', bg: '#0a84ff', icon: '✉', field: 'email', ask: 'email', placeholder: 'name@company.com', type: 'email' },
  { id: 'Call', label: 'Call', bg: '#34c759', icon: '☎', field: 'phone', ask: 'phone number', placeholder: '+1 480 555 0100', type: 'tel' },
  { id: 'Other', label: 'Other', bg: '#636366', icon: '•••' },
]
const ASK_AT_MOST = 3 // "Not now" three times for a field, and deq stops asking

function ChannelSheet({ person, onClose }) {
  const first = person.name.split(' ')[0]
  const [picked, setPicked] = useState(null)
  const [value, setValue] = useState('')
  const drag = useDragControls()
  useEffect(() => {
    // the sheet is a bonus question: Escape closes it, the tick stays
    const onKey = event => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function pick(channel) {
    // the tick already saved "reached out"; now say how, on the card and in its history
    const history = [...(person.history ?? [])]
    const last = history.at(-1)
    if (last?.type === 'spoke' && !last.channel) history[history.length - 1] = { ...last, channel: channel.id }
    await db.cards.update(person.id, { lastChannel: channel.id, history })
    const asked = person.asked?.[channel.field] ?? 0
    if (channel.field && !person[channel.field] && asked < ASK_AT_MOST) setPicked(channel)
    else onClose()
  }

  async function saveContact(event) {
    event.preventDefault()
    const clean = value.trim().replace(/^@/, '')
    if (clean) await db.cards.update(person.id, { [picked.field]: clean })
    onClose()
  }

  async function notNow() {
    const asked = { ...(person.asked ?? {}), [picked.field]: (person.asked?.[picked.field] ?? 0) + 1 }
    await db.cards.update(person.id, { asked })
    onClose()
  }

  return (
    <motion.div className="w2-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="w2-sheet"
        role="dialog"
        aria-label={`How did you reach ${first}?`}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%', transition: { type: 'spring', bounce: 0, duration: 0.28 } }}
        transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
        drag="y"
        dragControls={drag}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.7 }}
        onDragEnd={(_event, info) => (info.offset.y > 80 || info.velocity.y > 500) && onClose()}
        onClick={event => event.stopPropagation()}
      >
        <div className="w2-sheet-handle" onPointerDown={event => drag.start(event)}>
          <span className="grabber" aria-hidden="true" />
        </div>
        {picked ? (
          <form onSubmit={saveContact}>
            <p className="w2-logged">✓ Logged: {picked.label}, today</p>
            <h3 className="w2-sheet-title">
              Add {first}’s {picked.ask}?
            </h3>
            <p className="w2-sheet-text">Next time it’s one tap to reach {first}.</p>
            <label className="w2-field">
              {picked.prefix && <span>{picked.prefix}</span>}
              <input
                autoFocus
                type={picked.type ?? 'text'}
                inputMode={picked.type === 'tel' ? 'tel' : picked.type === 'email' ? 'email' : 'text'}
                autoCapitalize="none"
                autoCorrect="off"
                placeholder={picked.placeholder}
                value={value}
                onChange={event => setValue(event.target.value)}
              />
            </label>
            <button className="primary-button dark" type="submit" disabled={!value.trim()}>
              Save
            </button>
            <button className="flow-skip w2-notnow" type="button" onClick={notNow}>
              Not now
            </button>
          </form>
        ) : (
          <>
            <h3 className="w2-sheet-title">How did you reach {first}?</h3>
            <p className="w2-sheet-text">So deq remembers where you two talk.</p>
            <div className="w2-grid">
              {CHANNELS.map(channel => (
                <button key={channel.id} className="w2-option" onClick={() => pick(channel)}>
                  <i style={{ background: channel.bg }}>{channel.icon}</i>
                  {channel.label}
                </button>
              ))}
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}

function Avatar({ person }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!person.photo) return setUrl(null)
    const next = URL.createObjectURL(person.photo)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [person.photo])
  const letters = (person.name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0].toUpperCase())
    .join('')
  return <span className="waiting-avatar">{url ? <img src={url} alt="" /> : letters}</span>
}
