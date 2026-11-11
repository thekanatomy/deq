import { motion } from 'motion/react'
import { useState } from 'react'

// The menu behind the ☰ button: your name (which titles the deck) and a little about Deq.
export default function MenuSheet({ owner, count, onOwner, onClose }) {
  const [name, setName] = useState(owner)

  function done() {
    onOwner(name.trim())
    onClose()
  }

  return (
    <motion.div
      className="scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      onClick={done}
    >
      <motion.div
        className="sheet"
        role="dialog"
        aria-label="Menu"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%', transition: { type: 'spring', bounce: 0, duration: 0.3 } }}
        transition={{ type: 'spring', bounce: 0, duration: 0.45 }}
        onClick={event => event.stopPropagation()}
      >
        <span className="grabber" />
        <div className="sheet-header">
          <h2 className="sheet-heading">Menu</h2>
          <button className="sheet-done" onClick={done}>Done</button>
        </div>

        <p className="group-heading">Your deq</p>
        <div className="grouped">
          <label className="row">
            <span className="row-label">Your name</span>
            <input
              className="row-input"
              placeholder="Kanish"
              autoCapitalize="words"
              enterKeyHint="done"
              value={name}
              onChange={event => setName(event.target.value)}
              onKeyDown={event => event.key === 'Enter' && done()}
            />
          </label>
          <div className="row">
            <span className="row-label">People</span>
            <span className="row-value">{count}</span>
          </div>
        </div>

        <p className="group-footnote">
          Everything stays on this phone. Nothing is uploaded.
        </p>
      </motion.div>
    </motion.div>
  )
}