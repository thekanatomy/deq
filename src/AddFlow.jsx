import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { BackIcon, CloseIcon } from './icons'
import { detectPlace } from './location'
import { parseScan } from './scan'
import { readPhoto } from './vision'
import { cropFace } from './face'
import { searchPlaces } from './places'
import DateWheel from './Wheel.jsx'
import { openReminder } from './calendar'
import ScanReading from './ScanReading'

// Adding someone in a few taps, one question at a time. Names come from the QR or a
// pasted LinkedIn link, the place comes from your location, two sliders replace typing,
// and the only thing you write is what you talked about. A photo of a card, badge or
// LinkedIn screen is read by the AI while the flow opens, and fills the answers in.
// Apple-style: white screen, centred question, one blue button at the bottom.
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

function lastCalendar() {
  try {
    // only Google Calendar is offered here for now
    return localStorage.getItem('deq-remind-with') === 'google' ? 'google' : null
  } catch {
    return null
  }
}

function rememberCalendar(id) {
  try {
    if (id) localStorage.setItem('deq-remind-with', id)
    else localStorage.removeItem('deq-remind-with')
  } catch {
    // not remembered: harmless
  }
}

// the slider stop closest to a number of days
function nearestFollowUp(days) {
  if (!days) return FOLLOW_UPS.length - 1
  let best = 0
  FOLLOW_UPS.forEach((option, index) => {
    if (option.days && Math.abs(option.days - days) < Math.abs(FOLLOW_UPS[best].days - days)) best = index
  })
  return best
}

const SOURCES = { card: 'their card', badge: 'their badge', screen: 'the screen', person: 'the photo', other: 'the photo' }

const STEPS = [
  { key: 'name', question: 'Who did you meet?', hint: 'Type a name, or paste their LinkedIn link.', required: true },
  { key: 'work', question: 'Where do they work?', hint: 'Their company, and role if you know it.' },
  { key: 'place', question: 'Where are you?', hint: 'So you remember where you met.' },
  { key: 'vibe', question: 'How did it go?' },
  { key: 'followUp', question: 'When should you reach out?', hint: 'Deq will remind you.' },
  // the memory hook: one thing that makes this person easy to picture again
  { key: 'note', question: 'What stood out?', hint: 'Something to remember them by.' },
  // what to do when you reach out: shows on their card as "Next time"
  { key: 'next', question: 'Anything for next time?', hint: 'What to bring up when you reach out.' },
]

export default function AddFlow({ initial, recentPlaces, placeCoords, onSave, onClose }) {
  const [fields, setFields] = useState({
    name: '',
    role: '',
    company: '',
    place: '',
    linkedin: '',
    email: '',
    note: '',
    next: '',
    vibe: 3,
    followUpDays: 7,
    remindWith: lastCalendar(), // add it to this calendar once the card is saved
    ...initial,
  })
  const skipped = { name: Boolean(initial.name), work: Boolean(initial.company) }
  const [step, setStep] = useState(() => STEPS.findIndex(s => !skipped[s.key]))
  const [direction, setDirection] = useState(1)
  const [locating, setLocating] = useState(initial.place ? 'idle' : 'finding') // idle | finding | found | failed | blocked | elsewhere
  const needsReading = Boolean(initial.scanImage) && !(initial.name && initial.company)
  const [reading, setReading] = useState(needsReading ? 'reading' : 'idle') // idle | reading | done | read | failed | busy
  const [readFrom, setReadFrom] = useState('')
  const inputRef = useRef(null)
  const foundRef = useRef(null) // the place the phone found, to switch back to
  const stepRef = useRef(step)
  const fieldsRef = useRef(fields)
  useEffect(() => {
    stepRef.current = step
    fieldsRef.current = fields
  })

  // Find their face in the scan at the same time as the AI reads it: a face becomes
  // the avatar, cut out like a profile picture.
  const faceRef = useRef(null)
  useEffect(() => {
    if (!initial.scanImage) return
    let cancelled = false
    cropFace(initial.scanImage).then(face => {
      if (cancelled || !face) return
      faceRef.current = face
      setFields(previous => ({ ...previous, photo: face }))
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
      // a found face is the avatar; otherwise a card or a screen isn't their face
      if (faceRef.current) filled.photo = faceRef.current
      else if (kind && kind !== 'person') delete filled.photo
      setFields(filled)
      setReadFrom(SOURCES[kind] ?? SOURCES.other)
      setReading('done') // the found words fly into their card
      navigator.vibrate?.(15)
      advance = setTimeout(() => {
        setReading('read')
        // still on the first question and it's answered now: move on by itself
        if (stepRef.current === 0 && filled.name) {
          setDirection(1)
          setStep(filled.company ? 2 : 1)
        }
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
  useEffect(() => {
    if (!waiting) inputRef.current?.focus({ preventScroll: true })
  }, [waiting])

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1
  const hasName = fields.name.trim().length > 0
  const canContinue = !current.required || hasName

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

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
  }, [step])

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
    const { scanImage: _scanImage, ...kept } = fields
    const clean = Object.fromEntries(
      Object.entries(kept).map(([key, entry]) => [key, typeof entry === 'string' ? entry.trim() : entry]),
    )
    onSave(clean)
    // Google Calendar opens right here, inside the tap on Add, after the save has
    // started: phones only let a tap open another app, and a wait would lose it.
    if (clean.remindWith && clean.followUpDays) openReminder({ ...clean, lastContacted: Date.now() }, clean.remindWith)
  }

  function go(to) {
    setDirection(to > step ? 1 : -1)
    setStep(to)
  }

  function next() {
    if (!canContinue) return
    if (isLast) return save()
    go(step + 1)
  }

  function back() {
    if (step === 0) return onClose()
    go(step - 1)
  }

  function onKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      next()
    }
  }

  const followIndex = nearestFollowUp(fields.followUpDays)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const reachOn = new Date(today.getTime() + (fields.followUpDays ?? 7) * DAY)
  const wheelYears = [today.getFullYear(), today.getFullYear() + 1]

  return (
    <motion.div
      // picking a place: the list takes the room, everything else steps aside for the keyboard
      className={placeOptions.length > 0 && current.key === 'place' ? 'flow picking' : 'flow'}
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

      <div className="flow-top">
        <button className="flow-icon" aria-label={step === 0 ? 'Cancel' : 'Back'} onClick={back}>
          {step === 0 ? <CloseIcon size={18} /> : <BackIcon />}
        </button>

        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={STEPS.length} aria-valuenow={step + 1}>
          <motion.div
            className="progress-fill"
            animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
          />
        </div>

        <button className="flow-save" disabled={!hasName || waiting} onClick={save}>Save</button>
      </div>


      <div className="flow-stage">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div
            key={current.key}
            className="question"
            custom={direction}
            variants={{
              enter: dir => ({ y: dir * 32, opacity: 0, filter: 'blur(4px)' }),
              center: { y: 0, opacity: 1, filter: 'blur(0px)' },
              leave: dir => ({ y: dir * -32, opacity: 0, filter: 'blur(4px)', transition: { duration: 0.18 } }),
            }}
            initial="enter"
            animate="center"
            exit="leave"
            transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
          >
            {reading === 'read' && current.key !== 'name' && (step === 1 || step === 2) ? (
              <p className="flow-scanned">Read {fields.name} from {readFrom}</p>
            ) : (
              initial.name && current.key !== 'name' && step === STEPS.findIndex(s => !skipped[s.key]) && (
                <p className="flow-scanned">Scanned {initial.name}{initial.linkedin ? ' from LinkedIn' : ''}</p>
              )
            )}
            <h2 className="question-text">{current.question}</h2>
            {current.hint && <p className="question-hint">{current.hint}</p>}

            {current.key === 'name' && (
              <>
                <input
                  ref={inputRef}
                  className={waiting ? 'answer waiting' : 'answer'}
                  placeholder={waiting ? 'Reading the photo…' : 'Name'}
                  readOnly={waiting}
                  aria-busy={waiting}
                  autoCapitalize="words"
                  autoCorrect="off"
                  enterKeyHint="next"
                  value={fields.name}
                  onChange={event => onNameChange(event.target.value)}
                  onKeyDown={onKeyDown}
                />
                {reading === 'failed' && <p className="answer-hint">Couldn’t read a name from the photo.</p>}
                {reading === 'busy' && <p className="answer-hint">Photo reading is busy right now. Type the name for this one.</p>}
                {fields.linkedin && <p className="answer-hint">LinkedIn linked ✓</p>}
              </>
            )}

            {current.key === 'work' && (
              <div className="answer-group">
                <input
                  ref={inputRef}
                  className="answer"
                  placeholder="Company"
                  autoCapitalize="words"
                  enterKeyHint="next"
                  value={fields.company}
                  onChange={event => set('company', event.target.value)}
                  onKeyDown={onKeyDown}
                />
                <input
                  className="answer small"
                  placeholder="Role (optional)"
                  enterKeyHint="next"
                  value={fields.role}
                  onChange={event => set('role', event.target.value)}
                  onKeyDown={onKeyDown}
                />
              </div>
            )}

            {current.key === 'place' && (
              <>
                <div className="place-status" aria-live="polite">
                  <PinIcon />
                  {locating === 'finding' && !fields.place ? 'Finding where you are…' : null}
                  {locating === 'failed' && !fields.place ? 'Couldn’t find your location' : null}
                  {locating === 'blocked' && !fields.place ? 'Location is off for deq. Type the place, or allow it in your browser’s site settings.' : null}
                  {locating === 'elsewhere' && !fields.place ? 'Where did you meet?' : null}
                  {fields.place && (locating === 'found' ? 'Found you here' : 'Here')}
                </div>
                <input
                  ref={inputRef}
                  className="answer"
                  placeholder={locating === 'elsewhere' ? 'Career Fair, Hayden Library…' : 'Memorial Union'}
                  enterKeyHint="next"
                  value={fields.place}
                  onChange={event => {
                    const place = event.target.value
                    // a typed place has no coordinates until one is picked from the list
                    setFields(previous => ({ ...previous, place, lat: undefined, lng: undefined }))
                    setPlaceTyped(true)
                  }}
                  onKeyDown={onKeyDown}
                  autoComplete="off"
                  aria-autocomplete="list"
                  aria-controls="place-options"
                />
                <AnimatePresence>
                  {placeOptions.length > 0 && (
                    <motion.ul
                      id="place-options"
                      className="place-options"
                      role="listbox"
                      initial={{ opacity: 0, y: -6, filter: 'blur(4px)' }}
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }}
                      transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
                    >
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
                    </motion.ul>
                  )}
                </AnimatePresence>
                {/* the phone knows where you are now, not always where you met.
                    One button that stays put and flips, so tapping it never loses the keyboard. */}
                {(locating === 'found' || locating === 'elsewhere') && foundRef.current && (
                  <button
                    className="flow-skip place-elsewhere"
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => {
                      if (locating === 'elsewhere') {
                        setFields(previous => ({ ...previous, ...foundRef.current }))
                        setLocating('found')
                        return
                      }
                      flushSync(() => {
                        setFields(previous => ({ ...previous, place: '', lat: undefined, lng: undefined }))
                        setLocating('elsewhere')
                      })
                      inputRef.current?.focus()
                    }}
                  >
                    {locating === 'elsewhere' ? `Use ${foundRef.current.place.split(',')[0]}` : 'Met somewhere else?'}
                  </button>
                )}
                {recentPlaces.length > 0 && (
                  <div className="suggestions">
                    {recentPlaces
                      .filter(place => place !== fields.place)
                      .map(place => (
                        <button key={place} className="suggestion" onClick={() => pickPlace({ place, ...placeCoords?.[place] })}>
                          {place}
                        </button>
                      ))}
                  </div>
                )}
              </>
            )}

            {current.key === 'vibe' && (
              <div className="slider-block">
                <Face value={fields.vibe} colour={VIBE_COLOURS[fields.vibe - 1]} />
                <p className="slider-value">{VIBES[fields.vibe - 1]}</p>
                <input
                  ref={inputRef}
                  className="slider vibe"
                  style={{ '--fill': `${((fields.vibe - 1) / 4) * 100}%`, '--vibe': VIBE_COLOURS[fields.vibe - 1] }}
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={fields.vibe}
                  aria-valuetext={VIBES[fields.vibe - 1]}
                  onChange={event => set('vibe', Number(event.target.value))}
                  onKeyDown={onKeyDown}
                />
                <div className="slider-ends">
                  <span>Quick hello</span>
                  <span>Stay in touch</span>
                </div>
              </div>
            )}

            {current.key === 'followUp' && (
              <div className="slider-block reach-block">
                {/* the date, the wheels and the slider all move together */}
                <p className="slider-value big">
                  {fields.followUpDays
                    ? reachOn.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' })
                    : 'No reminder'}
                </p>
                <div className={fields.followUpDays ? 'reach-wheel' : 'reach-wheel off'}>
                  <DateWheel
                    value={reachOn}
                    years={wheelYears}
                    onChange={date => {
                      const days = Math.round((date.getTime() - today.getTime()) / DAY)
                      set('followUpDays', Math.max(1, days))
                    }}
                  />
                </div>
                <input
                  ref={inputRef}
                  className="slider"
                  style={{ '--fill': `${(followIndex / (FOLLOW_UPS.length - 1)) * 100}%` }}
                  type="range"
                  min="0"
                  max={FOLLOW_UPS.length - 1}
                  step="1"
                  value={followIndex}
                  aria-valuetext={FOLLOW_UPS[followIndex].label}
                  onChange={event => set('followUpDays', FOLLOW_UPS[Number(event.target.value)].days)}
                  onKeyDown={onKeyDown}
                />
                <div className="slider-ends">
                  <span>Soon</span>
                  <span>{FOLLOW_UPS[followIndex].days ? FOLLOW_UPS[followIndex].label : 'No reminder'}</span>
                  <span>Later</span>
                </div>
                {fields.followUpDays && (
                  <div className="remind-with">
                    <p>Remind me in</p>
                    <div className="remind-options">
                      {[{ id: null, short: 'Just deq' }, { id: 'google', short: 'Google Calendar' }].map(option => (
                        <button
                          key={option.id ?? 'none'}
                          className={fields.remindWith === option.id ? 'remind-option active' : 'remind-option'}
                          onClick={() => {
                            set('remindWith', option.id)
                            rememberCalendar(option.id)
                          }}
                        >
                          {option.short}
                        </button>
                      ))}
                    </div>
                    {fields.remindWith && <small>Opens when you add {fields.name.split(' ')[0] || 'them'} to your deq.</small>}
                  </div>
                )}
              </div>
            )}

            {current.key === 'next' && (
              <textarea
                ref={inputRef}
                className="answer note"
                rows={3}
                placeholder="Send my portfolio, ask about the Seattle team…"
                value={fields.next}
                onChange={event => set('next', event.target.value)}
                onKeyDown={onKeyDown}
              />
            )}

            {current.key === 'note' && (
              <textarea
                ref={inputRef}
                className="answer note"
                rows={3}
                placeholder="Red jacket, also from Chennai, loves F1…"
                value={fields.note}
                onChange={event => set('note', event.target.value)}
                onKeyDown={onKeyDown}
              />
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flow-actions">
        <AnimatePresence mode="wait" initial={false}>
          {waiting ? (
            <motion.div
              key="reading"
              className="flow-reading"
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, scale: 0.92, filter: 'blur(6px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.96, filter: 'blur(6px)' }}
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
              className="flow-buttons"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
            >
              <button className="primary-button" disabled={!canContinue} onClick={next}>
                {isLast ? 'Add to deq' : 'Continue'}
              </button>
              {!current.required && !isLast && current.key !== 'vibe' && current.key !== 'followUp' ? (
                <button className="flow-skip" onClick={next}>Skip</button>
              ) : (
                <span className="flow-skip placeholder" aria-hidden="true">Skip</span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
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

// A face whose smile follows the slider: flat at "quick hello", wide at "stay in touch".
// Apple's system colours, red to green: how it went, at a glance.
const VIBE_COLOURS = ['#FF3B30', '#FF9500', '#F2B600', '#A3D94B', '#34C759']

function Face({ value, colour }) {
  const curve = 13 + (value - 3) * 3.2 // control point of the mouth
  return (
    <motion.svg
      className="face"
      viewBox="0 0 64 64"
      aria-hidden="true"
      initial={false}
      animate={{ color: colour }}
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
    >
      <circle cx="32" cy="32" r="30" fill="currentColor" opacity="0.18" />
      <circle cx="23" cy="26" r="3.2" fill="currentColor" />
      <circle cx="41" cy="26" r="3.2" fill="currentColor" />
      <motion.path
        initial={false}
        animate={{ d: `M20 ${40 - (value - 3) * 0.8} Q32 ${27 + curve} 44 ${40 - (value - 3) * 0.8}` }}
        transition={{ type: 'spring', bounce: 0.3, duration: 0.35 }}
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
    </motion.svg>
  )
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s-6.5-5.6-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.4-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </svg>
  )
}
