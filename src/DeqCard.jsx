import { getSvgPath } from 'figma-squircle'
import { AnimatePresence, motion } from 'motion/react'
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { brandStyle, grainImage, meshImage } from './brands'
import { db } from './db'
import { shrinkPhoto } from './photo'
import { readPhoto } from './vision'
import { companyOf, roleOf } from './text'
import AvatarEditor from './AvatarEditor'
import ReachOut from './ReachOut'
import { nextStep, spokeNow, talkingPoints } from './history'

const DAY = 24 * 60 * 60 * 1000
const CHANNELS = ['In person', 'LinkedIn', 'Mail', 'Text']
const FADE = { type: 'spring', bounce: 0, duration: 0.35 }

// Apple's continuous corners: the curve eases into the straight edge instead of
// bending suddenly. 0.6 smoothing is what iOS uses. Drawn as a clip path, because
// Safari can't do this in CSS yet.
const CORNER = 0.085 // of the card's width
const SMOOTHING = 0.6

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// Accepts whatever people type or the AI reads: a full link, "linkedin.com/in/x",
// "www.linkedin.com/in/x/", "@x" or just "x", and always opens the real profile.
function linkedinUrl(value) {
  const text = value.trim()
  const path = text.match(/linkedin\.com\/((?:in|company)\/[^/?#\s]+)/i)
  if (path) return `https://www.linkedin.com/${path[1]}`
  return `https://www.linkedin.com/in/${text.replace(/^@/, '').replace(/^\/+|\/+$/g, '')}`
}

function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0].toUpperCase())
    .join('')
}

// Turns the stored photo into something an <img> can show, and frees it afterwards.
function usePhotoUrl(photo) {
  const url = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo])
  useEffect(() => () => url && URL.revokeObjectURL(url), [url])
  return url
}

// The squircle outline for the card's current size.
function useSquircle(ref) {
  const [path, setPath] = useState(null)
  useLayoutEffect(() => {
    const element = ref.current
    const draw = () => {
      const width = element.offsetWidth
      const height = element.offsetHeight
      if (!width || !height) return
      setPath(previous =>
        previous?.width === width && previous?.height === height
          ? previous
          : { width, height, d: getSvgPath({ width, height, cornerRadius: width * CORNER, cornerSmoothing: SMOOTHING }) },
      )
    }
    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return path
}

// open: the full card (layout A). Closed: the strip you see in the stack.
function DeqCard({ person, interactive = true, open = true }) {
  const [updating, setUpdating] = useState(false)
  // after tapping LinkedIn/Mail: did they reach out, or just look?
  const [asking, setAsking] = useState(null)
  const [editing, setEditing] = useState(false)
  const [contact, setContact] = useState({ linkedin: person.linkedin ?? '', email: person.email ?? '' })
  const cardRef = useRef(null)
  const contactPhoto = useRef(null)
  const [reading, setReading] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)
  const [reachOpen, setReachOpen] = useState(false)
  const photoUrl = usePhotoUrl(person.photo)
  const shape = useSquircle(cardRef)

  const days = Math.floor((Date.now() - person.lastContacted) / DAY)
  const metAt = person.metAt ?? person.lastContacted
  const next = nextStep(person, days)
  const points = talkingPoints(person.note)

  // Opens LinkedIn or Mail only after you've said why, so the answer is never skipped.
  // Called straight from the tap, so the phone allows the new tab.
  function openChannel(channel) {
    if (channel === 'LinkedIn') window.open(linkedinUrl(person.linkedin), '_blank', 'noopener')
    if (channel === 'Mail') window.location.href = `mailto:${person.email}`
  }

  async function logContact(channel) {
    await db.cards.update(person.id, spokeNow(person, channel))
    setUpdating(false)
    setAsking(null)
  }

  // A screenshot of their LinkedIn, a card, an email signature: the AI fills in
  // what it can read, and the fields stay editable.
  async function contactFromPhoto(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setReading(true)
    const found = await readPhoto(await shrinkPhoto(file, 1024))
    setReading(false)
    setContact(current => ({
      linkedin: found.linkedin || current.linkedin,
      email: found.email || current.email,
    }))
  }

  async function saveContact(event) {
    event.preventDefault()
    await db.cards.update(person.id, { linkedin: contact.linkedin.trim(), email: contact.email.trim() })
    setEditing(false)
  }

  // how this connection is doing, as a ring around their photo:
  // green on track, orange soon, red (rippling) late, grey gone cold
  const status = person.followUpDays
    ? next.late ? 'late' : next.soon ? 'soon' : 'ok'
    : days > 60 ? 'cold' : days <= 30 ? 'ok' : 'none'
  const avatar = (
    <span className={`avatar-ring ring-${status}`}>
      <span className="avatar">{photoUrl ? <img src={photoUrl} alt="" /> : initials(person.name)}</span>
    </span>
  )

  return (
    <div className="xcard-frame">
    {/* the shadow is its own layer, so moving the card never re-draws it */}
    <div className="xcard-shadow" aria-hidden="true" />
    <article
      ref={cardRef}
      className={!open && status === 'cold' ? 'xcard cold' : 'xcard'}
      style={{
        ...brandStyle(person.company),
        backgroundImage: `${grainImage()}, ${meshImage(person.company)}`,
        clipPath: shape ? `path('${shape.d}')` : undefined,
      }}
      inert={!interactive}
    >

      <AnimatePresence initial={false} mode="popLayout">
        {open ? (
          // ---------- layout A: the opened card ----------
          <motion.div
            key="open"
            className="xcard-body open"
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={FADE}
          >
            <header className="xcard-top">
              <span className="xcard-company big">{companyOf(person) || 'Deq'}</span>
              {interactive ? (
                <button
                  className="avatar-button"
                  aria-label={person.photo ? `See ${person.name.split(' ')[0]}’s photo` : 'Add their photo'}
                  onClick={event => {
                    event.stopPropagation()
                    setPhotoOpen(true)
                  }}
                >
                  {avatar}
                </button>
              ) : (
                avatar
              )}
            </header>

            <h2 className={person.name.length > 16 ? 'xcard-hero long' : 'xcard-hero'}>{person.name}</h2>
            {roleOf(person) && <p className="xcard-sub">{roleOf(person)}</p>}
            <p className="xcard-met">
              {person.place && interactive ? (
                // the place opens the map on them, with everyone else met there
                <button
                  className="xcard-place"
                  onClick={event => {
                    event.stopPropagation()
                    window.dispatchEvent(new CustomEvent('deq:show-on-map', { detail: person.id }))
                  }}
                >
                  {person.place}
                </button>
              ) : (
                person.place
              )}
              {person.place && ' · '}
              {formatDate(metAt)}
            </p>

            {editing ? (
              <form className="xcard-edit" onSubmit={saveContact}>
                <button type="button" className="glass-pill" disabled={reading} onClick={() => contactPhoto.current.click()}>
                  {reading ? 'Reading…' : 'Fill from a photo'}
                </button>
                <input ref={contactPhoto} type="file" accept="image/*" hidden onChange={contactFromPhoto} />
                <input
                  placeholder="LinkedIn username or URL"
                  value={contact.linkedin}
                  onChange={event => setContact({ ...contact, linkedin: event.target.value })}
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={contact.email}
                  onChange={event => setContact({ ...contact, email: event.target.value })}
                />
                <button className="glass-pill solid" type="submit">Save</button>
              </form>
            ) : asking ? (
              <div className="xcard-foot">
                <p className="xcard-ask">Reaching out, or just checking?</p>
                <div className="xcard-actions wrap">
                  <button
                    className="glass-pill solid"
                    onClick={() => {
                      openChannel(asking)
                      logContact(asking)
                    }}
                  >
                    Reaching out
                  </button>
                  <button
                    className="glass-pill"
                    onClick={() => {
                      openChannel(asking)
                      setAsking(null)
                    }}
                  >
                    Just checking
                  </button>
                </div>
              </div>
            ) : updating ? (
              <div className="xcard-foot">
                <p className="xcard-ask">How did you talk?</p>
                <div className="xcard-actions wrap">
                  {CHANNELS.map(channel => (
                    <button key={channel} className="glass-pill" onClick={() => logContact(channel)}>
                      {channel}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              // the glance: when to reach out, and what to talk about. Everything else is one more tap.
              <div className="xcard-foot calm">
                <button
                  className={`xcard-when ${next.late ? 'late' : next.soon ? 'soon' : ''}`}
                  onClick={event => {
                    event.stopPropagation()
                    setReachOpen(true)
                  }}
                  aria-label={`${next.label} ${next.detail}. Tap to change the date or add a note.`}
                >
                  <i aria-hidden="true" />
                  {next.label}
                  {next.detail && <span> · {next.detail}</span>}
                </button>
                {points.length > 0 && <p className="xcard-about">{points.slice(0, 3).join(' · ')}</p>}
              </div>
            )}
          </motion.div>
        ) : (
          // ---------- the strip you see in the stack ----------
          <motion.div
            key="strip"
            className="xcard-body"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={FADE}
          >
            <header className="xcard-top">
              <div className="xcard-who">
                {avatar}
                <span className="xcard-role">{roleOf(person) || 'Contact'}</span>
              </div>
              <span className="xcard-company">{companyOf(person)}</span>
            </header>
            <h2 className="xcard-name">{person.name}</h2>
            <p className={status === 'late' ? 'xcard-days late' : 'xcard-days'}>
              {next.label}
              {next.detail && <span className="xcard-days-detail"> · {next.detail}</span>}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{photoOpen && <AvatarEditor key="photo" person={person} onClose={() => setPhotoOpen(false)} />}</AnimatePresence>
      <AnimatePresence>{reachOpen && <ReachOut key="reach" person={person} onClose={() => setReachOpen(false)} />}</AnimatePresence>

      {shape && (
        <svg className="xcard-edge" viewBox={`0 0 ${shape.width} ${shape.height}`} aria-hidden="true">
          <path d={shape.d} />
        </svg>
      )}
    </article>
    </div>
  )
}

// Only cards whose person or state changed re-render when you open one, not the whole deck.
export default memo(DeqCard)
