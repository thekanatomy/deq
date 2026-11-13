import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from 'motion/react'
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import AddedMoment from './AddedMoment'
import AddFlow from './AddFlow'
import CardForm from './CardForm.jsx'
import DeqCard from './DeqCard'
import DetailsSheet from './DetailsSheet'
import { CategoriesIcon, CloseIcon, MoreIcon, PlusIcon, SearchIcon } from './icons.jsx'
import MenuSheet from './MenuSheet.jsx'
import CategoriesSheet from './CategoriesSheet'
import Insights from './Insights'
import Waiting from './Waiting'
import Search from './Search'
import MyCard from './MyCard'
import SharedCard from './SharedCard'
import { readCard } from './share'
import { isWaiting } from './filters'
import { filtersFor } from './filters'
import SaveSheet from './SaveSheet'
import Intro from './Intro'
import InAppGate from './InAppGate'
import HomeScreenSheet from './HomeScreenSheet'
import { inAppBrowser, isAndroid, isIOS, isStandalone, recall, remember } from './browser'
import { cameToCarry, copyDeck, markForCarry, pasteDeck } from './move'
import ZoomView from './ZoomView.jsx'
import { meshImage } from './brands'
import { db, visible } from './db'
import { withShortText } from './text'
import { accountsEnabled, removeCard, useAccount } from './sync'

// The scanner pulls in the QR decoder, so it only loads when + is tapped.
const Scanner = lazy(() => import('./Scanner'))

// Measured from Kanish's stacked-card design: each tucked card shows the top
// 38.8% of its width (avatar row, name and days). Cards are 5:7 like a playing card.
const STRIP = 0.388
const RATIO = 7 / 5
const PEEK = 8 // px each card shows in the bottom pile while one is open
// Apple's motion: springs that start from wherever things are and settle without a
// wobble. A touch of bounce only where a card is thrown into place.
const SPRING = { type: 'spring', bounce: 0.12, duration: 0.55 }
const SETTLE = { type: 'spring', bounce: 0, duration: 0.5 }
// buttons that swap in the top bar
const POP = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 },
  transition: { type: 'spring', bounce: 0, duration: 0.3 },
}

// Width of the deck and its distance from the top of the page.
function useDeckBox(ref) {
  const [box, setBox] = useState({ width: 0, top: 0 })
  useLayoutEffect(() => {
    const measure = () => {
      // offsetTop ignores transforms, so the deck sliding up doesn't change its measured spot
      let top = 0
      for (let node = ref.current; node; node = node.offsetParent) top += node.offsetTop
      const width = ref.current.offsetWidth
      // only re-render when something we use actually changed (the deck's height changes
      // when a card opens, but its width and position don't)
      setBox(previous => (previous.width === width && previous.top === top ? previous : { width, top }))
    }
    const observer = new ResizeObserver(measure)
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [ref])
  return box
}

// Height of an element, kept up to date (the title block, which the deck slides over).
function useHeight(ref) {
  const [height, setHeight] = useState(0)
  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => {
      const next = ref.current?.offsetHeight ?? 0
      setHeight(previous => (previous === next ? previous : next))
    })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [ref])
  return height
}

export default function App() {
  // Newest contact first; the person you've gone longest without is the fully visible card.
  // iOS Safari can drop the connection to the phone's database after the tab sleeps
  // ("Connection to Indexed Database server lost"). Reopen it and try again instead of crashing.
  const people = useLiveQuery(async () => {
    const read = () => db.cards.orderBy('lastContacted').reverse().filter(visible).toArray()
    try {
      return await read()
    } catch (error) {
      console.warn('deq: reopening the database after', error)
      db.close()
      await db.open()
      return read()
    }
  })
  const account = useAccount()
  const [askToSave, setAskToSave] = useState(false)
  const pendingSave = useRef(false)
  // opened inside Instagram/TikTok/LinkedIn…: ask to move to the real browser first
  const [gateApp, setGateApp] = useState(() => (recall('deq-stay-in-app') ? null : inAppBrowser()))
  // the six-second story, once, for someone new
  // from the 5th person, after signing in (or "Not now"): put deq on the Home Screen
  const [homeTip, setHomeTip] = useState(false)
  const pendingHome = useRef(false)
  const [installPrompt, setInstallPrompt] = useState(null)
  // the Install pill: shown in a browser tab, gone once deq is on the Home Screen
  const [installOpen, setInstallOpen] = useState(false)
  const [installed, setInstalled] = useState(() => isStandalone())
  useEffect(() => {
    const done = () => setInstalled(true)
    window.addEventListener('appinstalled', done)
    return () => window.removeEventListener('appinstalled', done)
  }, [])
  // Android: the pill only shows once Chrome allows installing, and a tap opens
  // Chrome's own install prompt straight away. iPhone: the sheet with the steps.
  const canInstall = !installed && (!isAndroid || Boolean(installPrompt))
  // iPhone keeps the Home Screen app's storage apart from Safari's: tapping Install
  // copies your people, so the Home Screen app can paste them in when it first opens.
  const [deckCopied, setDeckCopied] = useState(false)
  // Safari with people in it: mark the address the Home Screen app will open at
  const peopleCount = people?.length
  useEffect(() => {
    if (!isIOS || isStandalone() || peopleCount === undefined) return
    markForCarry(peopleCount > 0)
  }, [peopleCount])
  // Home Screen app: only offer "Bring over" if it was installed from a Safari deq with people
  const [canBringOver] = useState(() => isIOS && isStandalone() && cameToCarry())
  function copyForHomeScreen() {
    copyDeck()
      .then(() => setDeckCopied(true))
      .catch(() => setDeckCopied(false))
  }
  async function startInstall() {
    if (isIOS && !isStandalone() && (people?.length ?? 0) > 0) copyForHomeScreen() // inside the tap, as Safari requires
    if (!isAndroid || !installPrompt) return setInstallOpen(true)
    installPrompt.prompt()
    const choice = await installPrompt.userChoice.catch(() => null)
    setInstallPrompt(null) // each prompt can only be used once
    if (choice?.outcome === 'accepted') setInstalled(true)
  }
  // Signed in from the 5th-person sheet (or came back from Google): the Home Screen is next.
  const signedIn = Boolean(account.user)
  const deckSize = people?.length ?? 0
  useEffect(() => {
    if (!signedIn || deckSize < 5 || !wantsHomeTip() || recall('deq-home-tip-shown')) return undefined
    remember('deq-home-tip-shown', '1') // once per visit
    const timer = setTimeout(() => setHomeTip(true), 900)
    return () => clearTimeout(timer)
  }, [signedIn, deckSize])
  useEffect(() => {
    const keep = event => {
      event.preventDefault() // Android: show our own button instead of the browser's banner
      setInstallPrompt(event)
    }
    window.addEventListener('beforeinstallprompt', keep)
    return () => window.removeEventListener('beforeinstallprompt', keep)
  }, [])
  // deck · scan (camera) · verify (check what the scan found) · form (type it in) · edit
  const [view, setView] = useState('deck')
  const [draft, setDraft] = useState({})
  // opened from someone's Deq card (their Wallet pass QR or link): add them straight away
  useEffect(() => {
    const card = readCard(window.location.hash)
    if (!card) return
    history.replaceState(null, '', window.location.pathname + window.location.search)
    setIncoming(card)
  }, [])
  // someone's shared card, shown before adding; "What's deq?" replays the intro
  const [incoming, setIncoming] = useState(null)
  const [watchIntro, setWatchIntro] = useState(false)
  // Skip on the film hides it for this visit; it comes back next time while the deck is empty
  const [skippedFilm, setSkippedFilm] = useState(false)
  const [myCardOpen, setMyCardOpen] = useState(false)
  // "Tap the card for more" shows until you've opened the details three times
  const [showZoomHint, setShowZoomHint] = useState(() => Number(recall('deq-zoom-used', true) ?? 0) < 3)
  function learnedZoom() {
    const used = Number(recall('deq-zoom-used', true) ?? 0) + 1
    remember('deq-zoom-used', String(used), true)
    if (used >= 3) setShowZoomHint(false)
  }
  const [openId, setOpenId] = useState(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [addedId, setAddedId] = useState(null)
  const [zoomed, setZoomed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [owner, setOwner] = useState(readOwner)

  const deckRef = useRef(null)
  const { width, top: deckTop } = useDeckBox(deckRef)
  const titleRef = useRef(null)
  const titleHeight = useHeight(titleRef)
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
  const everyone = people ?? []
  const empty = people?.length === 0
  // categories: everyone, who's gone quiet, met this month, or one company
  const [filterId, setFilterId] = useState('all')
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [insightsOpen, setInsightsOpen] = useState(false)
  const [waitingOpen, setWaitingOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false) // false | { scope, focusId }
  // a card's place was tapped: open search on the map, centred on that person
  useEffect(() => {
    const show = event => setSearchOpen({ scope: 'Map', focusId: event.detail })
    window.addEventListener('deq:show-on-map', show)
    return () => window.removeEventListener('deq:show-on-map', show)
  }, [])
  const filters = filtersFor(everyone)
  const filter = filters.find(option => option.id === filterId) ?? filters[0]
  const list = filter.id === 'all' ? everyone : everyone.filter(filter.test)
  const openIndex = list.findIndex(person => person.id === openId)
  const isOpen = openIndex >= 0

  // Where each card sits. Closed: a Wallet stack. Open: the chosen card at the top,
  // everyone else tucked into a thin pile at the bottom of the screen.
  const lift = isOpen ? titleHeight : 0
  const pileTop = Math.max(cardHeight + 24, viewport - (deckTop - lift) - 40 - PEEK * Math.min(list.length - 1, 4))
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

  const recentPlaces = [...new Set(everyone.map(person => person.place).filter(Boolean))].slice(0, 4)
  // places you've saved before, with where they are, so picking one again keeps the map pin
  const placeCoords = Object.fromEntries(
    everyone.filter(person => person.place && Number.isFinite(person.lat)).map(person => [person.place, { lat: person.lat, lng: person.lng }]),
  )
  const open = isOpen ? list[openIndex] : null
  const added = list.find(person => person.id === addedId)
  const openLook = open ? { backgroundImage: meshImage(open.company) } : null

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
    await removeCard(openId)
    closeCard()
  }

  // Everything goes through the tap-first add flow; whatever the scan found is already filled in.
  function onScanned(result) {
    setDraft(result)
    setView('form')
  }

  // remindWith only steers the calendar reminder in the add flow; it isn't stored
  async function addPerson({ remindWith: _remindWith, ...fields }) {
    const now = Date.now()
    const id = await db.cards.add({
      name: '',
      role: '',
      company: '',
      linkedin: '',
      email: '',
      place: '',
      ...withShortText(fields),
      metAt: now,
      lastContacted: now,
    })
    setDraft({})
    setOpenId(null)
    setAddedId(id)
    setView('deck')

    // At 5 people, ask once to sign in so they're backed up (again 10 people later if you said not now).
    const count = await db.cards.filter(visible).count()
    // From the 5th person: first "don't lose these people" (sign in), then the Home Screen.
    if (accountsEnabled && !account.user && count >= nextSaveAsk()) pendingSave.current = true
    else if (count >= 5 && wantsHomeTip()) pendingHome.current = true
  }

  async function saveEdit(fields) {
    const { name, role, company, place, linkedin, email, note } = fields
    await db.cards.update(openId, withShortText({ name, role, company, place, linkedin, email, note }))
    setDraft({})
    setView('deck')
  }

  function finishAdded() {
    const id = addedId
    setAddedId(null)
    if (id) openCard(id)
    if (pendingSave.current) {
      pendingSave.current = false
      setTimeout(() => setAskToSave('save'), 700)
    } else if (pendingHome.current) {
      pendingHome.current = false
      setTimeout(() => setHomeTip(true), 700)
    }
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

  // portrait only, judged by how the phone is actually held, so the keyboard can't trigger it
  useEffect(() => {
    const check = () => {
      const type = screen.orientation?.type
      const turned = type ? type.startsWith('landscape') : Math.abs(window.orientation ?? 0) === 90
      const phone = Math.min(screen.width, screen.height) < 500
      document.documentElement.classList.toggle('sideways', turned && phone)
    }
    check()
    screen.orientation?.addEventListener?.('change', check)
    window.addEventListener('orientationchange', check)
    return () => {
      screen.orientation?.removeEventListener?.('change', check)
      window.removeEventListener('orientationchange', check)
    }
  }, [])

  return (
    <MotionConfig reducedMotion="user">
      {/* phones turned sideways: deq is made for portrait */}
      <div className="rotate-note" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
          <path d="M11 18.5h2" />
        </svg>
        <p>Turn your phone upright</p>
      </div>
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
          {/* Wallet's top bar: the title on the left, + and a [categories | ⋯] pill on the right.
              With a card open: ✕ on the left, ⋯ (this card's options) on the right. */}
          <div className="top-bar">
            <AnimatePresence mode="popLayout" initial={false}>
              {isOpen ? (
                <motion.button
                  key="close"
                  className="glass-button"
                  aria-label="Close card"
                  onClick={closeCard}
                  {...POP}
                >
                  <CloseIcon />
                </motion.button>
              ) : (
                <motion.h1 key="title" className="top-name" {...POP}>
                  {empty ? '' : 'deq'}
                </motion.h1>
              )}
            </AnimatePresence>
            <AnimatePresence mode="popLayout" initial={false}>
              {isOpen ? (
                <motion.button
                  key="more"
                  className="glass-button"
                  aria-label="More options"
                  onClick={() => setDetailsOpen(true)}
                  {...POP}
                >
                  <MoreIcon />
                </motion.button>
              ) : (
                <motion.div key="actions" className="top-actions" {...POP}>
                  {!empty && (
                    <button className="glass-button" aria-label="Add a person" onClick={() => setView('scan')}>
                      <PlusIcon />
                    </button>
                  )}
                  {!empty && (
                    <button className="glass-button" aria-label="Search" onClick={() => setSearchOpen({ scope: 'All' })}>
                      <SearchIcon />
                    </button>
                  )}
                  {empty && canInstall && <InstallPill onClick={startInstall} />}
                  <div className="glass-pair">
                    {!empty && (
                      <button
                        className={filter.id === 'all' ? '' : 'active'}
                        aria-label="Categories"
                        onClick={() => setCategoriesOpen(true)}
                      >
                        <CategoriesIcon />
                      </button>
                    )}
                    <button aria-label="Menu" onClick={() => setMenuOpen(true)}>
                      <MoreIcon />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {/* Wallet: an opened card goes straight to the top, so the summary folds away */}
          <motion.div
            ref={titleRef}
            className="top-title"
            initial={false}
            animate={isOpen ? { opacity: 0, scale: 0.96, filter: 'blur(6px)' } : { opacity: 1, scale: 1, filter: 'blur(0px)' }}
            transition={SETTLE}
            style={{ transformOrigin: 'top left' }}
          >
            {list.length > 0 && filter.id === 'all' && <Summary people={list} onOpen={() => setInsightsOpen(true)} onWaiting={() => setWaitingOpen(true)} onInstall={canInstall ? startInstall : null} />}
            {filter.id === 'all' && <Nudge people={list} onOpen={openCard} />}
            {filter.id !== 'all' && (
              <button className="filter-chip" onClick={() => setFilterId('all')}>
                {plural(list.length, 'person')} · Show everyone
              </button>
            )}
          </motion.div>
        </header>

        <motion.section
          className="deck"
          ref={deckRef}
          style={{ height: deckHeight }}
          initial={false}
          // Wallet: the deck slides up over the folded title, so the open card sits at the top.
          // Only a transform moves, so nothing on the page has to be laid out again.
          animate={{ y: -lift }}
          transition={SPRING}
        >
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
                transition={{ ...SPRING, opacity: SETTLE }}
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
                    if (!event.target.closest('button, a, input, form')) {
                      setZoomed(true)
                      learnedZoom()
                    }
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
                  // Only the open card needs a shared-layout id (for flying into the zoom view).
                  // Giving every card one made the animation library re-measure the whole deck on
                  // every frame, which is what made opening a card stutter.
                  <motion.div layoutId={selected ? `card-${person.id}` : undefined} transition={SPRING}>
                    <DeqCard
                      person={person}
                      interactive={selected}
                      open={selected || (!isOpen && index === list.length - 1)}
                    />
                  </motion.div>
                )}
                {/* a quiet hint above the open card, until you've used it a few times */}
                <AnimatePresence>
                  {selected && !zoomed && showZoomHint && (
                    <motion.p
                      className="card-hint"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0, transition: { delay: 0.45, duration: 0.4 } }}
                      exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    >
                      Tap the card for more about {person.name.split(' ')[0]}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </motion.section>

        {empty && skippedFilm && (
          <div className="empty-start">
            <button className="welcome-add" onClick={() => setView('scan')}>
              <span className="welcome-plus">
                <PlusIcon size={30} />
              </span>
              Add your first person
            </button>
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
            placeCoords={placeCoords}
            onSave={saveEdit}
            onClose={() => setView('deck')}
          />
        )}
        {view === 'form' && (
          <AddFlow
            key="form"
            initial={draft}
            recentPlaces={recentPlaces}
            placeCoords={placeCoords}
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
            count={everyone.length}
            onOwner={name => {
              setOwner(name)
              saveOwner(name)
            }}
            onMyCard={() => {
              setMenuOpen(false)
              setMyCardOpen(true)
            }}
            onClose={() => setMenuOpen(false)}
          />
        )}
        {myCardOpen && <MyCard key="mycard" owner={owner} onClose={() => setMyCardOpen(false)} />}
        {searchOpen && (
          <Search
            key="search"
            people={everyone}
            startScope={searchOpen.scope}
            focusId={searchOpen.focusId}
            onOpenPerson={id => {
              setSearchOpen(false)
              setFilterId('all')
              openCard(id)
            }}
            onClose={() => setSearchOpen(false)}
          />
        )}
        {waitingOpen && (
          <Waiting
            key="waiting"
            people={everyone}
            onOpenPerson={id => {
              setWaitingOpen(false)
              setFilterId('all')
              openCard(id)
            }}
            onClose={() => setWaitingOpen(false)}
          />
        )}
        {insightsOpen && (
          <Insights
            key="insights"
            people={everyone}
            onOpenPerson={id => {
              setInsightsOpen(false)
              setFilterId('all')
              openCard(id)
            }}
            onClose={() => setInsightsOpen(false)}
          />
        )}
        {categoriesOpen && (
          <CategoriesSheet
            key="categories"
            filters={filters}
            current={filter.id}
            onPick={id => {
              setFilterId(id)
              setCategoriesOpen(false)
              closeCard()
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            onClose={() => setCategoriesOpen(false)}
          />
        )}
        {installOpen && (
          <HomeScreenSheet
            key="install"
            installPrompt={installPrompt}
            count={everyone.length}
            copied={deckCopied}
            onCopy={copyForHomeScreen}
            onInstalled={() => setInstalled(true)}
            onClose={() => setInstallOpen(false)}
          />
        )}
        {homeTip && (
          <HomeScreenSheet
            key="home-tip"
            installPrompt={installPrompt}
            count={everyone.length}
            copied={deckCopied}
            onCopy={copyForHomeScreen}
            onClose={() => {
              remember('deq-home-tip', '1', true)
              setHomeTip(false)
            }}
          />
        )}
        {incoming && !watchIntro && (
          <SharedCard
            key="shared"
            person={incoming}
            onIntro={() => setWatchIntro(true)}
            onAdd={() => {
              setDraft(incoming)
              setIncoming(null)
              setView('form')
            }}
            onClose={() => setIncoming(null)}
          />
        )}
        {/* an empty deq is the film: it loops behind the + until the first person is added */}
        {((empty && view === 'deck' && !gateApp && !incoming && !skippedFilm) || watchIntro) && (
          <Intro
            key="intro"
            onDone={() => (watchIntro ? setWatchIntro(false) : setSkippedFilm(true))}
            onInstall={canInstall && !watchIntro ? startInstall : null}
            // the Home Screen app on iPhone starts empty: offer to bring the cards over from Safari
            onBringOver={canBringOver && !watchIntro ? pasteDeck : null}
            // + on the film: add the person whose card brought you here, or scan someone new
            onAdd={() => {
              setWatchIntro(false)
              if (incoming) {
                setDraft(incoming)
                setIncoming(null)
                setView('form')
              } else setView('scan')
            }}
          />
        )}
        {gateApp && <InAppGate key="gate" app={gateApp} onContinue={() => setGateApp(null)} />}
        {zoomed && open && <ZoomView key="zoom" person={open} onClose={() => setZoomed(false)} />}
        {askToSave && !account.user && (
          <SaveSheet
            key="save"
            mode={askToSave}
            count={everyone.length}
            people={everyone}
            onClose={() => {
              if (askToSave === 'save') {
                laterSaveAsk(everyone.length)
                // "Not now" to signing in: still offer the Home Screen, so the cards
                // at least survive on this phone
                if (wantsHomeTip()) setTimeout(() => setHomeTip(true), 600)
              }
              setAskToSave(false)
            }}
          />
        )}
      </AnimatePresence>
      </LayoutGroup>
    </MotionConfig>
  )
}


// Two numbers you can read at a glance: who you met this month, who's waiting on you.
function Summary({ people, onOpen, onWaiting, onInstall }) {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const metThisMonth = people.filter(person => (person.metAt ?? person.lastContacted) >= monthStart).length
  const waiting = people.filter(person => isWaiting(person)).length
  const monthName = now.toLocaleDateString('en-GB', { month: 'long' })

  // met opens Insights, waiting opens the people waiting on you; the chevron says they can be tapped
  return (
    <div className="summary">
      <button className="stat" onClick={onOpen}>
        <b>{metThisMonth}</b>
        <span>
          met in {monthName} <StatChevron />
        </span>
      </button>
      <button className={`stat${waiting > 0 ? ' due' : ''}`} onClick={onWaiting}>
        <b>{waiting}</b>
        <span>
          {waiting === 0 ? 'all caught up' : 'waiting on you'} <StatChevron />
        </span>
      </button>
      {onInstall && <InstallPill onClick={onInstall} />}
    </div>
  )
}

// Black pill, white text (inverted in dark mode): the one way to install deq.
function InstallPill({ onClick }) {
  return (
    <button className="install-pill" onClick={onClick}>
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" />
      </svg>
      Install
    </button>
  )
}

function StatChevron() {
  return (
    <svg className="stat-chevron" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.5 5.5 16 12l-6.5 6.5" />
    </svg>
  )
}

// The in-app reminder: the person whose follow-up date has come (longest overdue
// first), with what stood out about them, so you know exactly who they are.
const DAY = 24 * 60 * 60 * 1000
function Nudge({ people, onOpen }) {
  const due = people
    .filter(person => person.followUpDays && Date.now() >= person.lastContacted + person.followUpDays * DAY)
    .sort((a, b) => a.lastContacted + a.followUpDays * DAY - (b.lastContacted + b.followUpDays * DAY))
  if (!due.length) return null
  const person = due[0]
  const first = person.name.split(' ')[0]
  return (
    <button className="nudge" onClick={() => onOpen(person.id)}>
      <span className="nudge-title">
        Say hi to {first}
        {due.length > 1 && <span className="nudge-more"> +{due.length - 1} more</span>}
      </span>
      <span className="nudge-text">
        {person.note || [person.role, person.company].filter(Boolean).join(' · ') || `Met at ${person.place || 'an event'}`}
      </span>
    </button>
  )
}

// The Home Screen ask: only in a browser tab, and only until it's been answered.
function wantsHomeTip() {
  return !isStandalone() && !recall('deq-home-tip', true)
}

// When to ask to sign in: at 5 people, then 10 more after each "Not now".
function nextSaveAsk() {
  try {
    return Number(localStorage.getItem('deq-save-ask-at')) || 5
  } catch {
    return 5
  }
}

function laterSaveAsk(count) {
  try {
    localStorage.setItem('deq-save-ask-at', String(count + 10))
  } catch {
    // private browsing: it asks again next time
  }
}

// Until there's an account, the title uses the name you set in the menu (or just "deq").
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


function plural(count, word) {
  return `${count} ${count === 1 ? word : word === 'person' ? 'people' : word + 's'}`
}
