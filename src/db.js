import Dexie from 'dexie'

// Everyone in your deq lives here, on the phone, first. When you're signed in,
// sync.js copies changes to your account so they survive a new phone.
export const db = new Dexie('allyDeck')

db.version(1).stores({ cards: '++id, name, lastContacted' })

// v2 adds what syncing needs:
//   uid       – the card's id everywhere (the phone's own id is only local)
//   updatedAt – when it last changed, so the newest edit wins
//   dirty     – 1 while a change hasn't reached your account yet
//   deleted   – 1 for a removed card waiting to tell your account
db.version(2)
  .stores({ cards: '++id, name, lastContacted, &uid, dirty' })
  .upgrade(tx =>
    tx
      .table('cards')
      .toCollection()
      .modify(card => {
        card.uid ??= crypto.randomUUID()
        card.updatedAt ??= card.lastContacted ?? Date.now()
        card.dirty = 1
      }),
  )

// Every change made in the app marks the card for syncing. Changes that come
// from your account are written with dirty: 0 and pass through untouched.
const listeners = new Set()
export function onLocalChange(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const notify = () => queueMicrotask(() => listeners.forEach(listener => listener()))

db.cards.hook('creating', (_key, card) => {
  card.uid ??= crypto.randomUUID()
  if (card.dirty === 0) return
  card.updatedAt = Date.now()
  card.dirty = 1
  notify()
})

db.cards.hook('updating', changes => {
  if (changes.dirty === 0) return undefined
  notify()
  // a new photo has to be uploaded again
  return { updatedAt: Date.now(), dirty: 1, ...('photo' in changes ? { photoPath: null } : {}) }
})

// Cards to show: everything except removed cards still waiting to sync.
export const visible = card => !card.deleted
