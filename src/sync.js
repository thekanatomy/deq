import { createClient } from '@supabase/supabase-js'
import { useSyncExternalStore } from 'react'
import { db, onLocalChange } from './db'

// Accounts and backup, with Supabase.
// The phone is always the source you see; your account is a copy that follows it.
// Sign in on a new phone and the copy comes back down.

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Without the two settings the app still works, just without accounts.
export const supabase = url && key ? createClient(url, key) : null
export const accountsEnabled = Boolean(supabase)

const BUCKET = 'photos'
const PAGE = 500

// ---------- a tiny store the UI can watch ----------
let state = { user: null, status: 'idle', lastSynced: null } // status: idle | syncing | synced | offline | error
const watchers = new Set()
function setState(changes) {
  state = { ...state, ...changes }
  watchers.forEach(watcher => watcher())
}
export function useAccount() {
  return useSyncExternalStore(
    watcher => {
      watchers.add(watcher)
      return () => watchers.delete(watcher)
    },
    () => state,
  )
}

// ---------- signing in and out ----------
const home = () => window.location.origin

export function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: home() } })
}

// Sends the sign-in email. With Supabase's email template showing {{ .Token }} it
// carries a 6-digit code (the link still works too, for people on a laptop).
export async function sendMagicLink(email) {
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: home() } })
  if (error) throw error
}

// The code typed in the app. A code beats a link on iPhone: the link would open in
// Safari, not in the deq on your Home Screen.
export async function verifyCode(email, code) {
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
  if (error) throw error
}

// Sync whatever is left, then clear this phone so the next person starts empty.
export async function signOut() {
  await syncNow().catch(() => {})
  await supabase.auth.signOut()
  await db.cards.clear()
  for (const name of Object.keys(localStorage)) if (name.startsWith('deq-pulled-')) localStorage.removeItem(name)
}

// Removing a card: gone at once when signed out; signed in, it stays hidden until
// your account has been told, so it disappears from your other phones too.
export async function removeCard(id) {
  if (state.user) await db.cards.update(id, { deleted: 1 })
  else await db.cards.delete(id)
}

// ---------- syncing ----------
let running = null
let again = false

export function syncNow() {
  if (!state.user) return Promise.resolve()
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    setState({ status: 'syncing' })
    try {
      do {
        again = false
        await push(state.user.id)
        await pull(state.user.id)
      } while (again)
      setState({ status: 'synced', lastSynced: Date.now() })
    } catch (error) {
      console.error('Sync failed', error)
      setState({ status: navigator.onLine ? 'error' : 'offline' })
    } finally {
      running = null
    }
  })()
  return running
}

// Sends every changed card (and its photo) to your account.
async function push(userId) {
  const changed = await db.cards.where('dirty').equals(1).toArray()
  if (!changed.length) return

  const rows = []
  const done = []
  for (const card of changed) {
    const { id, dirty: _dirty, photo, deleted, ...data } = card
    let photoPath = card.photoPath ?? null
    const path = `${userId}/${card.uid}.jpg`

    if (deleted) {
      if (photoPath) await supabase.storage.from(BUCKET).remove([photoPath])
    } else if (photo instanceof Blob && !photoPath) {
      const { error } = await supabase.storage.from(BUCKET).upload(path, photo, { upsert: true, contentType: 'image/jpeg' })
      if (error) throw error
      photoPath = path
    } else if (!photo && photoPath) {
      // the photo was removed (e.g. it turned out to be a business card)
      await supabase.storage.from(BUCKET).remove([photoPath])
      photoPath = null
    }

    rows.push({
      id: card.uid,
      user_id: userId,
      data: { ...data, photoPath },
      updated_at: new Date(card.updatedAt).toISOString(),
      deleted: Boolean(deleted),
    })
    done.push({ id, updatedAt: card.updatedAt, photoPath, deleted })
  }

  const { error } = await supabase.from('cards').upsert(rows)
  if (error) throw error

  // Mark them synced, unless they were edited again while this was sending.
  await db.transaction('rw', db.cards, async () => {
    for (const item of done) {
      const card = await db.cards.get(item.id)
      if (!card || card.updatedAt !== item.updatedAt) continue
      if (item.deleted) await db.cards.delete(item.id)
      else await db.cards.update(item.id, { dirty: 0, photoPath: item.photoPath })
    }
  })
}

// Brings down everything that changed in your account since the last time.
async function pull(userId) {
  const mark = `deq-pulled-${userId}`
  let since = localStorage.getItem(mark) ?? '1970-01-01T00:00:00Z'

  for (;;) {
    const { data: rows, error } = await supabase
      .from('cards')
      .select('id, data, updated_at, deleted, synced_at')
      .gt('synced_at', since)
      .order('synced_at')
      .limit(PAGE)
    if (error) throw error
    if (!rows.length) break

    for (const row of rows) await apply(row)
    since = rows.at(-1).synced_at
    localStorage.setItem(mark, since)
    if (rows.length < PAGE) break
  }
}

async function apply(row) {
  const local = await db.cards.where('uid').equals(row.id).first()
  const remoteTime = Date.parse(row.updated_at)
  if (local && local.updatedAt >= remoteTime) return // this phone has the newer version

  if (row.deleted) {
    if (local) await db.cards.delete(local.id)
    return
  }

  const { photoPath = null, ...data } = row.data
  let photo = local?.photoPath === photoPath ? local?.photo : undefined
  if (photoPath && !photo) {
    const { data: blob } = await supabase.storage.from(BUCKET).download(photoPath)
    photo = blob ?? undefined
  }

  const card = { ...data, uid: row.id, photoPath, photo, updatedAt: remoteTime, dirty: 0, deleted: 0 }
  if (local) await db.cards.update(local.id, card)
  else await db.cards.add(card)
}

// ---------- when to sync ----------
let timer
function soon() {
  clearTimeout(timer)
  timer = setTimeout(syncNow, 1200)
}

if (supabase) {
  supabase.auth.onAuthStateChange((_event, session) => {
    const user = session?.user ?? null
    const changed = user?.id !== state.user?.id
    setState({ user, status: user ? state.status : 'idle' })
    if (user && changed) setTimeout(syncNow) // outside the auth callback, as Supabase advises
  })
  onLocalChange(soon)
  window.addEventListener('online', soon)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && soon())
}
