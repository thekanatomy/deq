import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from 'motion/react'
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import AddedMoment from './AddedMoment'
import AddFlow from './AddFlow'
import CardForm from './CardForm'
import DeqCard from './DeqCard'
import DetailsSheet from './DetailsSheet'
import { CloseIcon, MenuIcon, MoreIcon, PlusIcon } from './icons'
import MenuSheet from './MenuSheet'
import ZoomView from './ZoomView'
import { brandStyle } from './brands'
import { db } from './db'

// The scanner pulls in the QR decoder, so it only loads when + is tapped.
const Scanner = lazy(() => import('./Scanner'))

// Measured from Kanish's stacked-card design: each tucked card shows the top
// 38.8% of its width (avatar row, name and days). Cards are 5:7 like a playing card.
const STRIP = 0.388
const RATIO = 7 / 5
const PEEK = 8 // px each card shows in the bottom pile while one is open
const SPRING = { type: 'spring', bounce: 0, duration: 0.45 }

// Width of the deck and its distance from the top of the page.
function useDeckBox(ref) {
  const [box, setBox] = useState({ width: 0, top: 0 })
  useLayoutEffect(() => {
    const measure = () => {
      const rect = ref.current.getBoundingClientRect()
      setBox({ width: rect.width, top: rect.top + window.scrollY })
    }
    const observer = new ResizeObserver(measure)
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [ref])
  return box
}

export default function App() {
  // Newest contact first; the person you've gone longest without is the fully visible card.
  const people = useLiveQuery(() => db.cards.orderBy('lastContacted').reverse().toArray())
  // deck · scan (camera) · verify (check what the scan found) · form (type it in) · edit
  const [view, setView] = useState('deck')
  const [draft, setDraft] = useState({})
  const [openId, setOpenId] = useState(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [addedId, setAddedId] = useState(null)
  const [zoomed, setZoomed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [owner, setOwner] = useState(readOwner)

  const deckRef = useRef(null)
  const { width, top: deckTop } = useDeckBox(deckRef)
  // Cards already there when the app opens appear in place; cards added later slide in.
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (people && !loaded) requestAnimationFrame(() => setLoaded(true))
  }, [people, loaded])

  const [viewport, setViewport] = useState(() => window.innerHeight)
  useEffect(() => {
    const onResize = () => setViewport(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const cardHeight = width * RATIO
  const strip = width * STRIP
  const list = people ?? []
  const openIndex = list.findIndex(person => person.id === openId)
  const isOpen = openIndex >= 0

  // Where each card sits. Closed: a Wallet stack. Open: the chosen card at the top,
  // everyone else tucked into a thin pile at the bottom of the screen.
  const pileTop = Math.max(cardHeight + 24, viewport - deckTop - 40 - PEEK * Math.min(list.length - 1, 4))
  function positionOf(index) {
    if (!isOpen) return index * strip
    if (index === openIndex) return 0
    const pileIndex = index < openIndex ? index : index - 1
    return pileTop + Math.min(pileIndex, 4) * PEEK
  }
  const deckHeight = list.length === 0
    ? 0
    : isOpen
      ? pileTop + PEEK * Math.min(list.length - 1, 4) + strip * 0.5
      : (list.length - 1) * strip + cardHeight

  const recentPlaces = [...new Set(list.map(person => person.place).filter(Boolean))].slice(0, 4)
  const open = isOpen ? list[openIndex] : null
  const added = list.find(person => person.id === addedId)
  const openLook = open ? brandStyle(open.company) ?? { '--card-background': 'var(--deq-gradient)' } : null

  function openCard(id) {
    setOpenId(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function closeCard() {
    setZoomed(false)
    setDetailsOpen(false)
    setOpenId(null)
  }

  async function removeOpen() {
    await db.cards.delete(openId)
    closeCard()
  }

  // Everything goes through the tap-first add flow; whatever the scan found is already filled in.
  function onScanned(result) {
    setDraft(result)
    setView('form')
  }

  async function addPerson(fields) {
    const now = Date.now()
    const id = await db.cards.add({
      name: '',
      role: '',
      company: '',
      linkedin: '',
      email: '',
      place: '',
      ...fields,
      metAt: now,
      lastContacted: now,
    })
    setDraft({})
    setOpenId(null)
    setAddedId(id)
    setView('deck')
  }

  async function saveEdit(fields) {
    const { name, role, company, place, linkedin, email, note } = fields
    await db.cards.update(openId, { name, role, company, place, linkedin, email, note })
    setDraft({})
    setView('deck')
  }

  function finishAdded() {
    const id = addedId
    setAddedId(null)
    if (id) openCard(id)
  }

  async function shareOpen() {
    const text = [open.name, open.role, open.company].filter(Boolean).join(' · ')
    try {
      if (navigator.share) await navigator.share({ title: open.name, text })
      else await navigator.clipboard.writeText(text)
    } catch {
      // the share sheet was closed
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup>
      <AnimatePresence>
        {openLook && (
          <motion.div
            key={`tint-${openId}`}
            className="page-tint"
            style={openLook}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
          />
        )}
      </AnimatePresence>
      <div className="page">
        <header className="top">
          <div className="top-bar">
            <AnimatePresence mode="popLayout" initial={false}>
              {isOpen ? (
                <motion.button
                  key="close"
                  className="glass-button"
                  aria-label="Close card"
                  onClick={closeCard}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  <CloseIcon />
                </motion.button>
              ) : (
                <motion.span key="logo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Logo />
                </motion.span>
              )}
            </AnimatePresence>
            <AnimatePresence mode="popLayout" initial={false}>
              {isOpen ? (
                <span key="spacer" aria-hidden="true" />
              ) : (
                <motion.button
                  key="add"
                  className="glass-button"
                  aria-label="Add a person"
                  onClick={() => setView('scan')}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  <PlusIcon />
                </motion.button>
              )}
            </AnimatePresence>
            <AnimatePresence mode="popLayout" initial={false}>
              {isOpen ? (
                <motion.button
                  key="more"
                  className="glass-button"
                  aria-label="More options"
                  onClick={() => setDetailsOpen(true)}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  <MoreIcon />
                </motion.button>
              ) : (
                <motion.button
                  key="menu"
                  className="glass-button"
                  aria-label="Menu"
                  onClick={() => setMenuOpen(true)}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  <MenuIcon />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
          <h1>{owner ? `${owner}’s deq` : 'My deq'}</h1>
          {list.length > 0 && <Summary people={list} />}
        </header>

        <section className="deck" ref={deckRef} style={{ height: deckHeight }}>
          {width > 0 && list.map((person, index) => {
            const y = positionOf(index)
            const selected = index === openIndex
            return (
              <motion.div
                key={person.id}
                className="slot"
                style={{ width, zIndex: selected ? 100 : index }}
                initial={loaded ? { y: y + 160, opacity: 0 } : false}
                animate={{ y, opacity: 1 }}
                transition={SPRING}
                drag={selected ? 'y' : false}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={0.4}
                onDragEnd={(_, info) => {
                  if (info.offset.y > 90 || info.velocity.y > 600) closeCard()
                }}
                whileTap={selected ? undefined : { scale: 0.985 }}
                onClick={event => {
                  if (selected) {
                    // tapping the card itself (not one of its buttons) lifts it into the zoom view
                    if (!event.target.closest('button, a, input, form')) setZoomed(true)
                    return
                  }
                  if (isOpen) closeCard()
                  else openCard(person.id)
                }}
                role={selected ? undefined : 'button'}
                tabIndex={selected ? -1 : 0}
                aria-label={selected ? undefined : `Open ${person.name}`}
                onKeyDown={event => {
                  if (!selected && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault()
                    openCard(person.id)
                  }
                }}
              >
                {selected && zoomed ? (
                  <div className="card-placeholder" />
                ) : (
                  <motion.div layoutId={`card-${person.id}`} transition={SPRING}>
                    <DeqCard person={person} interactive={selected} />
                  </motion.div>
                )}
              </motion.div>
            )
          })}
        </section>

        {people?.length === 0 && (
          <div className="empty">
            <div className="empty-card" />
            <p>Scan someone's LinkedIn QR or business card to start your deq.</p>
            <button className="pill-button dark" onClick={() => setView('scan')}>Add Someone</button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {view === 'scan' && (
          <Suspense key="scanner" fallback={<div className="scanner" />}>
            <Scanner onResult={onScanned} onType={() => onScanned({})} onClose={() => setView('deck')} />
          </Suspense>
        )}
        {view === 'edit' && open && (
          <CardForm
            key="edit"
            initial={open}
            title="Edit Details"
            subtitle={`Update what you know about ${open.name.split(' ')[0]}.`}
            submitLabel="Save"
            recentPlaces={recentPlaces}
            onSave={saveEdit}
            onClose={() => setView('deck')}
          />
        )}
        {view === 'form' && (
          <AddFlow
            key="form"
            initial={draft}
            recentPlaces={recentPlaces}
            onSave={addPerson}
            onClose={() => {
              setDraft({})
              setView('deck')
            }}
          />
        )}
        {detailsOpen && open && (
          <DetailsSheet
            key="details"
            person={open}
            onEdit={() => {
              setDetailsOpen(false)
              setView('edit')
            }}
            onShare={() => {
              setDetailsOpen(false)
              shareOpen()
            }}
            onRemove={removeOpen}
            onClose={() => setDetailsOpen(false)}
          />
        )}
        {added && <AddedMoment key="added" person={added} onDone={finishAdded} />}
        {menuOpen && (
          <MenuSheet
            key="menu"
            owner={owner}
            count={list.length}
            onOwner={name => {
              setOwner(name)
              saveOwner(name)
            }}
            onClose={() => setMenuOpen(false)}
          />
        )}
        {zoomed && open && <ZoomView key="zoom" person={open} onClose={() => setZoomed(false)} />}
      </AnimatePresence>
      </LayoutGroup>
    </MotionConfig>
  )
}

const MONTH = 30 * 24 * 60 * 60 * 1000

// Apple Music Replay's big sentence, for people: what happened this month, in two tones.
function Summary({ people }) {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const metThisMonth = people.filter(person => (person.metAt ?? person.lastContacted) >= monthStart).length
  const waiting = people.filter(person => Date.now() - person.lastContacted > MONTH).length
  const monthName = now.toLocaleDateString('en-GB', { month: 'long' })
  const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

  return (
    <p className="summary">
      {metThisMonth > 0 ? (
        <>You met <b>{plural(metThisMonth, 'person').replace('persons', 'people')}</b> in {monthName}. </>
      ) : (
        <>No one new in {monthName} yet. </>
      )}
      {waiting > 0 ? (
        <><b>{waiting}</b> {waiting === 1 ? "hasn't" : "haven't"} heard from you in a month.</>
      ) : (
        <>You're up to date with everyone.</>
      )}
    </p>
  )
}

// Until there's an account, the title uses the name you set in the menu (or "My deq").
function readOwner() {
  try {
    return localStorage.getItem('deq-owner') ?? ''
  } catch {
    return ''
  }
}

function saveOwner(name) {
  try {
    if (name) localStorage.setItem('deq-owner', name)
    else localStorage.removeItem('deq-owner')
  } catch {
    // private browsing: the name just isn't remembered
  }
}

// Placeholder mark: swap in the real Deq logo SVG here.
function Logo() {
  return (
    <svg className="logo" viewBox="0 0 40 40" aria-label="Deq">
      <path
        d="M7 11h11a12 12 0 0 1 0 24H7V11Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinejoin="round"
      />
      <circle cx="22" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="4.5" />
      <path d="M29 11h8" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  )
}