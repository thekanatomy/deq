import { getSvgPath } from 'figma-squircle'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { brandStyle } from './brands'
import { db } from './db'
import { PlusIcon } from './icons'
import { shrinkPhoto } from './photo'
import { companyOf, roleOf } from './text'

const DAY = 24 * 60 * 60 * 1000
const CHANNELS = ['In person', 'LinkedIn', 'Mail', 'Text']
const FADE = { type: 'spring', bounce: 0, duration: 0.4 }

// Apple's continuous corners: the curve eases into the straight edge instead of
// bending suddenly. 0.6 smoothing is what iOS uses. Drawn as a clip path, because
// Safari can't do this in CSS yet.
const CORNER = 0.085 // of the card's width
const SMOOTHING = 0.6

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function linkedinUrl(value) {
  return value.startsWith('http') ? value : `https://www.linkedin.com/in/${value}`
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
      setPath({ width, height, d: getSvgPath({ width, height, cornerRadius: width * CORNER, cornerSmoothing: SMOOTHING }) })
    }
    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return path
}

// open: the full card (layout A). Closed: the strip you see in the stack.
export default function DeqCard({ person, interactive = true, open = true }) {
  const [updating, setUpdating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [contact, setContact] = useState({ linkedin: person.linkedin ?? '', email: person.email ?? '' })
  const cardRef = useRef(null)
  const cameraInput = useRef(null)
  const photoUrl = usePhotoUrl(person.photo)
  const shape = useSquircle(cardRef)

  const days = Math.floor((Date.now() - person.lastContacted) / DAY)
  const metAt = person.metAt ?? person.lastContacted
  const daysLabel = days === 0 ? 'Today' : `${days} ${days === 1 ? 'day' : 'days'}`

  async function logContact(channel) {
    await db.cards.update(person.id, { lastContacted: Date.now(), lastChannel: channel })
    setUpdating(false)
  }

  // Tapping the avatar opens the camera; then the contact fields open to fill in.
  async function savePhoto(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    await db.cards.update(person.id, { photo: await shrinkPhoto(file) })
    setEditing(true)
  }

  async function saveContact(event) {
    event.preventDefault()
    await db.cards.update(person.id, { linkedin: contact.linkedin.trim(), email: contact.email.trim() })
    setEditing(false)
  }

  const avatar = (
    <span className="avatar">
      {photoUrl ? <img src={photoUrl} alt="" /> : initials(person.name)}
    </span>
  )

  return (
    <div className="xcard-frame">
    <article
      ref={cardRef}
      className="xcard"
      style={{ ...brandStyle(person.company), clipPath: shape ? `path('${shape.d}')` : undefined }}
      inert={!interactive}
    >
      <div className="xcard-mesh" aria-hidden="true" />
      <div className="xcard-grain" aria-hidden="true" />

      <AnimatePresence initial={false} mode="popLayout">
        {open ? (
          // ---------- layout A: the opened card ----------
          <motion.div
            key="open"
            className="xcard-body open"
            initial={{ opacity: 0, filter: 'blur(4px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, filter: 'blur(4px)' }}
            transition={FADE}
          >
            <header className="xcard-top">
              <span className="xcard-company big">{companyOf(person) || 'Deq'}</span>
              {interactive ? (
                <button className="avatar-button" aria-label="Take their photo" onClick={() => cameraInput.current.click()}>
                  {avatar}
                </button>
              ) : (
                avatar
              )}
              {/* capture="environment" opens the back camera straight away on phones */}
              <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={savePhoto} />
            </header>

            <h2 className={person.name.length > 16 ? 'xcard-hero long' : 'xcard-hero'}>{person.name}</h2>
            {roleOf(person) && <p className="xcard-sub">{roleOf(person)}</p>}
            <p className="xcard-met">
              {[person.place, formatDate(metAt)].filter(Boolean).join(' · ')}
            </p>

            {editing ? (
              <form className="xcard-edit" onSubmit={saveContact}>
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
              <div className="xcard-foot">
                <button className="xcard-days-big" onClick={() => setUpdating(true)} aria-label={`${daysLabel} since you spoke. Tap to update.`}>
                  {days === 0 ? 'Today' : `${days}d`}
                  <small>{days === 0 ? 'YOU SPOKE' : 'SINCE YOU SPOKE'}</small>
                </button>
                <div className="xcard-actions">
                  {person.linkedin && (
                    <a className="glass-pill" href={linkedinUrl(person.linkedin)} target="_blank" rel="noreferrer">
                      LinkedIn
                    </a>
                  )}
                  {person.email && (
                    <a className="glass-pill" href={`mailto:${person.email}`}>Mail</a>
                  )}
                  {!person.linkedin && !person.email && (
                    <button className="glass-pill" onClick={() => setEditing(true)}>
                      <PlusIcon size={14} /> Contact
                    </button>
                  )}
                </div>
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
            <p className="xcard-days">
              {daysLabel}
              {person.lastChannel && <span className="xcard-channel"> ({person.lastChannel})</span>}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {shape && (
        <svg className="xcard-edge" viewBox={`0 0 ${shape.width} ${shape.height}`} aria-hidden="true">
          <path d={shape.d} />
        </svg>
      )}
    </article>
    </div>
  )
}
