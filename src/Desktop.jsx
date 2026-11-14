import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo } from 'react'
import qr from './assets/deq-qr.svg'
import { meshImage } from './brands'
import { db, visible } from './db'
import { nextStep } from './history'
import SignIn from './SignIn'
import { accountsEnabled, signOut, useAccount } from './sync'
import { companyOf, roleOf } from './text'

// deq on a laptop: your cards to look through, side by side. Meeting people (scan,
// where you met, Wallet) happens on the phone, so this face keeps pointing there.
export default function Desktop() {
  const account = useAccount()
  const people = useLiveQuery(() => db.cards.orderBy('lastContacted').reverse().filter(visible).toArray(), [])

  if (!people || (accountsEnabled && !account.ready)) return <div className="dk" />
  const signedIn = Boolean(account.user)
  return signedIn || people.length ? <Grid people={people} account={account} /> : <Landing />
}

function Landing() {
  const sample = [
    { name: 'Sam Lee', company: 'Google', when: 'Reach out Mon' },
    { name: 'Alex Moore', company: 'Stripe', when: 'Reach out 2 Dec' },
    { name: 'Kanish Goudam', company: 'ASU', when: 'Reach out Fri 20 Nov' },
  ]
  return (
    <div className="dk dk-landing">
      <header className="dk-head">
        <span className="dk-logo">deq</span>
      </header>
      <section className="dk-hero">
        <div>
          <h1 className="dk-title">Never lose the people you meet.</h1>
          <p className="dk-lead">
            Scan a card, badge or LinkedIn. Five seconds later they’re in your deq, with where you met and when to reach out.
          </p>
          <div className="dk-start">
            <img className="dk-qr" src={qr} alt="QR code for deq.one" />
            <div>
              <b>Start on your phone</b>
              <span>Point your camera here. Free, no sign-up.</span>
            </div>
          </div>
          {accountsEnabled && (
            <div className="dk-back">
              <p>Already have a deq?</p>
              <SignIn />
            </div>
          )}
        </div>
        <div className="dk-fan" aria-hidden="true">
          {sample.map((person, index) => (
            <div key={person.name} className={`dk-card dk-fan-${index}`} style={{ backgroundImage: meshImage(person.company) }}>
              <span className="dk-av">{initials(person.name)}</span>
              <span className="dk-co">{person.company}</span>
              <span className="dk-name">{person.name}</span>
              <span className="dk-when">{person.when}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function Grid({ people, account }) {
  const thisMonth = useMemo(() => {
    const start = new Date()
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
    return people.filter(person => person.metAt >= start.getTime()).length
  }, [people])
  const late = people.filter(person => nextStep(person).late).length
  const month = new Date().toLocaleDateString('en-GB', { month: 'long' })
  return (
    <div className="dk">
      <header className="dk-head">
        <span className="dk-logo">deq</span>
        {account.user && (
          <span className="dk-me">
            {account.user.email}
            <button className="dk-out" onClick={signOut}>Sign Out</button>
          </span>
        )}
      </header>
      <main className="dk-wrap">
        <h1 className="dk-h1">Your people</h1>
        <p className="dk-meta">
          {thisMonth} met in {month} · {late ? `${late} to reach out to` : 'all caught up'}
        </p>
        <p className="dk-soon">The laptop version is coming soon. For now, open a card on your phone to do more.</p>
        {people.length ? (
          <div className="dk-grid">
            {people.map(person => (
              <Card key={person.id} person={person} />
            ))}
          </div>
        ) : (
          <p className="dk-empty">Your cards show up here after you add someone on your phone.</p>
        )}
      </main>
      <aside className="dk-tile">
        <img className="dk-tile-qr" src={qr} alt="" />
        <div>
          <b>Add people from your phone</b>
          <span>Scan to open deq.one</span>
        </div>
      </aside>
    </div>
  )
}

function Card({ person }) {
  const next = nextStep(person)
  const photo = usePhoto(person.photo)
  return (
    <article className="dk-card" style={{ backgroundImage: meshImage(person.company) }}>
      <span className="dk-av">{photo ? <img src={photo} alt="" /> : initials(person.name)}</span>
      {companyOf(person) && <span className="dk-co">{companyOf(person)}</span>}
      <span className="dk-role">{roleOf(person) || 'Contact'}</span>
      <span className="dk-name">{person.name}</span>
      <span className={next.late ? 'dk-when late' : 'dk-when'}>
        {next.label}
        {next.detail && <i> · {next.detail}</i>}
      </span>
    </article>
  )
}

function usePhoto(photo) {
  const url = useMemo(() => (typeof photo === 'string' ? photo : photo instanceof Blob ? URL.createObjectURL(photo) : null), [photo])
  useEffect(() => () => url && !url.startsWith('data:') && URL.revokeObjectURL(url), [url])
  return url
}

const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase()
