import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { GROUPS } from './filters'
import { BackIcon, CloseIcon } from './icons'
import { cascade } from './MenuSheet.jsx'

const SPRING = { type: 'spring', bounce: 0, duration: 0.4 }

// Full screen, like the menu. The first page: Everyone, then Companies, Roles and
// Where You Met, each opening its own list that slides in from the right.
export default function CategoriesSheet({ filters, current, onPick, onClose }) {
  const [page, setPage] = useState(null) // null | 'company' | 'role' | 'place'
  const [cameBack, setCameBack] = useState(false)
  const everyone = filters.find(filter => filter.id === 'all')
  const picked = filters.find(filter => filter.id === current)
  const groups = GROUPS.map(group => ({ ...group, items: filters.filter(filter => filter.group === group.id) })).filter(
    group => group.items.length > 0,
  )
  const open = groups.find(group => group.id === page)

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
        <button className="menu-icon" aria-label="Close categories" onClick={onClose}>
          <CloseIcon size={24} />
        </button>
      </div>

      <AnimatePresence mode="popLayout">
        {open ? (
          <motion.nav
            key={open.id}
            className="menu-list categories-list"
            initial={{ x: '30%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '30%', opacity: 0 }}
            transition={SPRING}
          >
            <h1 className="categories-title">{open.name}</h1>
            {open.items.map((filter, index) => (
              <motion.button
                key={filter.id}
                className={filter.id === current ? 'menu-row category-row current' : 'menu-row category-row'}
                aria-current={filter.id === current ? 'true' : undefined}
                onClick={() => onPick(filter.id)}
                {...cascade(index)}
              >
                <span className="category-name">{filter.name}</span>
                <span className="menu-detail">{filter.count}</span>
              </motion.button>
            ))}
          </motion.nav>
        ) : (
          <motion.nav
            key="groups"
            className="menu-list categories-list"
            initial={cameBack ? { x: '-30%', opacity: 0 } : false}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-30%', opacity: 0 }}
            transition={SPRING}
          >
            <motion.h1 className="categories-title" {...cascade(0)}>Categories</motion.h1>
            <motion.button
              className={current === 'all' ? 'menu-row category-row current' : 'menu-row category-row'}
              onClick={() => onPick('all')}
              {...cascade(1)}
            >
              <span className="category-name">{everyone.name}</span>
              <span className="menu-detail">{everyone.count}</span>
            </motion.button>
            {groups.map((group, index) => {
              const inside = picked?.group === group.id
              return (
                <motion.button
                  key={group.id}
                  className={inside ? 'menu-row category-row current' : 'menu-row category-row'}
                  onClick={() => setPage(group.id)}
                  {...cascade(index + 2)}
                >
                  <span className="category-name">{group.name}</span>
                  {/* the one you're looking at, or how many there are */}
                  <span className="menu-detail">{inside ? picked.name : group.items.length}</span>
                  <Chevron />
                </motion.button>
              )
            })}
          </motion.nav>
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
