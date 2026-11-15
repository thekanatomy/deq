import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { KIND_LABEL, markReachedOut, readYou, saveYou, sweepCard } from './pulse'

const dayLabel = iso => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const host = url => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'source'
  }
}

// The pulse on a card: what changed in their world, the sources, an opening line,
// and every sweep that found nothing (the quiet is what makes a hit believable).
export default function PulsePanel({ person }) {
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [withContext, setWithContext] = useState(true)
  const [editingYou, setEditingYou] = useState(false)
  const [you, setYou] = useState(readYou)
  const [copied, setCopied] = useState(false)
  const first = person.name.split(' ')[0]
  const pulse = person.pulse ?? {}
  const news = pulse.news
  const latest = pulse.latest
  const history = pulse.history ?? []
  const shown = news ?? latest
  const draft = shown && (withContext ? shown.draft : shown.draftGeneric)

  async function check() {
    setChecking(true)
    setError('')
    try {
      await sweepCard(person)
    } catch (problem) {
      setError(problem.message)
    } finally {
      setChecking(false)
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // nothing to do: the text is on screen to select
    }
  }

  const mail =
    person.email && draft
      ? `mailto:${person.email}?subject=${encodeURIComponent(news?.headline ? `Saw the news — ${news.headline}` : 'Following up')}&body=${encodeURIComponent(draft)}`
      : null

  return (
    <section className="pulse">
      <div className="pulse-head">
        <p className="zoom-label">Pulse</p>
        <button className="pulse-check" onClick={check} disabled={checking}>
          {checking ? <span className="pulse-spin" aria-hidden="true" /> : null}
          {checking ? `Checking ${first}’s world…` : history.length ? 'Check again' : 'Check now'}
        </button>
      </div>

      {error && <p className="pulse-error">{error}</p>}

      {!history.length && !checking && (
        <p className="pulse-quiet">
          deq watches {person.company || 'their company'} and what {first} told you, and only speaks up when something changes. It
          searches their work, never just their name.
        </p>
      )}

      <AnimatePresence initial={false}>
        {news && (
          <motion.div
            key={news.checkedAt}
            className="pulse-news"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.45 }}
          >
            <p className="pulse-kind">
              <span className="pulse-dot" aria-hidden="true" />
              {KIND_LABEL[news.kind] ?? 'Something changed'} · found {dayLabel(news.checkedAt)}
            </p>
            <h3 className="pulse-headline">{news.headline}</h3>
            {news.detail && <p className="pulse-detail">{news.detail}</p>}
            {news.openings?.length > 0 && (
              <ul className="pulse-links">
                {news.openings.map(opening => (
                  <li key={opening.url || opening.title}>
                    <a href={opening.url} target="_blank" rel="noopener noreferrer">
                      {opening.title}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <p className="pulse-sources">
              {news.sources.map((source, index) => (
                <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">
                  {index + 1}. {source.title || host(source.url)}
                </a>
              ))}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {!news && latest && (
        <p className="pulse-quiet">
          Nothing new since {dayLabel(latest.since)}. That’s most checks, and that’s right: deq stays quiet until there’s a reason.
          {latest.nameNote ? ` ${latest.nameNote}` : ''}
        </p>
      )}

      {draft && (
        <div className="pulse-draft">
          <div className="pulse-draft-head">
            <p className="zoom-label">Opening line</p>
            <div className="pulse-toggle" role="group" aria-label="Context">
              <button className={withContext ? 'on' : ''} onClick={() => setWithContext(true)}>
                With context
              </button>
              <button className={withContext ? '' : 'on'} onClick={() => setWithContext(false)}>
                Generic
              </button>
            </div>
          </div>
          <AnimatePresence mode="wait">
            <motion.p
              key={withContext ? 'context' : 'generic'}
              className="pulse-draft-text"
              initial={{ opacity: 0, filter: 'blur(4px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, filter: 'blur(4px)' }}
              transition={{ duration: 0.25 }}
            >
              {draft}
            </motion.p>
          </AnimatePresence>
          <div className="pulse-actions">
            <button onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
            {mail && <a href={mail}>Email {first}</a>}
            {news && <button onClick={() => markReachedOut(person)}>I reached out</button>}
          </div>
          <p className="pulse-fine">Nothing is sent for you. Every fact links to its source.</p>
        </div>
      )}

      <button className="pulse-you-toggle" onClick={() => setEditingYou(open => !open)}>
        {editingYou ? 'Done' : you ? 'What deq knows about you' : 'Tell deq about you, for better opening lines'}
      </button>
      {editingYou && (
        <textarea
          className="pulse-you"
          rows={5}
          value={you}
          placeholder="Your projects, what each shows, what you’re looking for and when. e.g. MS Data Science at ASU, built deq (React + Gemini), looking for Summer 2027 data roles."
          onChange={event => {
            setYou(event.target.value)
            saveYou(event.target.value)
          }}
        />
      )}

      {history.length > 0 && (
        <div className="pulse-history">
          <p className="zoom-label">Every check</p>
          <ol>
            {history.map(entry => (
              <li key={entry.at} className={entry.isNews ? 'hit' : ''}>
                <span>{dayLabel(entry.at)}</span>
                {entry.isNews ? entry.headline : 'Nothing new'}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}
