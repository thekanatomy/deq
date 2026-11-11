import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { BackIcon, CloseIcon } from './icons'

// Full-screen menu in the style of tesla.com: big, evenly spaced rows with a chevron,
// each opening its own page that slides in from the right.
const SPRING = { type: 'spring', bounce: 0, duration: 0.4 }

export default function MenuSheet({ owner, count, onOwner, onClose }) {
  const [page, setPage] = useState(null) // null | 'name' | 'about'
  const [name, setName] = useState(owner)

  function close() {
    onOwner(name.trim())
    onClose()
  }

  const rows = [
    { id: 'name', label: 'Your Name', detail: owner || 'Not set' },
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
          <button className="menu-icon" aria-label="Back" onClick={() => setPage(null)}>
            <BackIcon size={24} />
          </button>
        ) : (
          <span />
        )}
        <button className="menu-icon" aria-label="Close menu" onClick={close}>
          <CloseIcon size={24} />
        </button>
      </div>

      <AnimatePresence mode="popLayout" initial={false}>
        {page === null ? (
          <motion.nav
            key="list"
            className="menu-list"
            initial={{ x: '-30%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-30%', opacity: 0 }}
            transition={SPRING}
          >
            {rows.map((row, index) => (
              <motion.button
                key={row.id}
                className="menu-row"
                onClick={() => setPage(row.id)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { ...SPRING, delay: 0.03 * index } }}
              >
                <span>{row.label}</span>
                {row.detail && <span className="menu-detail">{row.detail}</span>}
                <Chevron />
              </motion.button>
            ))}
            <p className="menu-foot">
              {count} {count === 1 ? 'person' : 'people'} in your deq
            </p>
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
            {page === 'name' && (
              <>
                <h2 className="menu-title">Your Name</h2>
                <p className="menu-text">It titles your deck, like “Kanish’s deq”.</p>
                <input
                  className="menu-input"
                  placeholder="Kanish"
                  autoFocus
                  autoCapitalize="words"
                  enterKeyHint="done"
                  value={name}
                  onChange={event => setName(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      onOwner(name.trim())
                      setPage(null)
                    }
                  }}
                />
                <button
                  className="primary-button menu-save"
                  onClick={() => {
                    onOwner(name.trim())
                    setPage(null)
                  }}
                >
                  Save
                </button>
              </>
            )}
            {page === 'about' && (
              <>
                <h2 className="menu-title">About Deq</h2>
                <p className="menu-text">Deq keeps the people you meet as cards, and shows how long it has been since you last spoke.</p>
                <p className="menu-text">Made by Kanish Goudam at Arizona State University.</p>
              </>
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