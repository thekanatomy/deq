import { AnimatePresence, motion } from 'motion/react'
import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { meshImage } from './brands'
import { placeOf } from './filters'
import DateWheel from './Wheel.jsx'
import Forgot from './Forgot'
import { CloseIcon, SearchIcon } from './icons'
import { companyOf, roleOf } from './text'

const PeopleMap = lazy(() => import('./PeopleMap.jsx'))

const DAY = 24 * 60 * 60 * 1000
const SCOPES = ['All', 'Name', 'Place', 'Notes', 'Date', 'Map']
const WHEN = [
  { id: 'week', name: 'This week', from: () => Date.now() - 7 * DAY },
  { id: 'month', name: 'This month', from: () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() },
  { id: 'quarter', name: 'Last 3 months', from: () => Date.now() - 91 * DAY },
  { id: 'older', name: 'Earlier', to: () => Date.now() - 91 * DAY },
]
const RECENT_KEY = 'deq-recent-searches'
const EASE = [0.32, 0.72, 0, 1]

const metAt = person => person.metAt ?? person.lastContacted
const dateText = person =>
  new Date(metAt(person)).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

// What each scope looks at. "All" checks everything, best match first.
const FIELDS = {
  Name: person => [person.name, roleOf(person), companyOf(person)],
  Place: person => [person.place],
  Notes: person => [person.note],
  Date: person => [dateText(person)],
}

function loadRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY)) ?? []
  } catch {
    return []
  }
}

function saveRecent(list) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch {
    // private mode: recent searches just aren't kept
  }
}

// Full-screen search: one field, scopes under it, and before you type, quick ways
// in (recent people, places, when). Results show why each person matched.
export default function Search({ people, startScope = 'All', focusId = null, onOpenPerson, onClose }) {
  const [forgetting, setForgetting] = useState(false)
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState(startScope)
  const [when, setWhen] = useState(null)
  // Date: the day on the wheels, starting on the last day you met someone
  const [day, setDay] = useState(() => new Date(people.length ? Math.max(...people.map(metAt)) : Date.now()))
  const [recent, setRecent] = useState(loadRecent)
  const inputRef = useRef(null)

  useEffect(() => {
    // after the page has slid in, so the keyboard doesn't fight the animation
    // (not when it opens on the map: no keyboard over the map)
    if (startScope === 'Map') return undefined
    const timer = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 260)
    return () => clearTimeout(timer)
  }, [])

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const range = WHEN.find(option => option.id === when)

  const results = useMemo(() => {
    let pool = people
    if (range) {
      const from = range.from?.() ?? -Infinity
      const to = range.to?.() ?? Infinity
      pool = pool.filter(person => metAt(person) >= from && metAt(person) < to)
    }
    if (!words.length) return range ? pool.map(person => ({ person, field: null })) : []
    const scopes = scope === 'All' || scope === 'Map' ? ['Name', 'Place', 'Notes', 'Date'] : [scope]
    const found = []
    for (const person of pool) {
      for (const [rank, name] of scopes.entries()) {
        const text = FIELDS[name](person).filter(Boolean).join(' · ')
        const lower = text.toLowerCase()
        if (words.every(word => lower.includes(word))) {
          found.push({ person, field: name, text, rank, starts: lower.startsWith(words[0]) })
          break
        }
      }
    }
    return found.sort((a, b) => a.rank - b.rank || b.starts - a.starts || metAt(b.person) - metAt(a.person))
  }, [people, words.join(' '), scope, range]) // eslint-disable-line react-hooks/exhaustive-deps

  const places = useMemo(() => topPlaces(people), [people])
  const newest = useMemo(() => [...people].sort((a, b) => metAt(b) - metAt(a)).slice(0, 8), [people])
  const idle = !words.length && !range && scope !== 'Map' && scope !== 'Date'

  // years on the wheel: from the first person you met to this year
  const years = useMemo(() => {
    const first = people.length ? new Date(Math.min(...people.map(metAt))).getFullYear() : new Date().getFullYear()
    const last = new Date().getFullYear()
    return Array.from({ length: last - first + 1 }, (_, i) => first + i)
  }, [people])

  // people met on the wheel's day, then the ones closest to it
  const onDay = useMemo(() => {
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime()
    const end = start + DAY
    const match = person =>
      !words.length || words.every(word => [person.name, person.place, person.note, companyOf(person)].join(' ').toLowerCase().includes(word))
    const pool = people.filter(match)
    const that = pool.filter(person => metAt(person) >= start && metAt(person) < end)
    const around = pool
      .filter(person => !that.includes(person) && Math.abs(metAt(person) - start) < 21 * DAY)
      .sort((a, b) => Math.abs(metAt(a) - start) - Math.abs(metAt(b) - start))
      .slice(0, 8)
    return { that, around }
  }, [people, day, words.join(' ')]) // eslint-disable-line react-hooks/exhaustive-deps

  function open(person) {
    if (query.trim()) {
      const next = [query.trim(), ...recent.filter(item => item !== query.trim())].slice(0, 6)
      setRecent(next)
      saveRecent(next)
    }
    onOpenPerson(person.id)
  }

  function search(text, nextScope = 'All') {
    setQuery(text)
    setScope(nextScope)
    inputRef.current?.blur()
  }

  return (
    <motion.div
      className="search-page"
      role="dialog"
      aria-label="Search"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', bounce: 0, duration: 0.45 }}
    >
      <div className="search-bar">
        <label className="search-field">
          <SearchIcon size={18} />
          <input
            ref={inputRef}
            type="search"
            enterKeyHint="search"
            placeholder={scope === 'Notes' ? 'Red jacket, F1, Chennai…' : 'Name, place, note or date'}
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => event.key === 'Enter' && event.currentTarget.blur()}
            aria-label="Search your deq"
          />
          {query && (
            <button className="search-clear" aria-label="Clear" onClick={() => setQuery('')}>
              <CloseIcon size={14} />
            </button>
          )}
        </label>
        <button className="glass-button" aria-label="Close search" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>

      <div className="search-scopes" role="tablist">
        {SCOPES.map(name => (
          <button
            key={name}
            role="tab"
            aria-selected={scope === name}
            className={scope === name ? 'scope active' : 'scope'}
            onClick={() => setScope(name)}
          >
            {scope === name && <motion.span layoutId="scope-pill" className="scope-pill" transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }} />}
            <span className="scope-name">{name}</span>
          </button>
        ))}
      </div>

      <div className="search-body">
        {scope === 'Date' ? (
          <div className="date-search">
            <DateWheel value={day} years={years} onChange={setDay} />
            <p className="search-count">
              {onDay.that.length ? `Met on ${day.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}` : 'No one that day'}
            </p>
            {onDay.that.map(person => (
              <PersonRow key={person.id} person={person} words={words} onOpen={open} />
            ))}
            {onDay.around.length > 0 && (
              <>
                <p className="search-count">Around then</p>
                {onDay.around.map(person => (
                  <PersonRow key={person.id} person={person} words={words} onOpen={open} showDate />
                ))}
              </>
            )}
          </div>
        ) : scope === 'Map' ? (
          <MapGuard>
            <Suspense fallback={<div className="map-wait" />}>
              <PeopleMap people={words.length || range ? results.map(result => result.person) : people} focusId={focusId} onOpenPerson={open} />
            </Suspense>
          </MapGuard>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            {idle ? (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: EASE }}>
                {people.length > 1 && (
                  <button className="forgot-entry" onClick={() => setForgetting(true)}>
                    <i aria-hidden="true">✨</i>
                    <span>
                      <b>I forgot who someone is</b>
                      <small>Answer a few taps and deq finds them</small>
                    </span>
                    <span className="chev" aria-hidden="true">›</span>
                  </button>
                )}
                {newest.length > 0 && (
                  <section className="search-section">
                    <p className="search-heading">Recently met</p>
                    <div className="face-row">
                      {newest.map(person => (
                        <button key={person.id} className="face-chip" onClick={() => open(person)}>
                          <Avatar person={person} size={56} />
                          <span>{person.name.split(' ')[0]}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {places.length > 0 && (
                  <section className="search-section">
                    <p className="search-heading">Places</p>
                    <div className="chip-wrap">
                      {places.map(place => (
                        <button key={place} className="search-chip" onClick={() => search(place, 'Place')}>
                          {place}
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                <section className="search-section">
                  <p className="search-heading">When</p>
                  <div className="chip-wrap">
                    {WHEN.map(option => (
                      <button key={option.id} className="search-chip" onClick={() => setWhen(option.id)}>
                        {option.name}
                      </button>
                    ))}
                  </div>
                </section>

                {recent.length > 0 && (
                  <section className="search-section">
                    <div className="search-heading-row">
                      <p className="search-heading">Recent searches</p>
                      <button
                        className="text-link"
                        onClick={() => {
                          setRecent([])
                          saveRecent([])
                        }}
                      >
                        Clear
                      </button>
                    </div>
                    {recent.map(item => (
                      <button key={item} className="recent-row" onClick={() => search(item)}>
                        <ClockIcon />
                        <span>{item}</span>
                      </button>
                    ))}
                  </section>
                )}
              </motion.div>
            ) : (
              <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: EASE }}>
                {range && (
                  <button className="when-chip" onClick={() => setWhen(null)}>
                    {range.name}
                    <CloseIcon size={13} />
                  </button>
                )}
                <p className="search-count">
                  {results.length === 0 ? 'No one matches yet' : `${results.length} ${results.length === 1 ? 'person' : 'people'}`}
                </p>
                {results.map(({ person, field, text }, index) => (
                  <motion.button
                    key={person.id}
                    className="result-row"
                    onClick={() => open(person)}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: EASE, delay: Math.min(index, 8) * 0.025 }}
                  >
                    <Avatar person={person} size={44} />
                    <span className="result-text">
                      <span className="result-name">
                        <Highlight text={person.name} words={words} />
                      </span>
                      <span className="result-sub">
                        {field && field !== 'Name' ? (
                          <>
                            <span className="result-field">{field === 'Notes' ? 'Stood out' : field}</span>{' '}
                            <Highlight text={snippet(text, words)} words={words} />
                          </>
                        ) : (
                          <Highlight text={[roleOf(person), companyOf(person)].filter(Boolean).join(' · ') || placeOf(person)} words={words} />
                        )}
                      </span>
                    </span>
                    <span className="result-when">{ago(metAt(person))}</span>
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
      <AnimatePresence>
        {forgetting && <Forgot key="forgot" people={people} onOpenPerson={onOpenPerson} onClose={() => setForgetting(false)} />}
      </AnimatePresence>
    </motion.div>
  )
}

function PersonRow({ person, words, onOpen, showDate }) {
  return (
    <button className="result-row" onClick={() => onOpen(person)}>
      <Avatar person={person} size={44} />
      <span className="result-text">
        <span className="result-name">
          <Highlight text={person.name} words={words} />
        </span>
        <span className="result-sub">{[roleOf(person), companyOf(person)].filter(Boolean).join(' · ') || placeOf(person)}</span>
      </span>
      <span className="result-when">
        {showDate ? new Date(metAt(person)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ago(metAt(person))}
      </span>
    </button>
  )
}

// Their photo, or their initials on their company's colours.
export function Avatar({ person, size }) {
  const url = useMemo(() => (person.photo ? URL.createObjectURL(person.photo) : null), [person.photo])
  useEffect(() => () => url && URL.revokeObjectURL(url), [url])
  const initials = person.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0].toUpperCase())
    .join('')
  return (
    <span className="search-avatar" style={{ width: size, height: size, backgroundImage: url ? `url(${url})` : meshImage(person.company) }}>
      {!url && <span style={{ fontSize: size * 0.36 }}>{initials}</span>}
    </span>
  )
}

function Highlight({ text, words }) {
  if (!text || !words.length) return text || null
  const pattern = new RegExp(`(${words.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  return text.split(pattern).map((part, index) => (index % 2 ? <mark key={index}>{part}</mark> : part))
}

// the part of a long note around the first match
function snippet(text, words) {
  const at = text.toLowerCase().indexOf(words[0] ?? '')
  if (text.length <= 48 || at < 20) return text
  return '…' + text.slice(at - 16)
}

function ago(time) {
  const days = Math.floor((Date.now() - time) / DAY)
  if (days < 1) return 'Today'
  if (days < 7) return `${days}d`
  if (days < 60) return `${Math.floor(days / 7)}w`
  return new Date(time).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
}

function topPlaces(people) {
  const counts = new Map()
  for (const person of people) {
    const place = placeOf(person)
    if (place) counts.set(place, (counts.get(place) ?? 0) + 1)
  }
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([place]) => place)
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  )
}

// If the map can't load (its package missing, offline, an old phone), say why
// here instead of taking the whole app down with it.
class MapGuard extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) {
    return { error }
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="people-map">
        <p className="map-empty">The map couldn’t load: {String(this.state.error.message || this.state.error).slice(0, 140)}</p>
      </div>
    )
  }
}
