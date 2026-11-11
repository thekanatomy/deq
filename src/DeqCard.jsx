import { useEffect, useMemo, useRef, useState } from 'react'
import { brandStyle } from './brands'
import { db } from './db'
import { PlusIcon, ShareIcon } from './icons'
import { shrinkPhoto } from './photo'

const DAY = 24 * 60 * 60 * 1000
const CHANNELS = ['In person', 'LinkedIn', 'Mail', 'Text']

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function linkedinUrl(value) {
  return value.startsWith('http') ? value : `https://www.linkedin.com/in/${value}`
}

// Turns the stored photo into something an <img> can show, and frees it afterwards.
function usePhotoUrl(photo) {
  const url = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo])
  useEffect(() => () => url && URL.revokeObjectURL(url), [url])
  return url
}

export default function DeqCard({ person, interactive = true }) {
  const [updating, setUpdating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [contact, setContact] = useState({ linkedin: person.linkedin, email: person.email })
  const cameraInput = useRef(null)
  const photoUrl = usePhotoUrl(person.photo)

  const days = Math.floor((Date.now() - person.lastContacted) / DAY)
  const metAt = person.metAt ?? person.lastContacted

  async function logContact(channel) {
    await db.cards.update(person.id, { lastContacted: Date.now(), lastChannel: channel })
    setUpdating(false)
  }

  // + opens the camera. After the photo is taken, the contact fields open so they can be filled in.
  async function savePhoto(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    await db.cards.update(person.id, { photo: await shrinkPhoto(file) })
    setEditing(true)
  }

  async function saveContact(event) {
    event.preventDefault()
    await db.cards.update(person.id, {
      linkedin: contact.linkedin.trim(),
      email: contact.email.trim(),
    })
    setEditing(false)
  }

  async function share() {
    const text = [person.name, person.role, person.company].filter(Boolean).join(' · ')
    try {
      if (navigator.share) await navigator.share({ title: person.name, text })
      else await navigator.clipboard.writeText(text)
    } catch {
      // the person closed the share sheet; nothing to do
    }
  }

  return (
    <article className="xcard" style={brandStyle(person.company) ?? undefined} inert={!interactive}>
      <div className="xcard-body">
        <header className="xcard-top">
          <div className="xcard-who">
            <span className="avatar">
              {photoUrl && <img src={photoUrl} alt="" />}
            </span>
            <span className="xcard-role">{person.role || 'Contact'}</span>
          </div>
          <span className="xcard-company">{person.company}</span>
        </header>

        <h2 className="xcard-name">{person.name}</h2>
        <p className="xcard-days">
          {days === 0 ? 'Today' : `${days} ${days === 1 ? 'day' : 'days'}`}
          {person.lastChannel && <span className="xcard-channel"> ({person.lastChannel})</span>}
        </p>

        {updating ? (
          <div className="chips">
            {CHANNELS.map(channel => (
              <button key={channel} className="chip" onClick={() => logContact(channel)}>
                {channel}
              </button>
            ))}
          </div>
        ) : (
          <button className="chip" onClick={() => setUpdating(true)}>Update</button>
        )}

        <p className="xcard-met">
          {formatDate(metAt)}
          {person.place && ` - ${person.place}`}
        </p>

        <div className="xcard-spacer" />

        {editing ? (
          <form className="xcard-edit" onSubmit={saveContact}>
            <input
              placeholder="LinkedIn username or URL"
              value={contact.linkedin}
              onChange={e => setContact({ ...contact, linkedin: e.target.value })}
            />
            <input
              type="email"
              placeholder="Email"
              value={contact.email}
              onChange={e => setContact({ ...contact, email: e.target.value })}
            />
            <button className="chip" type="submit">Save</button>
          </form>
        ) : (
          <>
            <p className="xcard-label">Contact:</p>
            <div className="contact-row">
              {person.linkedin && (
                <a className="contact linkedin" href={linkedinUrl(person.linkedin)} target="_blank" rel="noreferrer">
                  LinkedIn
                </a>
              )}
              {person.email && (
                <a className="contact mail" href={`mailto:${person.email}`}>Mail</a>
              )}
              <button
                className="contact plus"
                aria-label="Take a photo and add contact details"
                onClick={() => cameraInput.current.click()}
              >
                <PlusIcon />
              </button>
              {/* capture="environment" opens the back camera straight away on phones */}
              <input
                ref={cameraInput}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={savePhoto}
              />
            </div>
          </>
        )}

        <button className="share" aria-label="Share this card" onClick={share}>
          <ShareIcon />
        </button>
      </div>
    </article>
  )
}