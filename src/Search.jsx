import { AnimatePresence, motion } from 'motion/react'
import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { meshImage } from './brands'
import { placeOf } from './filters'
import DateWheel from './Wheel.jsx'
import Forgot from './Forgot'
import { talkingPoints } from './history'
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
  Notes: person => [person.note, person.next],
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
                    <i aria-hidden="true">
                      {/* a person with a question mark, SF Symbols style */}
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="9.5" cy="8" r="3.5" />
                        <path d="M3 20a6.5 6.5 0 0 1 11.2-4.5" />
                        <path d="M16.6 14.4a2.4 2.4 0 1 1 3.2 2.3c-.6.2-1 .7-1 1.3v.3M18.8 21h.01" />
                      </svg>
                    </i>
                    <span>
                      <b>Can’t remember someone?</b>
                      <small>Find them by where, when or what stood out</small>
                    </span>
                    <span className="chev" aria-hidden="true">›</span>
                  </button>
                )}
                {scope === 'Name' && <NameHelp people={people} onOpen={open} />}
                {scope === 'Notes' && <NotesFeed people={people} words={[]} onOpen={open} />}
                {scope === 'Place' && <PlaceHelp people={people} onMap={() => setScope('Map')} onPlace={place => search(place, 'Place')} />}
                {!['Name', 'Place', 'Notes'].includes(scope) && newest.length > 0 && (
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

                {!['Name', 'Place', 'Notes'].includes(scope) && places.length > 0 && (
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

                {!['Name', 'Place', 'Notes'].includes(scope) && (
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
                )}

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
                {scope === 'Notes' ? (
                  <NotesFeed people={results.map(result => result.person)} words={words} onOpen={open} />
                ) : (
                <>
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
                </>
                )}
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

// Name search when the name won't come: the first letter, their face, or the
// thing you remember them by. Only letters someone's name starts with can be tapped.
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
function NameHelp({ people, onOpen }) {
  const [letter, setLetter] = useState(null)
  const [hook, setHook] = useState(null)
  const [company, setCompany] = useState(null)
  const initials = useMemo(() => new Set(people.map(person => person.name.trim()[0]?.toUpperCase())), [people])
  const faces = useMemo(() => people.filter(person => person.photo).slice(0, 12), [people])
  const hooks = useMemo(() => {
    const counts = new Map()
    for (const person of people) for (const point of talkingPoints(person.note)) counts.set(point, (counts.get(point) ?? 0) + 1)
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([point]) => point)
  }, [people])

  const byLetter = letter ? people.filter(person => person.name.trim()[0]?.toUpperCase() === letter) : []
  const byHook = hook ? people.filter(person => talkingPoints(person.note).includes(hook)) : []
  // most cards have no photo, but almost all have a company: the colours jog the memory
  const companies = useMemo(() => {
    const counts = new Map()
    for (const person of people) {
      const name = companyOf(person)
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [people])
  const byCompany = company ? people.filter(person => companyOf(person) === company) : []

  return (
    <>
      <section className="search-section">
        <p className="search-heading">It starts with…</p>
        <div className="letter-pad">
          {LETTERS.map(char => (
            <button
              key={char}
              className={letter === char ? 'on' : ''}
              disabled={!initials.has(char)}
              aria-pressed={letter === char}
              onClick={() => setLetter(current => (current === char ? null : char))}
            >
              {char}
            </button>
          ))}
        </div>
        {byLetter.map(person => (
          <PersonRow key={person.id} person={person} words={[]} onOpen={onOpen} showDate />
        ))}
      </section>

      {companies.length > 0 && (
        <section className="search-section">
          <p className="search-heading">Where they work or study</p>
          <div className="company-tiles">
            {companies.map(([name, count]) => (
              <button
                key={name}
                className={company === name ? 'company-tile on' : 'company-tile'}
                style={{ backgroundImage: meshImage(name) }}
                aria-pressed={company === name}
                onClick={() => setCompany(current => (current === name ? null : name))}
              >
                <b>{name}</b>
                <small>{count === 1 ? '1 person' : `${count} people`}</small>
              </button>
            ))}
          </div>
          {byCompany.map(person => (
            <PersonRow key={person.id} person={person} words={[]} onOpen={onOpen} showDate />
          ))}
        </section>
      )}

      {/* faces only help once there are a few of them */}
      {faces.length >= 4 && (
        <section className="search-section">
          <p className="search-heading">You’d know their face</p>
          <div className="face-grid">
            {faces.map(person => (
              <button key={person.id} className="face-chip" onClick={() => onOpen(person)}>
                <Avatar person={person} size={64} />
                <span>{person.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {hooks.length > 0 && (
        <section className="search-section">
          <p className="search-heading">You remember them as…</p>
          <div className="chip-wrap">
            {hooks.map(point => (
              <button key={point} className={hook === point ? 'search-chip on' : 'search-chip'} onClick={() => setHook(current => (current === point ? null : point))}>
                {point}
              </button>
            ))}
          </div>
          {byHook.map(person => (
            <PersonRow key={person.id} person={person} words={[]} onOpen={onOpen} showDate />
          ))}
        </section>
      )}
    </>
  )
}

// Place search, simply: a map you can open, then every place you've met people,
// with how many and who.
function PlaceHelp({ people, onMap, onPlace }) {
  const places = useMemo(() => {
    const byPlace = new Map()
    for (const person of people) {
      const place = placeOf(person)
      if (!place) continue
      if (!byPlace.has(place)) byPlace.set(place, [])
      byPlace.get(place).push(person)
    }
    return [...byPlace].sort((a, b) => b[1].length - a[1].length)
  }, [people])

  return (
    <>
      <button className="place-map-tile" onClick={onMap}>
        <span className="place-map-art" aria-hidden="true">
          <i style={{ left: '30%', top: '42%' }} />
          <i style={{ left: '62%', top: '30%' }} />
          <i style={{ left: '52%', top: '64%' }} />
        </span>
        <span className="place-map-text">
          <b>Open the map</b>
          <small>
            {places.length} {places.length === 1 ? 'place' : 'places'} where you’ve met people
          </small>
        </span>
        <span className="chev" aria-hidden="true">›</span>
      </button>

      {places.length > 0 && (
        <section className="search-section">
          <p className="search-heading">Where you’ve met people</p>
          <div className="place-list">
            {places.map(([place, here]) => (
              <button key={place} className="place-row" onClick={() => onPlace(place)}>
                <span className="place-pin" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 21s-6.5-5.6-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.4-6.5 11-6.5 11Z" />
                    <circle cx="12" cy="10" r="2.3" />
                  </svg>
                </span>
                <span className="place-text">
                  <b>{place}</b>
                  <small>{here.slice(0, 3).map(person => person.name.split(' ')[0]).join(', ')}{here.length > 3 ? ` +${here.length - 3}` : ''}</small>
                </span>
                <span className="place-count">{here.length}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  )
}

// Notes search: every note as a little card, newest first. Typing a word keeps
// only the notes that mention it, with the word highlighted.
function NotesFeed({ people, words, onOpen }) {
  const notes = people
    .filter(person => person.note?.trim() || person.next?.trim())
    .sort((a, b) => metAt(b) - metAt(a))
  if (!notes.length) {
    return (
      <p className="search-count">
        {words.length ? 'No note mentions that yet' : 'Notes you write in “What stood out?” show up here'}
      </p>
    )
  }
  return (
    <>
      <p className="search-count">
        {notes.length} {notes.length === 1 ? 'note' : 'notes'}
      </p>
      <div className="note-feed">
        {notes.map(person => (
          <button key={person.id} className="note-card" onClick={() => onOpen(person)}>
            {person.note?.trim() && (
              <p className="note-text">
                “<Highlight text={person.note.trim()} words={words} />”
              </p>
            )}
            {person.next?.trim() && (
              <p className="note-next">
                Next time: <Highlight text={person.next.trim()} words={words} />
              </p>
            )}
            <span className="note-who">
              <Avatar person={person} size={24} />
              {person.name}
              <span>· {ago(metAt(person))}</span>
            </span>
          </button>
        ))}
      </div>
    </>
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
