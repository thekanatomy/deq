import { motion } from 'motion/react'
import { useState } from 'react'
import DeqCard from './DeqCard'
import { CloseIcon } from './icons'

// Apple Wallet's "Card Details" step: the card is the hero at the top and updates
// as you type, and everything the scan found is already filled in, so most of the
// time you just check it and tap the button.
const FIELDS = [
  { key: 'name', label: 'Name', placeholder: 'Required', autoCapitalize: 'words' },
  { key: 'role', label: 'Role', placeholder: 'Product analyst' },
  { key: 'company', label: 'Company', placeholder: 'Walmart', autoCapitalize: 'words' },
  { key: 'place', label: 'Met at', placeholder: 'Memorial Union' },
  { key: 'note', label: 'Talked about', placeholder: 'What you spoke about' },
]
const CONTACT = [
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'Username or link', autoCapitalize: 'none' },
  { key: 'email', label: 'Email', placeholder: 'name@company.com', type: 'email', autoCapitalize: 'none' },
]

export default function CardForm({ initial, title, subtitle, submitLabel, recentPlaces = [], onSave, onClose }) {
  const [fields, setFields] = useState({
    name: '',
    role: '',
    company: '',
    place: '',
    linkedin: '',
    email: '',
    note: '',
    ...initial,
  })
  const [saving, setSaving] = useState(false)
  const canSave = fields.name.trim().length > 0 && !saving
  const now = Date.now()
  const preview = {
    ...fields,
    id: 'preview',
    lastContacted: initial.lastContacted ?? now,
    metAt: initial.metAt ?? now,
  }

  function set(key, value) {
    setFields(previous => ({ ...previous, [key]: value }))
  }

  async function save(event) {
    event.preventDefault()
    if (!canSave) return
    setSaving(true)
    const clean = Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]),
    )
    await onSave(clean)
  }

  function row(field) {
    return (
      <label className="row" key={field.key}>
        <span className="row-label">{field.label}</span>
        <input
          className="row-input"
          type={field.type ?? 'text'}
          placeholder={field.placeholder}
          autoCapitalize={field.autoCapitalize ?? 'sentences'}
          autoCorrect="off"
          enterKeyHint="next"
          value={fields[field.key]}
          onChange={event => set(field.key, event.target.value)}
        />
      </label>
    )
  }

  return (
    <motion.div
      className="sheet-page"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%', transition: { type: 'spring', bounce: 0, duration: 0.3 } }}
      transition={{ type: 'spring', bounce: 0, duration: 0.45 }}
    >
      <form className="sheet-scroll" onSubmit={save}>
        <div className="sheet-bar">
          <button type="button" className="glass-button" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <div className="preview-card">
          <DeqCard person={preview} interactive={false} />
        </div>

        <h2 className="sheet-title">
          {title}
          <span className="sheet-subtitle">{subtitle}</span>
        </h2>

        <div className="grouped">{FIELDS.map(row)}</div>

        {recentPlaces.length > 0 && !fields.place && (
          <div className="suggestions">
            {recentPlaces.map(place => (
              <button type="button" key={place} className="suggestion" onClick={() => set('place', place)}>
                {place}
              </button>
            ))}
          </div>
        )}

        <p className="group-heading">Contact</p>
        <div className="grouped">{CONTACT.map(row)}</div>

        <div className="sheet-actions">
          <button type="submit" className="primary-button" disabled={!canSave}>
            {submitLabel}
          </button>
        </div>
      </form>
    </motion.div>
  )
}