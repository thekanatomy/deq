import { db, visible } from './db'

// Moving your deq from Safari to the Home Screen app on iPhone.
// iOS gives a Home Screen web app its own storage, walled off from Safari, so the
// cards can't follow by themselves. Instead Safari copies them to the clipboard
// (when you tap Install) and the Home Screen app pastes them in, once, with one tap.
// No account, nothing sent anywhere: the clipboard is the only bridge.

const PREFIX = 'deq-move:'
const PHOTO_SIZE = 256 // photos travel small; plenty for the round avatar

// ---------- out of Safari ----------

// Copies every card to the clipboard. Call it straight from a tap: Safari only lets
// a page write the clipboard during the tap, so the text is handed over as a promise
// and filled in a moment later.
export function copyDeck() {
  const text = packDeck()
  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    const item = new ClipboardItem({ 'text/plain': text.then(value => new Blob([value], { type: 'text/plain' })) })
    return navigator.clipboard.write([item]).then(() => true)
  }
  return text.then(value => navigator.clipboard.writeText(value)).then(() => true)
}

async function packDeck() {
  const cards = await db.cards.filter(visible).toArray()
  const out = []
  for (const card of cards) {
    const { id: _id, dirty: _dirty, deleted: _deleted, photoPath: _photoPath, photo, ...rest } = card
    const packed = { ...rest }
    if (photo instanceof Blob) packed.photo = await smallPhotoData(photo).catch(() => undefined)
    out.push(packed)
  }
  const json = JSON.stringify({ v: 1, cards: out })
  // squeeze it when the browser can (iOS 16.4+), so a big deq still fits comfortably
  if (typeof CompressionStream !== 'undefined') {
    const zipped = await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()
    return `${PREFIX}z:${toBase64(new Uint8Array(zipped))}`
  }
  return `${PREFIX}j:${toBase64(new TextEncoder().encode(json))}`
}

// ---------- into the Home Screen app ----------

// Reads the clipboard and adds the cards that aren't here yet.
// Resolves to how many people were added; 0 means the clipboard had no deq in it.
export async function pasteDeck() {
  const text = (await navigator.clipboard.readText()).trim()
  if (!text.startsWith(PREFIX)) return 0
  const [kind, body] = [text.slice(PREFIX.length, PREFIX.length + 1), text.slice(PREFIX.length + 2)]
  const bytes = fromBase64(body)
  const json =
    kind === 'z'
      ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
      : new TextDecoder().decode(bytes)
  const { cards = [] } = JSON.parse(json)

  const have = new Set((await db.cards.toArray()).map(card => card.uid))
  const fresh = []
  for (const card of cards) {
    if (!card || typeof card.name !== 'string' || (card.uid && have.has(card.uid))) continue
    const { photo, ...rest } = card
    fresh.push({ ...rest, ...(photo ? { photo: await dataToBlob(photo) } : {}) })
  }
  if (fresh.length) await db.cards.bulkAdd(fresh)
  if (fresh.length) carryDone()
  return fresh.length
}

// ---------- helpers ----------

async function smallPhotoData(blob) {
  const bitmap = await createImageBitmap(blob)
  const scale = Math.min(1, PHOTO_SIZE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.8)
}

const dataToBlob = url => fetch(url).then(response => response.blob())

function toBase64(bytes) {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

function fromBase64(text) {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

// ---------- only for people who actually have something to bring ----------
// The Home Screen app can't see Safari, so Safari marks the address it gets saved
// with: while this Safari deq has people, the page sits at /?carry=1 and the
// manifest starts there too. The Home Screen app opens at that address, remembers
// it, and only then offers "Bring over". Someone new, installing with an empty
// deck, never sees the button.
const CARRY = 'deq-carry'
let manifestJson = null

export async function markForCarry(carry) {
  const url = new URL(window.location.href)
  if (carry) url.searchParams.set('carry', '1')
  else url.searchParams.delete('carry')
  if (url.href !== window.location.href) history.replaceState(history.state, '', url)

  // iOS may use the manifest's start_url instead of the page address: point it at the same place
  const link = document.querySelector('link[rel="manifest"]')
  if (!link) return
  try {
    manifestJson ??= await fetch('/manifest.webmanifest').then(response => response.json())
    const start = new URL(carry ? '/?carry=1' : '/', window.location.origin).href
    const blob = new Blob([JSON.stringify({ ...manifestJson, start_url: start, scope: window.location.origin + '/' })], {
      type: 'application/manifest+json',
    })
    const old = link.href
    link.href = URL.createObjectURL(blob)
    if (old.startsWith('blob:')) URL.revokeObjectURL(old)
  } catch {
    // the page address still carries the mark
  }
}

// In the Home Screen app: did it come from a Safari deq with people in it?
export function cameToCarry() {
  try {
    const url = new URL(window.location.href)
    if (url.searchParams.get('carry') === '1') {
      localStorage.setItem(CARRY, '1')
      url.searchParams.delete('carry')
      history.replaceState(history.state, '', url)
    }
    return localStorage.getItem(CARRY) === '1'
  } catch {
    return false
  }
}

export function carryDone() {
  try {
    localStorage.removeItem(CARRY)
  } catch {
    // nothing to forget
  }
}
