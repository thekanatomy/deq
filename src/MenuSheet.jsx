import { AnimatePresence, motion } from 'motion/react'
import Privacy from './Privacy'
import { useState } from 'react'
import { BackIcon, CloseIcon } from './icons'
import SignIn from './SignIn'
import { accountsEnabled, setBackup, signOut, syncNow, useAccount } from './sync'

// Full-screen menu in the style of tesla.com: big, evenly spaced rows with a chevron,
// each opening its own page that slides in from the right.
const SPRING = { type: 'spring', bounce: 0, duration: 0.4 }

// apple.com's menu: rows arrive one after another, each dropping a few pixels into
// place while it comes into focus. Strong ease-out, about 60 ms apart.
const APPLE_EASE = [0.32, 0.72, 0, 1]
export function cascade(index) {
  return {
    initial: { opacity: 0, y: -10, filter: 'blur(8px)' },
    animate: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: {
        duration: 0.55,
        ease: APPLE_EASE,
        delay: 0.1 + index * 0.07,
        // the fade eases in more gently than the drop, so each row visibly arrives
        opacity: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1], delay: 0.1 + index * 0.07 },
      },
    },
  }
}

export default function MenuSheet({ count, onMyCard, onClose }) {
  const [page, setPage] = useState(null) // null | 'privacy' | 'account' | 'about'
  const account = useAccount()
  const [leaving, setLeaving] = useState(false)
  const [cameBack, setCameBack] = useState(false) // back from a page: the list slides in

  function close() {
    onClose()
  }

  const rows = [
    { id: 'privacy', label: 'Privacy', detail: 'On this phone first' },
    account.user
      ? { id: 'account', label: 'Account', detail: account.user.email }
      : { id: 'account', label: 'Sign In', detail: 'Back up your deq', alert: accountsEnabled },
    { id: 'card', label: 'Your Card', detail: 'Apple Wallet' },
    { id: 'about', label: 'About Deq' },
  ]

  return (
    <motion.div
      className="menu"
      role="dialog"
      aria-label="Menu"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.18 } }}
      transition={{ duration: 0.22 }}
    >
      <div className="menu-bar">
        {page ? (
          <button
            className="menu-icon"
            aria-label="Back"
            onClick={() => {
              setCameBack(true)
              setPage(null)
            }}
          >
            <BackIcon size={24} />
          </button>
        ) : (
          <span />
        )}
        <button className="menu-icon" aria-label="Close menu" onClick={close}>
          <CloseIcon size={24} />
        </button>
      </div>

      {/* initial stays on so the rows can cascade in; the list itself only slides
          when coming back from a page */}
      <AnimatePresence mode="popLayout">
        {page === null ? (
          <motion.nav
            key="list"
            className="menu-list"
            initial={cameBack ? { x: '-30%', opacity: 0 } : false}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-30%', opacity: 0 }}
            transition={SPRING}
          >
            {rows.map((row, index) => (
              <motion.button
                key={row.id}
                className="menu-row"
                onClick={() => (row.id === 'card' ? onMyCard() : setPage(row.id))}
                {...cascade(index)}
              >
                <span className={row.alert ? 'menu-alert' : undefined}>{row.label}</span>
                {row.detail && <span className={row.alert ? 'menu-detail menu-alert' : 'menu-detail'}>{row.detail}</span>}
                <Chevron />
              </motion.button>
            ))}
            <motion.p className="menu-foot" {...cascade(rows.length)}>
              {count} {count === 1 ? 'person' : 'people'} in your deq
            </motion.p>
          </motion.nav>
        ) : (
          <motion.section
            key={page}
            className="menu-page"
            initial={{ x: '30%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '30%', opacity: 0 }}
            transition={SPRING}
          >
            {page === 'account' && (
              account.user ? (
                <>
                  <h2 className="menu-title">Account</h2>
                  <p className="menu-text">
                    Signed in as <b>{account.user.email}</b>. Your deq always lives on this phone first and works
                    offline. With backup on, a copy goes to your account so it comes back on a new phone.
                  </p>
                  <label className="menu-toggle">
                    <span>
                      Back up to my account
                      <small>{account.backup ? 'On' : 'Off: only on this phone'}</small>
                    </span>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={account.backup}
                      onChange={event => setBackup(event.target.checked)}
                    />
                    <i aria-hidden="true" />
                  </label>
                  <p className="menu-status" aria-live="polite">{syncLabel(account)}</p>
                  {account.backup && (
                    <button className="primary-button menu-save" onClick={() => syncNow()}>Sync Now</button>
                  )}
                  <button
                    className="flow-skip menu-signout"
                    disabled={leaving}
                    onClick={async () => {
                      setLeaving(true)
                      await signOut()
                      setLeaving(false)
                    }}
                  >
                    {leaving ? 'Signing out…' : 'Sign Out'}
                  </button>
                </>
              ) : accountsEnabled ? (
                <>
                  <h2 className="menu-title">Sign In</h2>
                  <p className="menu-text">Back up your deq, so it’s safe if you lose this phone and there on every device you use.</p>
                  <SignIn />
                </>
              ) : (
                <>
                  <h2 className="menu-title">Sign In</h2>
                  <p className="menu-text">Accounts are almost ready. Until then, everyone you add is saved on this phone.</p>
                </>
              )
            )}
            {page === 'privacy' && <Privacy />}
            {page === 'about' && (
              // Apple's About screens: the icon, the name, one line, then a short grouped list
              <div className="about">
                <img className="about-icon" src="/icon-192.png" alt="" width="88" height="88" />
                <h2 className="about-name">deq</h2>
                <p className="about-version">Version 1.0</p>
                <p className="about-text">Deq keeps the people you meet as cards, and shows how long it has been since you last spoke.</p>
                <ul className="about-group">
                  <li>
                    <span>Made by</span>
                    <span>Kanish Goudam</span>
                  </li>
                  <li>
                    <span>From</span>
                    <span>Arizona State University</span>
                  </li>
                  <li>
                    <span>Website</span>
                    <span>deq.one</span>
                  </li>
                </ul>
                <p className="about-foot">Just a helping hand, helping people live their lives.</p>
              </div>
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function Chevron() {
  return (
    <svg className="menu-chevron" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.5 5.5 16 12l-6.5 6.5" />
    </svg>
  )
}

function syncLabel({ status, lastSynced, backup }) {
  if (!backup) return 'Backup is off. New people stay on this phone and go up when you turn it back on.'
  if (status === 'syncing') return 'Syncing…'
  if (status === 'offline') return 'Offline. It will sync when you’re back online.'
  if (status === 'error') return 'Couldn’t sync. Try again in a moment.'
  if (lastSynced) return `Backed up at ${new Date(lastSynced).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  return 'Backed up'
}

