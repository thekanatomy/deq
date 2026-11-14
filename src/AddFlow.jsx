import { AnimatePresence, motion } from 'motion/react'
import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { CloseIcon } from './icons'
import { detectPlace } from './location'
import { parseScan } from './scan'
import { readPhoto } from './vision'
import { cropFace, cropSquare } from './face'
import { searchPlaces } from './places'
import DateWheel from './Wheel.jsx'
import { CALENDARS, openReminder } from './calendar'
import ScanReading from './ScanReading'
import NoteBuilder from './NoteBuilder'
import { useBack } from './back'
import { busy, clearDraft, saveDraft } from './draft'

const MiniMap = lazy(() => import('./MiniMap.jsx'))

// Adding someone on one screen, stacked like Airbnb's search: one card open at a time,
// the rest are slim rows showing their answer. Names come from the QR, a pasted LinkedIn
// link or a photo the AI reads; the place comes from your location and shows on a map.
// After a scan the stack opens and closes card by card to show what it filled in.
const VIBES = ['Quick hello', 'Nice chat', 'Good conversation', 'Really clicked', 'Must stay in touch']
const FOLLOW_UPS = [
  { days: 3, label: 'in 3 days' },
  { days: 7, label: 'in a week' },
  { days: 14, label: 'in 2 weeks' },
  { days: 30, label: 'in a month' },
  { days: 90, label: 'in 3 months' },
  { days: null, label: 'No reminder' },
]

const DAY = 24 * 60 * 60 * 1000

// A calendar reminder is chosen per person, never remembered: picking Apple Calendar
// once used to quietly make a calendar event for everyone added after.
try {
  localStorage.removeItem('deq-remind-with') // the old remembered choice, from before
} catch {
  // nothing to clear
}

const SOURCES = { card: 'their card', badge: 'their badge', screen: 'the screen', person: 'the photo', other: 'the photo' }

export default function AddFlow({ initial: given, recentPlaces, placeCoords, onSave, onClose }) {
  // coming back to a half-added person after the phone closed the app
  const { _restored: restored, ...initial } = given
  const [fields, setFields] = useState({
    name: '',
    role: '',
    company: '',
    place: '',
    linkedin: '',
    phone: '',
    email: '',
    note: '',
    next: '',
    vibe: 3,
    followUpDays: 7,
    remindWith: null, // "Just deq" unless you pick a calendar for this person
    ...initial,
  })
  // one card open at a time, Airbnb-style
  const [open, setOpen] = useState(restored || 'who')
  const [locating, setLocating] = useState(initial.place ? 'idle' : 'finding') // idle | finding | found | failed | blocked | elsewhere
  const needsReading = Boolean(initial.scanImage) && !(initial.name && initial.company)
  const [reading, setReading] = useState(needsReading ? 'reading' : 'idle') // idle | reading | done | read | failed | busy
  const [readFrom, setReadFrom] = useState('')
  const inputRef = useRef(null)
  const foundRef = useRef(null) // the place the phone found, to switch back to
  const nameRef = useRef(null)
  const fieldsRef = useRef(fields)
  useEffect(() => {
    fieldsRef.current = fields
  })

  // After a scan, the stack opens and closes card by card to show what was filled in,
  // then settles on the first thing only you can answer. Any touch stops it at once.
  const magicRef = useRef([])
  const [magic, setMagic] = useState(false)
  function stopMagic() {
    magicRef.current.forEach(clearTimeout)
    magicRef.current = []
    setMagic(false)
  }
  function playMagic() {
    stopMagic()
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return setOpen('vibe')
    setMagic(true)
    const beats = [['who', 0], ['where', 1300], ['vibe', 2600]]
    magicRef.current = beats.map(([key, at], index) =>
      setTimeout(() => {
        setOpen(key)
        if (index === beats.length - 1) setMagic(false)
      }, at),
    )
  }
  useEffect(() => () => magicRef.current.forEach(clearTimeout), [])
  // scanned from a QR code or a LinkedIn link: the answers are already here
  useEffect(() => {
    if (!initial.name || initial.scanImage || restored) return
    const start = setTimeout(playMagic, 450) // once the sheet has slid up
    return () => clearTimeout(start)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Find their face in the scan at the same time as the AI reads it: a face becomes
  // the avatar, cut out like a profile picture. No face: the scan itself, cut square,
  // is the avatar by default (you can change it on the card later).
  const faceRef = useRef(null)
  useEffect(() => {
    if (!initial.scanImage) return
    let cancelled = false
    cropFace(initial.scanImage).then(async face => {
      const avatar = face ?? (await cropSquare(initial.photo ?? initial.scanImage))
      if (cancelled || !avatar) return
      faceRef.current = avatar
      setFields(previous => ({ ...previous, photo: avatar }))
    })
    return () => {
      cancelled = true
    }
  }, [initial.scanImage])

  // Read the photo with the AI. Only empty answers are filled, so nothing you typed is overwritten.
  useEffect(() => {
    if (!needsReading) return
    const controller = new AbortController()
    let advance
    // never keep you waiting forever: after 25 s, stop and let you type
    const giveUp = setTimeout(() => {
      controller.abort()
      setReading('busy')
    }, 25_000)
    readPhoto(initial.scanImage, { signal: controller.signal }).then(found => {
      if (controller.signal.aborted) return
      clearTimeout(giveUp)
      const { kind, busy, ...details } = found
      if (busy) return setReading('busy')
      if (!details.name && !details.company) return setReading('failed')
      const previous = fieldsRef.current
      const filled = { ...previous }
      for (const [key, value] of Object.entries(details)) if (!String(previous[key] ?? '').trim()) filled[key] = value
      // the avatar: their face if one was found, else the scan cut square
      if (faceRef.current) filled.photo = faceRef.current
      setFields(filled)
      setReadFrom(SOURCES[kind] ?? SOURCES.other)
      setReading('done') // the found words fly into their card
      navigator.vibrate?.(15)
      advance = setTimeout(() => {
        setReading('read')
        playMagic()
      }, 1900) // long enough for the card to land
    })
    return () => {
      controller.abort()
      clearTimeout(giveUp)
      clearTimeout(advance)
    }
    // the photo is fixed for the life of the flow
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])


  // Typing a place: a short list of real places under the field. Picking one
  // saves its coordinates too, so the person lands on the map.
  const [placeTyped, setPlaceTyped] = useState(false)
  const [placeOptions, setPlaceOptions] = useState([])
  useEffect(() => {
    const text = fields.place.trim()
    if (!placeTyped || text.length < 3) return setPlaceOptions([])
    const controller = new AbortController()
    const timer = setTimeout(() => {
      searchPlaces(text, foundRef.current, controller.signal)
        .then(setPlaceOptions)
        .catch(() => {})
    }, 280)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [fields.place, placeTyped])

  function pickPlace(option) {
    setFields(previous => ({ ...previous, place: option.place, lat: option.lat, lng: option.lng }))
    setPlaceTyped(false)
    setPlaceOptions([])
  }

  // while the photo is read, typing waits: the answers are about to fill in
  const waiting = reading === 'reading' || reading === 'done'
  const hasName = fields.name.trim().length > 0
  const [pickingDate, setPickingDate] = useState(false)

  // Ask for location as soon as the flow opens, so it's ready by the time you get there.
  useEffect(() => {
    if (initial.place) return
    let cancelled = false
    detectPlace()
      .then(found => {
        if (cancelled) return
        if (found.place) foundRef.current = found
        setFields(previous => (previous.place ? previous : { ...previous, ...found }))
        setLocating(found.place ? 'found' : 'failed')
      })
      // code 1: location is blocked for this site, which needs a different fix than "not found"
      .catch(error => !cancelled && setLocating(error?.code === 1 ? 'blocked' : 'failed'))
    return () => {
      cancelled = true
    }
  }, [initial.place])

  function set(key, value) {
    setFields(previous => ({ ...previous, [key]: value }))
  }

  // Paste a LinkedIn link (or a vCard) into the name box and it fills itself in.
  function onNameChange(value) {
    const parsed = /linkedin\.com\/in\//i.test(value) || /^BEGIN:VCARD/i.test(value) ? parseScan(value) : null
    if (parsed?.name) setFields(previous => ({ ...previous, ...parsed }))
    else set('name', value)
  }

  function save() {
    if (!hasName) return
    // which calendar is a one-time action, not part of the person
    const { scanImage: _scanImage, remindWith, ...kept } = fields
    const clean = Object.fromEntries(
      Object.entries(kept).map(([key, entry]) => [key, typeof entry === 'string' ? entry.trim() : entry]),
    )
    clearDraft()
    onSave(clean)
    // Google Calendar opens right here, inside the tap on Add, after the save has
    // started: phones only let a tap open another app, and a wait would lose it.
    if (remindWith && clean.followUpDays) openReminder({ ...clean, lastContacted: Date.now() }, remindWith)
  }

  // keep the half-added person on the phone, so leaving the app loses nothing
  useEffect(() => {
    busy.adding = true
    return () => {
      busy.adding = false
    }
  }, [])
  useEffect(() => {
    const touched = ['name', 'phone', 'company', 'role', 'note', 'next'].some(key => String(fields[key] ?? '').trim())
    if (!touched) return
    const timer = setTimeout(() => saveDraft(fields, open), 250)
    return () => clearTimeout(timer)
  }, [fields, open])

  function close() {
    clearDraft()
    onClose()
  }

  // an empty name card gets the keyboard straight away
  useEffect(() => {
    if (open === 'who' && !waiting && !fieldsRef.current.name) nameRef.current?.focus({ preventScroll: true })
  }, [open, waiting])

  // the phone's Back closes the flow
  useBack(true, close)

  // Enter moves to the next card, like Return on a form
  const ORDER = ['who', 'where', 'vibe', 'followUp', 'note', 'next']
  function onKeyDown(event) {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    if (open === 'who' && !hasName) return
    // next field in the same card first, then the next card
    const inputs = [...(event.currentTarget.closest('.stack-body')?.querySelectorAll('input') ?? [])]
    const nextInput = inputs[inputs.indexOf(event.currentTarget) + 1]
    if (nextInput) return nextInput.focus()
    const after = ORDER[ORDER.indexOf(open) + 1]
    if (after) openCard(after)
    else event.currentTarget.blur()
  }

  function openCard(key) {
    stopMagic()
    setOpen(previous => (previous === key ? null : key))
    // once it has opened, glide it into view if it's below the fold
    setTimeout(() => document.querySelector(`[data-card="${key}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 380)
  }

  function tryAdd() {
    if (hasName) return save()
    stopMagic()
    flushSync(() => setOpen('who'))
    nameRef.current?.focus()
  }

  function clearAll() {
    stopMagic()
    setFields(previous => ({
      ...previous,
      name: '', role: '', company: '', linkedin: '', phone: '', email: '', note: '', next: '',
      photo: undefined, vibe: 3, followUpDays: 7,
      ...(foundRef.current ?? { place: '', lat: undefined, lng: undefined }),
    }))
    setLocating(foundRef.current ? 'found' : locating)
    flushSync(() => setOpen('who'))
    nameRef.current?.focus()
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const reachOn = new Date(today.getTime() + (fields.followUpDays ?? 7) * DAY)
  const wheelYears = [today.getFullYear(), today.getFullYear() + 1]

  const firstName = fields.name.trim().split(' ')[0]
  const followLabel = fields.followUpDays
    ? FOLLOW_UPS.find(option => option.days === fields.followUpDays)?.label ??
      reachOn.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    : 'No reminder'
  const scannedFrom = reading === 'read' ? readFrom : initial.name && !restored ? (initial.linkedin ? 'LinkedIn' : 'their code') : ''

  // One card of the stack: a slim row with its answer when closed, the question and
  // its fields when open. Only the body changes height, so nothing stretches.
  function card(id, label, question, value, body) {
    const isOpen = open === id
    return (
      <section className={isOpen ? 'stack-card open' : 'stack-card'} key={id} data-card={id}>
        {/* the header keeps its height either way; only its words cross-fade */}
        <button className={isOpen ? 'stack-head open' : 'stack-head'} onClick={() => openCard(id)} aria-expanded={isOpen}>
          <motion.span
            key={isOpen ? 'question' : 'row'}
            className="stack-head-in"
            initial={{ opacity: 0, y: isOpen ? 6 : -4, scale: isOpen ? 0.97 : 1.02 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.42 }}
          >
            {isOpen ? (
              <h3>{question}</h3>
            ) : (
              <>
                <span>{label}</span>
                <b className={value ? undefined : 'stack-empty'}>{value || 'Add'}</b>
              </>
            )}
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              className="stack-body-clip"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.5, opacity: { duration: 0.2 } }}
            >
              <div className="stack-body">{body}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    )
  }

  return (
    <motion.div
      className={magic ? 'flow stacked magic' : 'flow stacked'}
      // from a scan, the frozen photo replaces the camera in place; otherwise slide up
      initial={needsReading ? false : { y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%', transition: { type: 'spring', bounce: 0, duration: 0.3 } }}
      transition={{ type: 'spring', bounce: 0, duration: 0.45 }}
    >
      <AnimatePresence>
        {waiting && (
          <ScanReading
            key="scan-reading"
            image={initial.photo ?? initial.scanImage}
            phase={reading === 'done' ? 'done' : 'reading'}
            person={fields}
          />
        )}
      </AnimatePresence>

      <div className="stack-top">
        <h2>Add someone</h2>
        <button className="flow-icon" aria-label="Close" onClick={close}>
          <CloseIcon />
        </button>
      </div>

      <div className="stack" onPointerDown={() => magic && stopMagic()}>
        {card(
          'who',
          'Who',
          'Who did you meet?',
          fields.name.trim() && (
            <>
              {fields.photo && <img className="stack-avatar" src={fields.photo} alt="" />}
              {fields.name.trim()}
            </>
          ),
          <>
            {scannedFrom && <p className="stack-scanned">Filled in from {scannedFrom}</p>}
            <input
              ref={nameRef}
              className={fields.name ? 'stack-field filled' : 'stack-field'}
              placeholder={waiting ? 'Reading the photo…' : 'Name, or paste their LinkedIn link'}
              readOnly={waiting}
              aria-busy={waiting}
              autoCapitalize="words"
              autoCorrect="off"
              autoComplete="off"
              enterKeyHint="next"
              value={fields.name}
              onChange={event => onNameChange(event.target.value)}
              onKeyDown={onKeyDown}
            />
            {/* the most common swap in person: "here's my number" */}
            <input
              className={fields.phone ? 'stack-field filled' : 'stack-field'}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="Phone number (optional)"
              enterKeyHint="next"
              value={fields.phone ?? ''}
              onChange={event => set('phone', event.target.value)}
              onKeyDown={onKeyDown}
            />
            <div className="stack-pair">
              <input
                className={fields.role ? 'stack-field filled' : 'stack-field'}
                placeholder="Role"
                enterKeyHint="next"
                value={fields.role}
                onChange={event => set('role', event.target.value)}
                onKeyDown={onKeyDown}
              />
              <input
                className={fields.company ? 'stack-field filled' : 'stack-field'}
                placeholder="Company"
                autoCapitalize="words"
                enterKeyHint="next"
                value={fields.company}
                onChange={event => set('company', event.target.value)}
                onKeyDown={onKeyDown}
              />
            </div>
            {reading === 'failed' && <p className="stack-note">Couldn’t read a name from the photo.</p>}
            {reading === 'busy' && <p className="stack-note">Photo reading is busy right now. Type the name for this one.</p>}
            {fields.linkedin && <p className="stack-note ok-note">LinkedIn linked ✓</p>}
          </>,
        )}

        {card(
          'where',
          'Where',
          'Where did you meet?',
          fields.place ? fields.place.split(',')[0] : locating === 'finding' ? 'Finding…' : '',
          <>
            {fields.lat != null && fields.lng != null && (
              <div className="stack-map">
                <LaterMap lat={fields.lat} lng={fields.lng} />
                {locating === 'found' && fields.place === foundRef.current?.place && <span className="stack-map-tag">You’re here</span>}
              </div>
            )}
            {!fields.place && (
              <p className="stack-note quiet">
                {locating === 'finding' && 'Finding where you are…'}
                {locating === 'failed' && 'Couldn’t find your location. Type the place.'}
                {locating === 'blocked' && 'Location is off for deq. Type the place, or allow it in your browser’s site settings.'}
              </p>
            )}
            <input
              ref={inputRef}
              className={fields.place ? 'stack-field filled' : 'stack-field'}
              placeholder="Career Fair, Hayden Library…"
              enterKeyHint="next"
              value={fields.place}
              onChange={event => {
                const place = event.target.value
                // a typed place has no coordinates until one is picked from the list
                setFields(previous => ({ ...previous, place, lat: undefined, lng: undefined }))
                setPlaceTyped(true)
                setLocating(locating === 'found' ? 'elsewhere' : locating)
              }}
              onKeyDown={onKeyDown}
              autoComplete="off"
              aria-autocomplete="list"
              aria-controls="place-options"
            />
            {placeOptions.length > 0 && (
              <ul id="place-options" className="place-options stack-options" role="listbox">
                {placeOptions.map(option => (
                  <li key={option.place} role="option" aria-selected="false">
                    <button onMouseDown={event => event.preventDefault()} onClick={() => pickPlace(option)}>
                      <PinIcon />
                      <span>
                        <b>{option.name}</b>
                        {option.detail && <small>{option.detail}</small>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="stack-chips">
              {foundRef.current && fields.place !== foundRef.current.place && (
                <button
                  className="stack-chip"
                  onClick={() => {
                    setFields(previous => ({ ...previous, ...foundRef.current }))
                    setLocating('found')
                  }}
                >
                  <PinIcon /> {foundRef.current.place.split(',')[0]}
                </button>
              )}
              {recentPlaces
                .filter(place => place !== fields.place && place !== foundRef.current?.place)
                .slice(0, 4)
                .map(place => (
                  <button key={place} className="stack-chip" onClick={() => pickPlace({ place, ...placeCoords?.[place] })}>
                    {place.split(',')[0]}
                  </button>
                ))}
            </div>
          </>,
        )}

        {card(
          'vibe',
          'How it went',
          'How did it go?',
          VIBES[fields.vibe - 1],
          <div className="stack-chips">
            {VIBES.map((vibe, index) => (
              <button
                key={vibe}
                className={fields.vibe === index + 1 ? 'stack-chip on' : 'stack-chip'}
                style={{ '--dot': VIBE_COLOURS[index] }}
                onClick={() => {
                  set('vibe', index + 1)
                  navigator.vibrate?.(6)
                }}
              >
                <i className="stack-dot" aria-hidden="true" />
                {vibe}
              </button>
            ))}
          </div>,
        )}

        {card(
          'followUp',
          'Reach out',
          'When should you reach out?',
          followLabel.charAt(0).toUpperCase() + followLabel.slice(1),
          <>
            <div className="stack-chips">
              {FOLLOW_UPS.map(option => (
                <button
                  key={option.label}
                  className={fields.followUpDays === option.days ? 'stack-chip on' : 'stack-chip'}
                  onClick={() => set('followUpDays', option.days)}
                >
                  {option.label.charAt(0).toUpperCase() + option.label.slice(1)}
                </button>
              ))}
            </div>
            {fields.followUpDays && (
              <>
                <button className="stack-date" onClick={() => setPickingDate(value => !value)} aria-expanded={pickingDate}>
                  <span>{reachOn.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                  <small>{pickingDate ? 'Done' : 'Change'}</small>
                </button>
                {pickingDate && (
                  <div className="reach-wheel">
                    <DateWheel
                      value={reachOn}
                      years={wheelYears}
                      onChange={date => {
                        const days = Math.round((date.getTime() - today.getTime()) / DAY)
                        set('followUpDays', Math.max(1, days))
                      }}
                    />
                  </div>
                )}
                <div className="stack-remind">
                  <span>Remind me in</span>
                  <div className="stack-chips">
                    {[{ id: null, label: 'Just deq' }, ...CALENDARS].map(option => (
                      <button
                        key={option.id ?? 'none'}
                        className={fields.remindWith === option.id ? 'stack-chip on' : 'stack-chip'}
                        onClick={() => {
                          set('remindWith', option.id)
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                {fields.remindWith && <p className="stack-note quiet">Opens when you add {firstName || 'them'} to your deq.</p>}
              </>
            )}
          </>,
        )}

        {card('note', 'Stood out', 'What stood out?', fields.note, <NoteBuilder value={fields.note} onChange={note => set('note', note)} />)}

        {card(
          'next',
          'Next time',
          'Anything for next time?',
          fields.next,
          <textarea
            className={fields.next ? 'stack-field note filled' : 'stack-field note'}
            rows={3}
            placeholder="Send my portfolio, ask about the Seattle team…"
            value={fields.next}
            onChange={event => set('next', event.target.value)}
          />,
        )}
      </div>

      <div className="stack-bar">
        <AnimatePresence mode="wait" initial={false}>
          {waiting ? (
            <motion.div
              key="reading"
              className="flow-reading"
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
            >
              <ReadingRing done={reading === 'done'} />
              <span className={reading === 'done' ? 'flow-reading-label done' : 'flow-reading-label'}>
                {reading === 'done' ? 'Got it' : 'Reading the photo'}
              </span>
            </motion.div>
          ) : (
            <motion.div
              key="actions"
              className="stack-actions"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
            >
              <button className="stack-clear" onClick={clearAll}>Clear all</button>
              <button className={hasName ? 'stack-add' : 'stack-add off'} onClick={tryAdd}>
                Add to deq
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// The map waits until its card has finished opening, so the opening stays smooth.
function LaterMap({ lat, lng }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 380)
    return () => clearTimeout(timer)
  }, [])
  return ready ? (
    <Suspense fallback={null}>
      <MiniMap lat={lat} lng={lng} colour="#0071e3" />
    </Suspense>
  ) : null
}

// Apple-style activity ring: an arc that breathes as it turns, then closes into a
// full circle and draws a tick when the photo has been read.
function ReadingRing({ done }) {
  return (
    <svg className={done ? 'reading-ring done' : 'reading-ring'} viewBox="0 0 36 36" width="36" height="36" aria-hidden="true">
      <circle className="reading-ring-track" cx="18" cy="18" r="15" pathLength="1" />
      <motion.circle
        className="reading-ring-arc"
        cx="18"
        cy="18"
        r="15"
        pathLength="1"
        initial={false}
        animate={done ? { strokeDasharray: '1 1' } : undefined}
        transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
      />
      {done && (
        <motion.path
          className="reading-ring-tick"
          d="M11.5 18.5l4.5 4.5 8.5-9"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.15, type: 'spring', bounce: 0, duration: 0.35 }}
        />
      )}
    </svg>
  )
}

// Apple's system colours, red to green: how it went, at a glance.
const VIBE_COLOURS = ['#FF3B30', '#FF9500', '#F2B600', '#A3D94B', '#34C759']

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s-6.5-5.6-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.4-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </svg>
  )
}
