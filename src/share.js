// Your card as a link: everything on it travels inside the link itself, so
// there's no server to store it. deq.one/#add=… opens straight into "add this
// person", whether it's scanned by Deq or by any phone camera.

const PUBLIC_URL = import.meta.env?.VITE_PUBLIC_URL || 'https://deq.one'

function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(code) {
  const binary = atob(code.replace(/-/g, '+').replace(/_/g, '/'))
  return new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0)))
}

// short keys keep the QR code small and easy to scan
export function cardCode(me) {
  const short = { n: me.name, r: me.role, c: me.company, l: me.linkedin, e: me.email, p: me.phone }
  for (const key of Object.keys(short)) if (!short[key]) delete short[key]
  return toBase64Url(JSON.stringify(short))
}

export function cardLink(me) {
  return `${PUBLIC_URL}/#add=${cardCode(me)}`
}

// A link (or just its code) back to card fields, or null if it isn't one.
export function readCard(text) {
  const match = String(text).match(/#add=([A-Za-z0-9_-]+)/) ?? String(text).match(/^([A-Za-z0-9_-]{8,})$/)
  if (!match) return null
  try {
    const { n, r, c, l, e, p } = JSON.parse(fromBase64Url(match[1]))
    if (!n) return null
    return { name: n, role: r ?? '', company: c ?? '', linkedin: l ?? '', email: e ?? '', phone: p ?? '' }
  } catch {
    return null
  }
}
