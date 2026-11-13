import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'

// "What stood out?" as blocks you open, each full of small, respectful memory cues
// (Medium's grouped topics and X's interest chips on Mobbin). Picks are written into
// the same note as before, so search, "Can't remember someone?" and the card all use them.
// Deliberately no cues about body size, skin, age or beliefs.
const BLOCKS = [
  { id: 'look', icon: '👀', name: 'Their look', options: ['Glasses', 'Sunglasses', 'Beard', 'Moustache', 'Curly hair', 'Long hair', 'Short hair', 'Braids', 'Dyed hair', 'Tall', 'Big smile', 'Freckles', 'Earrings', 'Hat', 'Cap'] },
  { id: 'style', icon: '👕', name: 'Their style', options: ['Suit', 'Blazer', 'Hoodie', 'T-shirt', 'Dress', 'Saree', 'Bright colours', 'All black', 'Sneakers', 'Boots', 'Nice watch', 'Lanyard', 'Backpack', 'Tote bag', 'Jewellery'] },
  { id: 'vibe', icon: '✨', name: 'Their vibe', options: ['Funny', 'Calm', 'Friendly', 'Energetic', 'Thoughtful', 'Great listener', 'Confident', 'Curious', 'Quiet', 'Kind', 'Sharp', 'Inspiring', 'Helpful'] },
  { id: 'talked', icon: '💬', name: 'You talked about', options: ['Jobs & hiring', 'Internships', 'Their startup', 'Research', 'Classes', 'AI', 'Design', 'Data', 'Product', 'Sports', 'Music', 'Movies', 'Travel', 'Food', 'Books', 'Gaming'] },
  { id: 'into', icon: '⚽', name: 'They’re into', options: ['F1', 'Football', 'Cricket', 'Basketball', 'Running', 'Gym', 'Yoga', 'Photography', 'Coffee', 'Cooking', 'Hiking', 'Art', 'Fashion', 'Tech', 'Startups', 'Anime'] },
  { id: 'share', icon: '🤝', name: 'You share', options: ['Same school', 'Same major', 'Same hometown', 'Same country', 'Mutual friend', 'Same club', 'Same company', 'Same event', 'Same language'] },
  { id: 'next', icon: '📌', name: 'They offered', options: ['Referral', 'Resume review', 'Coffee chat', 'Intro to someone', 'Mentorship', 'Share a job post', 'Meet again', 'Send slides'] },
]
const ALL = new Map(BLOCKS.flatMap(block => block.options.map(option => [option.toLowerCase(), option])))

// "Glasses, Funny, also from Chennai" -> picked: Glasses, Funny; extra: "also from Chennai"
function split(note = '') {
  const picked = []
  const extra = []
  for (const part of note.split(/,\s*/).map(text => text.trim()).filter(Boolean)) {
    const option = ALL.get(part.toLowerCase())
    if (option) picked.push(option)
    else extra.push(part)
  }
  return { picked, extra: extra.join(', ') }
}

export default function NoteBuilder({ value, onChange }) {
  const { picked, extra } = split(value)
  const [open, setOpen] = useState(null)

  function write(nextPicked, nextExtra) {
    onChange([...nextPicked, nextExtra.trim()].filter(Boolean).join(', '))
  }
  function toggle(option) {
    write(picked.includes(option) ? picked.filter(item => item !== option) : [...picked, option], extra)
    navigator.vibrate?.(6)
  }

  return (
    <div className="note-builder">
      <AnimatePresence initial={false}>
        {picked.length > 0 && (
          <motion.div
            className="nb-picked"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
          >
            {picked.map(option => (
              <button key={option} onClick={() => toggle(option)} aria-label={`Remove ${option}`}>
                {option} <span aria-hidden="true">×</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="nb-blocks">
        {BLOCKS.map(block => {
          const count = block.options.filter(option => picked.includes(option)).length
          const isOpen = open === block.id
          return (
            <div key={block.id} className={isOpen ? 'nb-block open' : 'nb-block'}>
              <button className="nb-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : block.id)}>
                <span className="nb-icon" aria-hidden="true">
                  {block.icon}
                </span>
                <span className="nb-name">{block.name}</span>
                {count > 0 && <span className="nb-count">{count}</span>}
                <span className="nb-chev" aria-hidden="true">
                  ›
                </span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    className="nb-options"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
                  >
                    <div className="nb-chips">
                      {block.options.map(option => {
                        const on = picked.includes(option)
                        return (
                          <button key={option} className={on ? 'on' : ''} aria-pressed={on} onClick={() => toggle(option)}>
                            {on && <span aria-hidden="true">✓ </span>}
                            {option}
                          </button>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>

      <textarea
        className="nb-extra"
        rows={2}
        placeholder="Anything else? Also from Chennai, red jacket…"
        value={extra}
        onChange={event => write(picked, event.target.value)}
      />
    </div>
  )
}
