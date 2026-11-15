import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import DeqCard from './DeqCard'
import PulsePanel from './PulsePanel'

const SPRING = { type: 'spring', bounce: 0.1, duration: 0.5 }
const STEP = 0.5 // how far (of the card's width) the next card sits to the side

// deq pulse home: one card always in front, the rest tucked behind it at the sides,
// and that person's pulse right underneath. Swipe the card to change person.
export default function PulseWallet({ people, onOpen }) {
  const [index, setIndex] = useState(0)
  const [box, setBox] = useState(0)
  const stage = useRef(null)
  const current = Math.min(index, people.length - 1)
  const person = people[current]

  useEffect(() => {
    const element = stage.current
    if (!element) return
    const measure = () => setBox(element.offsetWidth)
    measure()
    const watch = new ResizeObserver(measure)
    watch.observe(element)
    return () => watch.disconnect()
  }, [])

  const cardWidth = Math.min(box * 0.7, 300)
  const cardHeight = cardWidth * 1.4

  const go = to => setIndex(Math.max(0, Math.min(people.length - 1, to)))

  return (
    <section className="pw">
      <div className="pw-stage" ref={stage} style={{ height: cardHeight + 12 }}>
        {box > 0 &&
          people.map((card, position) => {
            const d = position - current
            if (Math.abs(d) > 2) return null
            const front = d === 0
            return (
              <motion.div
                key={card.id}
                className="pw-slot"
                style={{ width: cardWidth, left: (box - cardWidth) / 2, zIndex: 10 - Math.abs(d) }}
                initial={false}
                animate={{
                  x: d * cardWidth * STEP,
                  scale: 1 - 0.1 * Math.abs(d),
                  opacity: Math.abs(d) === 2 ? 0.35 : Math.abs(d) === 1 ? 0.7 : 1,
                }}
                transition={SPRING}
                drag={front ? 'x' : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.5}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -50 || info.velocity.x < -500) go(current + 1)
                  else if (info.offset.x > 50 || info.velocity.x > 500) go(current - 1)
                }}
                onTap={() => (front ? onOpen(card) : go(position))}
                role="button"
                tabIndex={0}
                aria-label={front ? `Open ${card.name}` : `Show ${card.name}`}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    front ? onOpen(card) : go(position)
                  }
                }}
              >
                <DeqCard person={card} interactive={false} open={front} />
              </motion.div>
            )
          })}
      </div>

      {people.length > 1 && (
        <div className="pw-dots" aria-hidden="true">
          {people.slice(0, 9).map((card, position) => (
            <span key={card.id} className={position === current ? 'on' : ''} />
          ))}
        </div>
      )}

      <p className="pw-hint">Tap the card for details · swipe for the next person</p>

      {person && (
        <div className="pw-panel" key={person.id}>
          <PulsePanel person={person} />
        </div>
      )}
    </section>
  )
}
