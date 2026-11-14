import { motion } from 'motion/react'
import { meshImage } from './brands'
import { linkedinUrl, saveContact } from './contact'
import DeqCard from './DeqCard'

const EASE = [0.32, 0.72, 0, 1] // Apple's ease: quick to start, long soft landing

// Opened from someone's Deq card (their Wallet pass QR or link). Their card
// rises slowly out of a soft glow of its own colours, like a pass arriving in
// Wallet; "What's deq?" up top, "Add to your deq" at the bottom.
export default function SharedCard({ person, onAdd, onIntro, onClose }) {
  const now = Date.now()
  const first = person.name.split(' ')[0]

  // Their contact details right here: someone who only wants to connect on LinkedIn
  // or save the number can do it in one tap, without adding them to a deq first.
  const actions = [
    person.linkedin && { id: 'linkedin', label: 'LinkedIn', icon: <LinkedInIcon />, href: linkedinUrl(person.linkedin) },
    person.email && { id: 'mail', label: 'Email', icon: <MailIcon />, href: `mailto:${person.email.trim()}` },
    person.phone && { id: 'call', label: 'Call', icon: <PhoneIcon />, href: `tel:${person.phone.replace(/[^\d+]/g, '')}` },
    { id: 'contact', label: 'Save contact', icon: <PersonPlusIcon />, run: () => saveContact(person, 'Shared with deq (deq.one)') },
  ].filter(Boolean)

  return (
    <motion.div
      className="shared"
      role="dialog"
      aria-label={`${person.name}'s card`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35, ease: EASE } }}
      transition={{ duration: 0.6, ease: EASE }}
    >
      <motion.div
        className="shared-glow"
        style={{ backgroundImage: meshImage(person.company) }}
        initial={{ opacity: 0, scale: 1.25 }}
        animate={{ opacity: 0.55, scale: 1.1 }}
        transition={{ duration: 2.4, ease: EASE }}
      />

      <motion.header
        className="shared-top"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE, delay: 1.1 }}
      >
        <span className="shared-mark">deq</span>
        <button className="shared-intro" onClick={onIntro}>
          What’s deq?
        </button>
      </motion.header>

      <div className="shared-stage">
        <motion.p
          className="shared-kicker"
          initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 1, ease: EASE, delay: 0.25 }}
        >
          {first} shared their card with you
        </motion.p>

        {/* the slow rise: from low and soft to sharp and settled */}
        <motion.div
          className="shared-card"
          initial={{ opacity: 0, y: 140, scale: 0.92, filter: 'blur(14px)' }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 1.6, ease: EASE, delay: 0.45 }}
        >
          <DeqCard person={{ id: 'shared', ...person, place: '', metAt: now, lastContacted: now }} interactive={false} />
        </motion.div>

        <motion.nav
          className="shared-actions"
          aria-label={`Contact ${first}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE, delay: 1.2 }}
        >
          {actions.map(action =>
            action.href ? (
              <a key={action.id} className="shared-action" href={action.href} target="_blank" rel="noreferrer">
                <span>{action.icon}</span>
                {action.label}
              </a>
            ) : (
              <button key={action.id} className="shared-action" onClick={action.run}>
                <span>{action.icon}</span>
                {action.label}
              </button>
            ),
          )}
        </motion.nav>
      </div>

      <motion.footer
        className="shared-bottom"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: EASE, delay: 1.35 }}
      >
        <button className="primary-button dark" onClick={onAdd}>
          Add {first} to your deq
        </button>
        <button className="flow-skip" onClick={onClose}>
          Not now
        </button>
      </motion.footer>
    </motion.div>
  )
}

// ---------- icons, SF Symbols style ----------
const Svg = ({ children }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)
const LinkedInIcon = () => (
  <svg viewBox="0 0 24 24" width="21" height="21" fill="currentColor" aria-hidden="true">
    <path d="M6.94 8.5H3.56V20h3.38V8.5ZM5.25 3a1.97 1.97 0 1 0 0 3.94 1.97 1.97 0 0 0 0-3.94ZM20.44 13.4c0-3.1-1.66-4.54-3.87-4.54-1.78 0-2.58.98-3.02 1.67V8.5h-3.38c.04.95 0 11.5 0 11.5h3.38v-6.42c0-.34.02-.69.13-.93.27-.69.89-1.4 1.94-1.4 1.37 0 1.92 1.05 1.92 2.58V20h3.38v-6.6Z" />
  </svg>
)
const MailIcon = () => (
  <Svg>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
    <path d="m4.5 7 7.5 6 7.5-6" />
  </Svg>
)
const PhoneIcon = () => (
  <Svg>
    <path d="M6.6 3.5h2.6l1.4 4-2 1.3a11 11 0 0 0 6.6 6.6l1.3-2 4 1.4v2.6a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z" />
  </Svg>
)
const PersonPlusIcon = () => (
  <Svg>
    <circle cx="10" cy="8" r="3.5" />
    <path d="M3.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6" />
  </Svg>
)
