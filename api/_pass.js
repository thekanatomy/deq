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
  const { n, r, c, l, e } = JSON.parse(json)
  if (!n) throw new PassError(400, 'The card needs a name')
  return { name: n, role: r, company: c, linkedin: l, email: e }
}

export async function makePass(code) {
  const key = process.env.WALLETWALLET_API_KEY
  if (!key) throw new PassError(501, 'Set WALLETWALLET_API_KEY on the server')
  if (!code || !/^[A-Za-z0-9_-]+$/.test(code)) throw new PassError(400, 'Missing card')
  const card = decode(code)

  const back = [
    card.linkedin && { label: 'LinkedIn', value: card.linkedin },
    card.email && { label: 'Email', value: card.email },
    { label: 'About', value: 'Scan the code to add me to your deq. deq.one keeps everyone you meet as a card.' },
  ].filter(Boolean)

  const response = await fetch('https://api.walletwallet.dev/api/pkpass', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      barcodeValue: `${PUBLIC_URL}/#add=${code}`,
      barcodeFormat: 'QR',
      logoText: 'deq',
      description: `${card.name}'s deq card`,
      colorPreset: 'dark',
      primaryFields: [{ label: card.company || 'DEQ CARD', value: card.name }],
      secondaryFields: card.role ? [{ label: 'Role', value: card.role }] : [],
      backFields: back,
      expirationDays: 3650,
    }),
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error('WalletWallet error', response.status, detail.slice(0, 300))
    throw new PassError(response.status === 429 ? 429 : 502, `WalletWallet returned ${response.status}`)
  }
  return Buffer.from(await response.arrayBuffer())
}
