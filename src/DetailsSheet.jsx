import { motion } from 'motion/react'
import { useState } from 'react'

// Apple Wallet's pass details: grouped rows, with the destructive action alone in red.
export default function DetailsSheet({ person, onEdit, onShare, onRemove, onClose }) {
  const [confirming, setConfirming] = useState(false)

  return (
    <motion.div
      className="scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      onClick={onClose}
    >
      <motion.div
        className="sheet"
        role="dialog"
        aria-label={`${person.name} details`}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%', transition: { type: 'spring', bounce: 0, duration: 0.3 } }}
        transition={{ type: 'spring', bounce: 0, duration: 0.45 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.05, bottom: 0.6 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 80 || info.velocity.y > 500) onClose()
        }}
        onClick={event => event.stopPropagation()}
      >
        <span className="grabber" />
        <h2 className="sheet-heading">{person.name}</h2>

        <div className="grouped">
          <button className="row row-button" onClick={onEdit}>Edit Details</button>
          <button className="row row-button" onClick={onShare}>Share Card</button>
        </div>

        <div className="grouped">
          <button
            className="row row-button destructive"
            onClick={() => (confirming ? onRemove() : setConfirming(true))}
          >
            {confirming ? `Tap again to remove ${person.name.split(' ')[0]}` : 'Remove from deq'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}