import { useState } from 'react'
import { isAndroid } from './browser'
import { sendMagicLink, signInWithGoogle, verifyCode } from './sync'

const SHOW_GOOGLE = false

// An email code (no password); Google in one tap later. Used by the "Save your deq"
// sheet and by Account in the menu.
export default function SignIn() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState('idle') // idle | sending | sent | checking | failed
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')

  async function google() {
    const { error } = await signInWithGoogle()
    if (error) {
      setState('failed')
      setMessage('Google sign-in isn’t available right now.')
    }
  }

  async function sendLink(event) {
    event.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setState('failed')
      setMessage('That email doesn’t look right.')
      return
    }
    setState('sending')
    try {
      await sendMagicLink(email.trim())
      setMessage('')
      setState('sent')
    } catch (error) {
      setState('failed')
      // Supabase allows one code per email per minute: "...only request this after 42 seconds."
      const wait = error.message?.match(/(\d+)\s*second/i)?.[1]
      setMessage(
        /rate|second/i.test(error.message)
          ? `A code was just sent, so check your email. You can ask for a new one in ${wait ? `${wait} seconds` : 'a minute'}.`
          : 'Couldn’t send the email. Try again.',
      )
    }
  }

  async function checkCode(value) {
    const digits = value.replace(/\D/g, '').slice(0, 6)
    setCode(digits)
    if (digits.length < 6) return
    setState('checking')
    try {
      await verifyCode(email.trim(), digits)
      // signed in: the sheet closes by itself and syncing starts
    } catch {
      setState('sent')
      setCode('')
      setMessage('That code didn’t work. Check the newest email and try again.')
    }
  }

  if (state === 'sent' || state === 'checking') {
    return (
      <div className="signin-sent" aria-live="polite">
        <MailIcon />
        <p className="signin-sent-title">Enter the code</p>
        <p className="signin-sent-text">
          We sent a 6-digit code to <b>{email.trim()}</b>.
        </p>
        <input
          className="answer code-input"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          maxLength={6}
          autoFocus
          value={code}
          disabled={state === 'checking'}
          onChange={event => checkCode(event.target.value)}
          aria-label="6-digit code"
        />
        <MailApps email={email.trim()} />
        {message && state === 'sent' && <p className="signin-error" role="alert">{message}</p>}
        {state === 'checking' && <p className="signin-sent-text">Checking…</p>}
        <button
          className="flow-skip"
          onClick={() => {
            setState('idle')
            setMessage('')
          }}
        >
          Use a different email
        </button>
      </div>
    )
  }

  return (
    <div className="signin">
      {/* Google sign-in comes later: one email box keeps it simple */}
      {SHOW_GOOGLE && (
        <>
          <button className="google-button" onClick={google}>
            <GoogleLogo />
            Continue with Google
          </button>
          <p className="signin-or"><span>or</span></p>
        </>
      )}

      <form className="signin-email" onSubmit={sendLink}>
        <input
          className="answer"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="off"
          placeholder="name@mail.com"
          enterKeyHint="send"
          value={email}
          onChange={event => {
            setEmail(event.target.value)
            if (state === 'failed') setState('idle')
          }}
        />
        <button className="primary-button" disabled={!email || state === 'sending'}>
          {state === 'sending' ? 'Sending…' : 'Email Me a Code'}
        </button>
      </form>

      {state === 'failed' && <p className="signin-error" role="alert">{message}</p>}
    </div>
  )
}

// One tap to the inbox. A web page can't bring up the phone's own list of mail apps,
// so: on Android the system's "open email app" (it asks which, when there are several);
// on iPhone, Mail plus the app that fits the address (Gmail for Gmail and ASU, Outlook
// for Outlook). iPhone also offers the code above the keyboard once the email arrives.
function MailApps({ email }) {
  if (isAndroid) {
    return (
      <div className="mail-apps">
        <a className="mail-app" href="intent://#Intent;action=android.intent.action.MAIN;category=android.intent.category.APP_EMAIL;end">
          Open email app
        </a>
      </div>
    )
  }
  const domain = email.split('@')[1]?.toLowerCase() ?? ''
  const apps = [
    { id: 'mail', label: 'Open Mail', href: 'message://' },
    /gmail\.com$|googlemail\.com$|asu\.edu$/.test(domain) && { id: 'gmail', label: 'Gmail', href: 'googlegmail://' },
    /outlook\.|hotmail\.|live\.|msn\./.test(domain) && { id: 'outlook', label: 'Outlook', href: 'ms-outlook://' },
  ].filter(Boolean)
  return (
    <div className="mail-apps">
      {apps.map(app => (
        <a key={app.id} className="mail-app" href={app.href}>
          {app.label}
        </a>
      ))}
    </div>
  )
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  )
}
