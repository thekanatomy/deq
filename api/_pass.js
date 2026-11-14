// Builds an Apple Wallet pass for someone's Deq card with WalletWallet
// (walletwallet.dev). The key stays on the server (WALLETWALLET_API_KEY).
// The pass's QR code is the card's deq.one link: scanned by any phone, it opens
// Deq with "add this person" ready.

import { brandColour } from '../src/brands.js'

const PUBLIC_URL = process.env.VITE_PUBLIC_URL || 'https://deq.one'

export class PassError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function decode(code) {
  const json = Buffer.from(code.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
  const { n, r, c, l, e } = JSON.parse(json)
  if (!n) throw new PassError(400, 'The card needs a name')
  return { name: n, role: r, company: c, linkedin: l, email: e }
}

// The pass wears the person's card colour: their company's colour from deq's brand
// list (deq blue when unknown), toned dark enough that white text reads on it.
function passColour(company) {
  const hex = brandColour(company) ?? '#2C69B1'
  const value = parseInt(hex.slice(1), 16)
  let [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map(channel => channel / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let sat = 0
  const light = (max + min) / 2
  if (max !== min) {
    const d = max - min
    sat = light > 0.5 ? d / (2 - max - min) : d / (max + min)
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    h /= 6
  }
  const l = Math.min(Math.max(light, 0.18), 0.34)
  const s2 = sat * 0.8
  const q = l < 0.5 ? l * (1 + s2) : l + s2 - l * s2
  const p = 2 * l - q
  const hue = t => {
    t = (t + 1) % 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  ;[r, g, b] = s2 === 0 ? [l, l, l] : [hue(h + 1 / 3), hue(h), hue(h - 1 / 3)]
  return '#' + [r, g, b].map(channel => Math.round(channel * 255).toString(16).padStart(2, '0')).join('').toUpperCase()
}

// their photo, as the small picture beside their name (a data URI, kept under 1 MB)
function cleanPhoto(photo) {
  if (typeof photo !== 'string') return null
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo)) return null
  return photo.length < 1_300_000 ? photo : null
}

// The plain pass: works on every WalletWallet plan.
function basicBody(card, code) {
  const back = [
    card.linkedin && { label: 'LinkedIn', value: card.linkedin },
    card.email && { label: 'Email', value: card.email },
    { label: 'About deq', value: 'Scan the code to add me to your deq. deq.one keeps everyone you meet as a card.' },
  ].filter(Boolean)
  return {
    barcodeValue: `${PUBLIC_URL}/#add=${code}`,
    barcodeFormat: 'QR',
    barcodeAltText: 'Scan to add me on deq',
    logoText: 'deq',
    organizationName: 'deq',
    description: `${card.name}'s deq card`,
    colorPreset: 'dark',
    primaryFields: [{ label: card.company || 'deq card', value: card.name }],
    secondaryFields: card.role ? [{ label: 'Role', value: card.role }] : [],
    backFields: back,
    expirationDays: 3650,
    sharingProhibited: false,
  }
}

// The full deq look: the deq logo, the card's colour and their photo (Pro features).
function fullBody(card, code, photo) {
  const { logoText: _logoText, colorPreset: _colorPreset, ...basic } = basicBody(card, code)
  const thumbnail = cleanPhoto(photo)
  return {
    ...basic,
    logoURL: `${PUBLIC_URL}/pass-logo.png`,
    wideLogoURL: `${PUBLIC_URL}/pass-wide-logo.png`,
    iconURL: `${PUBLIC_URL}/icon-192.png`,
    color: passColour(card.company),
    ...(thumbnail && { thumbnailURL: thumbnail }),
  }
}

async function post(body, format, key) {
  return fetch(`https://api.walletwallet.dev/api/passes?format=${format}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  })
}

// format 'binary' gives the Apple .pkpass; 'json' gives, among others, the Google save link.
// The full look is tried first; if the plan doesn't allow it (after the trial), the plain pass.
async function callWalletWallet(code, format, photo) {
  const key = process.env.WALLETWALLET_API_KEY
  if (!key) throw new PassError(501, 'Set WALLETWALLET_API_KEY on the server')
  if (!code || !/^[A-Za-z0-9_-]+$/.test(code)) throw new PassError(400, 'Missing card')
  const card = decode(code)
  let response = await post(fullBody(card, code, photo), format, key)
  if (response.status === 400 || response.status === 403) {
    const detail = await response.text().catch(() => '')
    console.warn('WalletWallet refused the full pass, sending the plain one', response.status, detail.slice(0, 300))
    response = await post(basicBody(card, code), format, key)
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error('WalletWallet error', response.status, detail.slice(0, 300))
    throw new PassError(response.status === 429 ? 429 : 502, `WalletWallet returned ${response.status}`)
  }
  return response
}

// Apple Wallet: the signed .pkpass itself
export async function makePass(code, photo) {
  const response = await callWalletWallet(code, 'binary', photo)
  return Buffer.from(await response.arrayBuffer())
}

// Google Wallet: the same pass, as Google's "Save to Google Wallet" link
export async function makeGooglePass(code, photo) {
  const response = await callWalletWallet(code, 'json', photo)
  const { googleSaveUrl } = await response.json()
  if (!googleSaveUrl) throw new PassError(502, 'WalletWallet sent no Google Wallet link')
  return googleSaveUrl
}
