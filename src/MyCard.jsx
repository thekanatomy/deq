import { motion } from 'motion/react'
import { useState } from 'react'
import { isAndroid } from './browser'
import DeqCard from './DeqCard'
import { CloseIcon } from './icons'
import { loadMe, saveMe } from './me'
import { cardCode, cardLink } from './share'

const FIELDS = [
  { key: 'name', label: 'Name', placeholder: 'Your name', autoCapitalize: 'words' },
  { key: 'role', label: 'Role', placeholder: 'Product Analyst' },
  { key: 'company', label: 'Company', placeholder: 'Arizona State University', autoCapitalize: 'words' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/in/you', autoCapitalize: 'none' },
  { key: 'email', label: 'Email', placeholder: 'you@asu.edu', type: 'email', autoCapitalize: 'none' },
  { key: 'phone', label: 'Phone', placeholder: 'Optional', type: 'tel', autoCapitalize: 'none' },
]

// Your own card: what people get when they scan you. It goes into Apple Wallet or
// Google Wallet (made by WalletWallet), and its QR code opens Deq with you ready to add.
export default function MyCard({ owner, onClose }) {
  const [me, setMe] = useState(() => loadMe(owner))
  const [copied, setCopied] = useState(false)
  const ready = me.name.trim().length > 0
  const now = Date.now()

  function update(key, value) {
    const next = { ...me, [key]: value }
    setMe(next)
    saveMe(next)
  }

  function addToWallet() {
    saveMe(me)
    // a plain navigation, so the phone opens the pass in its own wallet:
    // Apple's "Add to Apple Wallet" sheet, or Google Wallet's save page
    window.location.href = `/api/pass?card=${cardCode(me)}${isAndroid ? '&to=google' : ''}`
  }

  async function share() {
    const url = cardLink(me)
    try {
      if (navigator.share) return await navigator.share({ title: `${me.name} on deq`, url })
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // share sheet closed: nothing to do
    }
  }

  return (
    <motion.div
      className="menu mycard"
      role="dialog"
      aria-label="Your card"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.18 } }}
      transition={{ duration: 0.22 }}
    >
      <div className="menu-bar">
        <span />
        <button className="menu-icon" aria-label="Close" onClick={onClose}>
          <CloseIcon size={24} />
        </button>
      </div>

      <div className="insights-scroll">
        <h1 className="categories-title">Your Card</h1>

        <motion.div
          className="mycard-preview"
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', bounce: 0.15, duration: 0.6, delay: 0.1 }}
        >
          <DeqCard
            person={{ id: 'me', ...me, name: me.name || 'Your name', place: '', metAt: now, lastContacted: now }}
            interactive={false}
          />
        </motion.div>

        <div className="mycard-actions">
          <button className="wallet-button" disabled={!ready} onClick={addToWallet}>
            {isAndroid ? <GoogleWalletGlyph /> : <WalletGlyph />}
            {isAndroid ? 'Add to Google Wallet' : 'Add to Apple Wallet'}
          </button>
          <button className="glass-pill mycard-share" disabled={!ready} onClick={share}>
            {copied ? 'Link copied' : isAndroid ? 'Share my card' : 'Share link'}
          </button>
          <p className="mycard-note">
            Show it from your wallet at events. Scanning the code adds you to their deq, no app needed.
          </p>
        </div>

        <div className="mycard-fields">
          {FIELDS.map(field => (
            <label key={field.key} className="mycard-field">
              <span>{field.label}</span>
              <input
                value={me[field.key] ?? ''}
                placeholder={field.placeholder}
                type={field.type ?? 'text'}
                autoCapitalize={field.autoCapitalize ?? 'sentences'}
                autoCorrect="off"
                onChange={event => update(field.key, event.target.value)}
              />
            </label>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function WalletGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="3" fill="#fff" />
      <rect x="3" y="7.5" width="18" height="3" fill="#30a2ff" />
      <rect x="3" y="10.5" width="18" height="3" fill="#ff9f0a" />
      <path d="M3 13.5h6.5a2.5 2.5 0 0 0 5 0H21V16a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3Z" fill="#d1d1d6" />
    </svg>
  )
}

// Google Wallet's mark, simplified: four stacked colour bands
function GoogleWalletGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <rect x="3" y="4" width="18" height="7" rx="2.5" fill="#EA4335" />
      <rect x="3" y="7.5" width="18" height="7" rx="2.5" fill="#FBBC04" />
      <rect x="3" y="11" width="18" height="7" rx="2.5" fill="#34A853" />
      <path d="M3 15.5h7a2.5 2.5 0 0 0 4 0h7V18a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3Z" fill="#4285F4" />
    </svg>
  )
}
