import { motion } from 'motion/react'
import { CloseIcon } from './icons'
import { cascade } from './MenuSheet.jsx'

// Full screen, like the menu: a title as big as the deq wordmark, then
// evenly spaced rows that drop in one after another (apple.com's menu).
export default function CategoriesSheet({ filters, current, onPick, onClose }) {
  const main = filters.filter(filter => !filter.group)
  const companies = filters.filter(filter => filter.group === 'company')
  let index = 0

  const row = filter => (
    <motion.button
      key={filter.id}
      className={filter.id === current ? 'menu-row category-row current' : 'menu-row category-row'}
      aria-current={filter.id === current ? 'true' : undefined}
      onClick={() => onPick(filter.id)}
      {...cascade(index++)}
    >
      <span className="category-name">
        {filter.name}
        {filter.hint && <small>{filter.hint}</small>}
      </span>
      <span className="menu-detail">{filter.count}</span>
    </motion.button>
  )

  return (
    <motion.div
      className="menu"
      role="dialog"
      aria-label="Categories"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.18 } }}
      transition={{ duration: 0.22 }}
    >
      <div className="menu-bar">
        <span />
        <button className="menu-icon" aria-label="Close categories" onClick={onClose}>
          <CloseIcon size={24} />
        </button>
      </div>

      <nav className="menu-list categories-list">
        <motion.h1 className="categories-title" {...cascade(index++)}>Categories</motion.h1>
        {main.map(row)}
        {companies.length > 0 && (
          <>
            <motion.p className="categories-group" {...cascade(index++)}>Companies</motion.p>
            {companies.map(row)}
          </>
        )}
      </nav>
    </motion.div>
  )
}
