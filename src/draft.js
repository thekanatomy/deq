// The person you're adding, kept on the phone while you add them. iPhone and Android
// often close a Home Screen app that's in the background, and deq reloads for updates,
// so without this a lock screen or a quick reply to a text would lose everything typed.
const KEY = 'deq-add-draft'
const KEEP = 24 * 60 * 60 * 1000 // a day old and it's stale

export function saveDraft(fields, open) {
  try {
    // a photo is a Blob, which this storage can't hold: the words are what matters
    const { scanImage: _scanImage, photo, ...rest } = fields
    const kept = typeof photo === 'string' ? { ...rest, photo } : rest
    localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), open, fields: kept }))
  } catch {
    // full or private mode: the photo is the big part, keep the words at least
    try {
      const { scanImage: _scanImage, photo: _photo, ...kept } = fields
      localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), open, fields: kept }))
    } catch {
      // nothing kept
    }
  }
}

export function readDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (!saved || Date.now() - saved.at > KEEP) return null
    return { ...saved.fields, _restored: saved.open ?? 'who' }
  } catch {
    return null
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // nothing to clear
  }
}

// while someone is half-added, an update waits
export const busy = { adding: false }
