import { motion } from 'motion/react'
import { isWaiting, placeOf } from './filters'
import { CloseIcon } from './icons'
import { cascade } from './MenuSheet.jsx'

const DAY = 24 * 60 * 60 * 1000
const VIBES = ['Quick hello', 'Nice chat', 'Good conversation', 'Really clicked', 'Must stay in touch']
const VIBE_COLOURS = ['#FF3B30', '#FF9500', '#F2B600', '#A3D94B', '#34C759']
const CHANNELS = ['In person', 'LinkedIn', 'Mail', 'Text']
const GROW = { type: 'spring', bounce: 0, duration: 0.8 }

const metAt = person => person.metAt ?? person.lastContacted

// Apple Health-style summary of your deq: one card per question, each with a
// big number, a sentence, and one chart.
export default function Insights({ people, onOpenPerson, onClose }) {
  const now = new Date()
  const total = people.length

  // met: the last six months, this one highlighted
  const months = Array.from({ length: 6 }, (_, index) => {
    const start = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1)
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1)
    return {
      label: start.toLocaleDateString('en-GB', { month: 'short' }),
      count: people.filter(person => metAt(person) >= start.getTime() && metAt(person) < end.getTime()).length,
    }
  })
  const thisMonth = months[5].count
  const lastMonth = months[4].count
  const monthName = now.toLocaleDateString('en-GB', { month: 'long' })
  const peak = Math.max(1, ...months.map(month => month.count))

  // keeping up
  const waiting = people.filter(person => isWaiting(person)).sort((a, b) => a.lastContacted - b.lastContacted)
  const caughtUp = total - waiting.length
  const share = total ? Math.round((caughtUp / total) * 100) : 0

  // how it went
  const vibes = VIBES.map((name, index) => ({
    name,
    colour: VIBE_COLOURS[index],
    count: people.filter(person => person.vibe === index + 1).length,
  }))
  const rated = vibes.reduce((sum, vibe) => sum + vibe.count, 0)

  // how you keep in touch / where you meet
  const channels = CHANNELS.map(name => ({ name, count: people.filter(person => person.lastChannel === name).length })).filter(
    channel => channel.count > 0,
  )
  const places = topCounts(people.map(placeOf).filter(Boolean), 5)

  let index = 0
  return (
    <motion.div
      className="menu insights"
      role="dialog"
      aria-label="Insights"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.18 } }}
      transition={{ duration: 0.22 }}
    >
      <div className="menu-bar">
        <span />
        <button className="menu-icon" aria-label="Close insights" onClick={onClose}>
          <CloseIcon size={24} />
        </button>
      </div>

      <div className="insights-scroll">
        <motion.h1 className="categories-title" {...cascade(index++)}>Insights</motion.h1>

        {/* ---------- met ---------- */}
        <motion.section className="insight" {...cascade(index++)}>
          <p className="insight-label" style={{ color: 'var(--tint-fill)' }}>Met</p>
          <p className="insight-big">
            {thisMonth} <span>in {monthName}</span>
          </p>
          <p className="insight-text">{trend(thisMonth, lastMonth, months[4].label)}</p>
          <div className="month-bars" role="img" aria-label={months.map(m => `${m.label}: ${m.count}`).join(', ')}>
            {months.map((month, column) => (
              <div key={month.label} className="month-bar">
                <span className="month-count">{month.count || ''}</span>
                <div className="month-track">
                  <motion.div
                    className={column === 5 ? 'month-fill now' : 'month-fill'}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: Math.max(month.count / peak, 0.04) }} // an empty month still shows a sliver
                    transition={{ ...GROW, delay: 0.25 + column * 0.05 }}
                  />
                </div>
                <span className="month-name">{month.label}</span>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ---------- keeping up ---------- */}
        <motion.section className="insight" {...cascade(index++)}>
          <p className="insight-label" style={{ color: '#34C759' }}>Keeping up</p>
          <p className="insight-big">
            {share}% <span>caught up</span>
          </p>
          <p className="insight-text">
            {waiting.length === 0
              ? 'You’re up to date with everyone.'
              : `${waiting.length} ${waiting.length === 1 ? 'person is' : 'people are'} waiting to hear from you.`}
          </p>
          <Split
            parts={[
              { name: 'Caught up', count: caughtUp, colour: '#34C759' },
              { name: 'Waiting', count: waiting.length, colour: '#FF9500' },
            ]}
          />
          {waiting.length > 0 && (
            <div className="insight-list">
              <p className="insight-sub">Waiting the longest</p>
              {waiting.slice(0, 3).map(person => (
                <button key={person.id} className="insight-person" onClick={() => onOpenPerson(person.id)}>
                  <span>{person.name}</span>
                  <span className="insight-days">{Math.floor((Date.now() - person.lastContacted) / DAY)} days</span>
                </button>
              ))}
            </div>
          )}
        </motion.section>

        {/* ---------- how it went ---------- */}
        {rated > 0 && (
          <motion.section className="insight" {...cascade(index++)}>
            <p className="insight-label" style={{ color: '#FF9500' }}>How it went</p>
            <p className="insight-big">
              {vibes[3].count + vibes[4].count} <span>really clicked</span>
            </p>
            <p className="insight-text">The people you’d most want to keep.</p>
            <Split parts={vibes} />
          </motion.section>
        )}

        {/* ---------- keeping in touch ---------- */}
        {channels.length > 0 && (
          <motion.section className="insight" {...cascade(index++)}>
            <p className="insight-label" style={{ color: '#AF52DE' }}>How you keep in touch</p>
            <Bars items={channels} colour="#AF52DE" />
          </motion.section>
        )}

        {/* ---------- where you meet ---------- */}
        {places.length > 0 && (
          <motion.section className="insight" {...cascade(index++)}>
            <p className="insight-label" style={{ color: '#FF2D55' }}>Where you meet</p>
            <Bars items={places} colour="#FF2D55" />
          </motion.section>
        )}

        <motion.p className="menu-foot" {...cascade(index++)}>
          {total} {total === 1 ? 'person' : 'people'} in your deq
        </motion.p>
      </div>
    </motion.div>
  )
}

// One bar split into coloured parts, with a legend under it.
function Split({ parts }) {
  const shown = parts.filter(part => part.count > 0)
  return (
    <>
      <div className="split" role="img" aria-label={shown.map(part => `${part.name}: ${part.count}`).join(', ')}>
        {shown.map((part, position) => (
          <motion.span
            key={part.name}
            style={{ background: part.colour, flexGrow: part.count }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ ...GROW, delay: 0.3 + position * 0.06 }}
          />
        ))}
      </div>
      <ul className="legend">
        {shown.map(part => (
          <li key={part.name}>
            <i style={{ background: part.colour }} />
            {part.name} <b>{part.count}</b>
          </li>
        ))}
      </ul>
    </>
  )
}

// Horizontal bars, biggest first.
function Bars({ items, colour }) {
  const peak = Math.max(1, ...items.map(item => item.count))
  return (
    <div className="hbars">
      {[...items]
        .sort((a, b) => b.count - a.count)
        .map((item, row) => (
          <div key={item.name} className="hbar">
            <span className="hbar-name">{item.name}</span>
            <div className="hbar-track">
              <motion.div
                className="hbar-fill"
                style={{ background: colour }}
                initial={{ width: 0 }}
                animate={{ width: `${(item.count / peak) * 100}%` }}
                transition={{ ...GROW, delay: 0.3 + row * 0.05 }}
              />
            </div>
            <span className="hbar-count">{item.count}</span>
          </div>
        ))}
    </div>
  )
}

function topCounts(values, limit) {
  const counts = new Map()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

function trend(now, before, beforeName) {
  if (now === before) return now === 0 ? 'No one new yet this month.' : `The same as ${beforeName}.`
  const diff = Math.abs(now - before)
  return now > before ? `${diff} more than ${beforeName}.` : `${diff} fewer than ${beforeName}.`
}
