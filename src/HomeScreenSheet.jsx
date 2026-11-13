import { motion } from 'motion/react'
import { useState } from 'react'
import { isAndroid, isIOS, isStandalone } from './browser'

// Put deq on the Home Screen. Two tabs, like Apple's own pickers: iPhone and
// Android, opening on the phone you're holding. Android installs in one tap
// through the browser's own prompt; iPhone needs the Share menu, so it shows steps.
export default function HomeScreenSheet({ installPrompt, count = 0, copied = false, onCopy, onInstalled, onClose }) {
  // iPhone: the Home Screen app starts with empty storage, so the people here travel by clipboard
  const carry = isIOS && !isStandalone() && count > 0 && onCopy
  const [platform, setPlatform] = useState(isAndroid ? 'android' : 'apple')

  async function install() {
    installPrompt.prompt()
    const choice = await installPrompt.userChoice.catch(() => null)
    if (choice?.outcome === 'accepted') onInstalled?.()
    onClose()
  }

  return (
    <motion.div
      className="scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      onClick={onClose}
    >
      <motion.div
        className="sheet save-sheet"
        role="dialog"
        aria-label="Add deq to your Home Screen"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%', transition: { type: 'spring', bounce: 0, duration: 0.3 } }}
        transition={{ type: 'spring', bounce: 0, duration: 0.45 }}
        onClick={event => event.stopPropagation()}
      >
        <span className="grabber" />
        <span className="home-icon" aria-hidden="true">deq</span>
        <h2 className="save-title">Install deq</h2>
        <p className="save-text">It opens like an app, keeps your cards safe on this phone, and is one tap away at the next event.</p>

        <div className="platform-switch" role="tablist" aria-label="Your phone">
          {[
            ['apple', 'iPhone'],
            ['android', 'Android'],
          ].map(([id, name]) => (
            <button key={id} role="tab" aria-selected={platform === id} className={platform === id ? 'active' : ''} onClick={() => setPlatform(id)}>
              {platform === id && <motion.span layoutId="platform-pill" className="platform-pill" transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }} />}
              <span className="platform-name">{name}</span>
            </button>
          ))}
        </div>

        {platform === 'android' ? (
          installPrompt ? (
            <button className="primary-button dark" onClick={install}>Install deq</button>
          ) : (
            <ol className="home-steps">
              {isAndroid ? (
                <>
                  <li>
                    <span>1</span>Tap <b>⋮</b> at the top right of Chrome
                  </li>
                  <li>
                    <span>2</span>Tap <b>Install app</b> or <b>Add to Home screen</b>
                  </li>
                  <li>
                    <span>3</span>Open deq from your Home Screen
                  </li>
                </>
              ) : (
                <li>
                  <span>1</span>Open <b>deq.one</b> in Chrome on your Android phone, then tap Install
                </li>
              )}
            </ol>
          )
        ) : (
          <ol className="home-steps">
            {carry && (
              <li className="home-carry">
                <span>{copied ? '✓' : '0'}</span>
                <div>
                  {copied ? (
                    <>
                      <b>Your {count === 1 ? 'person is' : `${count} people are`} copied.</b> Paste them in when the Home Screen app opens. Don’t copy anything else until then.
                    </>
                  ) : (
                    <>
                      Copy your {count === 1 ? 'person' : `${count} people`} to bring them along{' '}
                      <button className="home-copy" onClick={onCopy}>Copy</button>
                    </>
                  )}
                </div>
              </li>
            )}
            {isIOS ? (
              <>
                <li>
                  <span>1</span>Tap <b>Share</b> <ShareGlyph /> at the bottom of Safari
                </li>
                <li>
                  <span>2</span>Tap <b>Add to Home Screen</b>
                </li>
                <li>
                  <span>3</span>Open deq from your Home Screen
                </li>
              </>
            ) : (
              <li>
                <span>1</span>Open <b>deq.one</b> in Safari on your iPhone, then tap <b>Share</b> → <b>Add to Home Screen</b>
              </li>
            )}
          </ol>
        )}
        <button className="flow-skip save-later" onClick={onClose}>Later</button>
      </motion.div>
    </motion.div>
  )
}

// Safari's Share icon, so people know what to look for
function ShareGlyph() {
  return (
    <svg className="share-glyph" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.5v11M8 7.5l4-4 4 4" />
      <path d="M8.5 10.5H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1.5" />
    </svg>
  )
}
