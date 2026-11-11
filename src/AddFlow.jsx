import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { BackIcon, CloseIcon } from './icons'
import { detectPlace } from './location'
import { parseScan } from './scan'
import { readPhoto } from './vision'

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

const SOURCES = { card: 'their card', badge: 'their badge', screen: 'the screen', person: 'the photo', other: 'the photo' }

const STEPS = [
  { key: 'name', question: 'Who did you meet?', hint: 'Type a name, or paste their LinkedIn link.', required: true },
  { key: 'work', question: 'Where do they work?', hint: 'Their company, and role if you know it.' },
  { key: 'place', question: 'Where are you?', hint: 'So you remember where you met.' },
  { key: 'vibe', question: 'How did it go?' },
  { key: 'followUp', question: 'When should you reach out?', hint: 'Deq will remind you.' },
  // the memory hook: one thing that makes this person easy to picture again
  { key: 'note', question: 'What stood out?', hint: 'Something to remember them by.' },
]

export default function AddFlow({ initial, recentPlaces, onSave, onClose }) {
  const [fields, setFields] = useState({
    name: '',
    role: '',
    company: '',
    place: '',
    linkedin: '',
    email: '',
    note: '',
    vibe: 3,
    followUpDays: 7,
    ...initial,
  })
  const skipped = { name: Boolean(initial.name), work: Boolean(initial.company) }
  const [step, setStep] = useState(() => STEPS.findIndex(s => !skipped[s.key]))
  const [direction, setDirection] = useState(1)
  const [locating, setLocating] = useState(initial.place ? 'idle' : 'finding') // idle | finding | found | failed | elsewhere
  const needsReading = Boolean(initial.scanImage) && !(initial.name && initial.company)
  const [reading, setReading] = useState(needsReading ? 'reading' : 'idle') // idle | reading | read | failed
  const [readFrom, setReadFrom] = useState('')
  const inputRef = useRef(null)
  const foundRef = useRef(null) // the place the phone found, to switch back to
  const stepRef = useRef(step)
  const fieldsRef = useRef(fields)
  useEffect(() => {
    stepRef.current = step
    fieldsRef.current = fields
  })

  // Read the photo with the AI. Only empty answers are filled, so nothing you typed is overwritten.
  useEffect(() => {
    if (!needsReading) return
    const controller = new AbortController()
    readPhoto(initial.scanImage, { signal: controller.signal }).then(found => {
      if (controller.signal.aborted) return
      const { kind, ...details } = found
      if (!details.name && !details.company) return setReading('failed')
      const previous = fieldsRef.current
      const filled = { ...previous }
      for (const [key, value] of Object.entries(details)) if (!String(previous[key] ?? '').trim()) filled[key] = value
      // a photo of a card or a screen isn't their face, so it doesn't become the avatar
      if (kind && kind !== 'person') delete filled.photo
      setFields(filled)
      setReadFrom(SOURCES[kind] ?? SOURCES.other)
      setReading('read')
      navigator.vibrate?.(15)
      // still on the first question and it's answered now: move on by itself
      if (stepRef.current === 0 && filled.name) {
        setDirection(1)
        setStep(filled.company ? 2 : 1)
      }
    })
    return () => controller.abort()
    // the photo is fixed for the life of the flow
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])


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
      .catch(() => !cancelled && setLocating('failed'))
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

  const followIndex = Math.max(0, FOLLOW_UPS.findIndex(option => option.days === fields.followUpDays))

  return (
    <motion.div
      className="flow"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%', transition: { type: 'spring', bounce: 0, duration: 0.3 } }}
      transition={{ type: 'spring', bounce: 0, duration: 0.45 }}
    >

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

        <button className="flow-save" disabled={!hasName} onClick={save}>Save</button>
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
                  className="answer"
                  placeholder="Name"
                  autoCapitalize="words"
                  autoCorrect="off"
                  enterKeyHint="next"
                  value={fields.name}
                  onChange={event => onNameChange(event.target.value)}
                  onKeyDown={onKeyDown}
                />
                {reading === 'reading' && (
                  <p className="reading" aria-live="polite">
                    <span className="reading-dot" />
                    Reading the photo…
                  </p>
                )}
                {reading === 'failed' && <p className="answer-hint">Couldn’t read a name from the photo.</p>}
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
                  {locating === 'elsewhere' && !fields.place ? 'Where did you meet?' : null}
                  {fields.place && (locating === 'found' ? 'Found you here' : 'Here')}
                </div>
                <input
                  ref={inputRef}
                  className="answer"
                  placeholder={locating === 'elsewhere' ? 'Career Fair, Hayden Library…' : 'Memorial Union'}
                  enterKeyHint="next"
                  value={fields.place}
                  onChange={event => set('place', event.target.value)}
                  onKeyDown={onKeyDown}
                />
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
                        <button key={place} className="suggestion" onClick={() => set('place', place)}>
                          {place}
                        </button>
                      ))}
                  </div>
                )}
              </>
            )}

            {current.key === 'vibe' && (
              <div className="slider-block">
                <Face value={fields.vibe} />
                <p className="slider-value">{VIBES[fields.vibe - 1]}</p>
                <input
                  ref={inputRef}
                  className="slider"
                  style={{ '--fill': `${((fields.vibe - 1) / 4) * 100}%` }}
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
              <div className="slider-block">
                <p className="slider-value big">
                  {FOLLOW_UPS[followIndex].days ? `Remind me ${FOLLOW_UPS[followIndex].label}` : 'No reminder'}
                </p>
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
                  <span>Later</span>
                </div>
              </div>
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
        <button className="primary-button" disabled={!canContinue} onClick={next}>
          {isLast ? 'Add to deq' : 'Continue'}
        </button>
        {!current.required && !isLast && current.key !== 'vibe' && current.key !== 'followUp' ? (
          <button className="flow-skip" onClick={next}>Skip</button>
        ) : (
          <span className="flow-skip placeholder" aria-hidden="true">Skip</span>
        )}
      </div>
    </motion.div>
  )
}

// A face whose smile follows the slider: flat at "quick hello", wide at "stay in touch".
function Face({ value }) {
  const curve = 13 + (value - 3) * 3.2 // control point of the mouth
  return (
    <svg className="face" viewBox="0 0 64 64" aria-hidden="true">
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
    </svg>
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
