import { motion } from 'motion/react'

// Wallet-style sheet: grouped rows, a tick on the one you're looking at.
export default function CategoriesSheet({ filters, current, onPick, onClose }) {
  const main = filters.filter(filter => !filter.group)
  const companies = filters.filter(filter => filter.group === 'company')

  const row = filter => (
    <button key={filter.id} className="row row-button category-row" onClick={() => onPick(filter.id)}>
      <span>
        {filter.name}
        {filter.hint && <small>{filter.hint}</small>}
      </span>
      <span className="category-count">{filter.count}</span>
      <span className="category-tick" aria-hidden="true">{filter.id === current ? '✓' : ''}</span>
    </button>
  )

  return (
    <motion.div
      className="scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      onClick={onClose}
    >
      <motion.div
        className="sheet categories-sheet"
        role="dialog"
        aria-label="Categories"
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
        <h2 className="sheet-heading">Show</h2>
        <div className="grouped">{main.map(row)}</div>
        {companies.length > 0 && (
          <>
            <p className="group-label">Companies</p>
            <div className="grouped categories-companies">{companies.map(row)}</div>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}
