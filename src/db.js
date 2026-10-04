import Dexie from 'dexie'
export const db = new Dexie('allyDeck')

db.version(1).stores(
    { cards: '++id, name, lastContacted'}
)