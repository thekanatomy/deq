import { motion } from 'motion/react'
import { isIOS } from './browser'

// From the 5th person, right after the sign-in ask: put deq on the Home Screen, so it
// opens like an app and iPhone doesn't clear its data.
// Android can install in one tap (the browser's own prompt); iPhone needs the Share
// menu, so we show the three steps.
export default function HomeScreenSheet({ installPrompt, onClose }) {
  async function install() {
    installPrompt.prompt()
    await installPrompt.userChoice.catch(() => {})
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
        <h2 className="save-title">Keep deq on your Home Screen</h2>
        <p className="save-text">
          {isIOS
            ? 'Safari can clear websites you don’t open for a while. On your Home Screen, deq is kept like an app, one tap away at the next event.'
            : 'It opens like an app, keeps your cards on this phone, and is one tap away at the next event.'}
        </p>

        {installPrompt ? (
          <button className="primary-button dark" onClick={install}>Add to Home Screen</button>
        ) : (
          <ol className="home-steps">
            <li>
              <span>1</span>Tap <b>Share</b> {isIOS ? 'at the bottom of Safari' : 'in your browser menu'}
            </li>
            <li>
              <span>2</span>Tap <b>Add to Home Screen</b>
            </li>
            <li>
              <span>3</span>Open deq from your Home Screen
            </li>
          </ol>
        )}
        <button className="flow-skip save-later" onClick={onClose}>Later</button>
      </motion.div>
    </motion.div>
  )
}
