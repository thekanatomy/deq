// Builds an Apple Wallet pass for someone's Deq card with WalletWallet
// (walletwallet.dev). The key stays on the server (WALLETWALLET_API_KEY).
// The pass's QR code is the card's deq.one link: scanned by any phone, it opens
// Deq with "add this person" ready.

const PUBLIC_URL = process.env.VITE_PUBLIC_URL || 'https://deq.one'

export class PassError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function decode(code) {
  const json = Buffer.from(code.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
  const { n, r, c, l, e, p } = JSON.parse(json)
  if (!n) throw new PassError(400, 'The card needs a name')
  return { name: n, role: r, company: c, linkedin: l, email: e, phone: p }
}

// The pass: works on every WalletWallet plan.
function passBody(card, code) {
  const back = [
    card.linkedin && { label: 'LinkedIn', value: card.linkedin },
    card.email && { label: 'Email', value: card.email },
    card.phone && { label: 'Phone', value: card.phone },
    { label: 'About deq', value: 'Scan the code to add me to your deq. deq.one keeps everyone you meet as a card.' },
  ].filter(Boolean)
  return {
    barcodeValue: `${PUBLIC_URL}/#add=${code}`,
    barcodeFormat: 'QR',
    barcodeAltText: 'Scan to add me on deq',
    logoText: 'deq',
    organizationName: 'deq',
    description: `${card.name}'s deq card`,
    colorPreset: 'blue', // deq blue, so it stands out from the black passes in Wallet
    primaryFields: [{ label: card.company || 'deq card', value: card.name }],
    secondaryFields: card.role ? [{ label: 'Role', value: card.role }] : [],
    backFields: back,
    expirationDays: 3650,
    sharingProhibited: false,
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
// Free-plan fields only, so it keeps working without a paid WalletWallet plan.
async function callWalletWallet(code, format) {
  const key = process.env.WALLETWALLET_API_KEY
  if (!key) throw new PassError(501, 'Set WALLETWALLET_API_KEY on the server')
  if (!code || !/^[A-Za-z0-9_-]+$/.test(code)) throw new PassError(400, 'Missing card')
  const card = decode(code)
  const response = await post(passBody(card, code), format, key)
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error('WalletWallet error', response.status, detail.slice(0, 300))
    throw new PassError(response.status === 429 ? 429 : 502, `WalletWallet returned ${response.status}`)
  }
  return response
}

// Apple Wallet: the signed .pkpass itself
export async function makePass(code) {
  const response = await callWalletWallet(code, 'binary')
  return Buffer.from(await response.arrayBuffer())
}

// Google Wallet: the same pass, as Google's "Save to Google Wallet" link
export async function makeGooglePass(code) {
  const response = await callWalletWallet(code, 'json')
  const { googleSaveUrl } = await response.json()
  if (!googleSaveUrl) throw new PassError(502, 'WalletWallet sent no Google Wallet link')
  return googleSaveUrl
}
