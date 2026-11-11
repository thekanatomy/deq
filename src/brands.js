// Each company's card is painted like its own Wallet pass: a soft white glow in the
// top-left corner flowing into the brand's main colour. Text is white or near-black,
// whichever reads better on that colour (Apple Wallet lets each pass choose too).
// Unknown companies keep Kanish's original blue Deq gradient.

const BRANDS = {
  // employers
  walmart: '#0071CE',
  amazon: '#FF9900',
  google: '#4285F4',
  microsoft: '#0078D4',
  apple: '#1D1D1F',
  meta: '#0866FF',
  intel: '#0071C5',
  honeywell: '#DC1E35',
  nvidia: '#76B900',
  ibm: '#0F62FE',
  deloitte: '#86BC25',
  tesla: '#E82127',
  netflix: '#E50914',
  adobe: '#FA0F00',
  salesforce: '#00A1E0',
  oracle: '#C74634',
  accenture: '#A100FF',
  uber: '#000000',
  airbnb: '#FF5A5F',
  spotify: '#1DB954',
  linkedin: '#0A66C2',
  starbucks: '#00704A',
  target: '#CC0000',
  costco: '#E31837',
  boeing: '#0033A1',
  intuit: '#236CFF',
  paypal: '#003087',
  visa: '#1A1F71',
  cisco: '#049FD9',
  dell: '#007DB8',
  hp: '#0096D6',
  qualcomm: '#3253DC',
  samsung: '#1428A0',
  disney: '#113CCF',
  chase: '#117ACA',
  'bank of america': '#E31837',
  'wells fargo': '#D71E28',
  'capital one': '#004977',
  'american express': '#2E77BC',
  infosys: '#007CC3',
  zoho: '#E42527',
  // universities
  asu: '#8C1D40',
  'arizona state university': '#8C1D40',
  'university of arizona': '#AB0520',
  'northern arizona university': '#003466',
  stanford: '#8C1515',
  mit: '#A31F34',
  harvard: '#A51C30',
  berkeley: '#003262',
  ucla: '#2774AE',
}

const ALIASES = {
  'amazon web services': 'amazon',
  aws: 'amazon',
  'alphabet': 'google',
  'meta platforms': 'meta',
  facebook: 'meta',
  'jpmorgan chase': 'chase',
  'jp morgan': 'chase',
  amex: 'american express',
  'arizona state': 'asu',
  'hewlett packard': 'hp',
}

function normalise(company) {
  return company
    .toLowerCase()
    .replace(/[.,&']/g, ' ')
    .replace(/\b(inc|llc|ltd|corp|corporation|company|co)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function brandColour(company = '') {
  const name = normalise(company)
  if (!name) return null
  const key = ALIASES[name] ?? name
  if (BRANDS[key]) return BRANDS[key]
  // "Walmart Global Tech" -> walmart
  const first = Object.keys(BRANDS).find(brand => name.startsWith(brand + ' '))
  return first ? BRANDS[first] : null
}

// --- colour maths for picking legible text --------------------------------------

function toRgb(hex) {
  const value = parseInt(hex.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function luminance([r, g, b]) {
  const channel = c => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

function mix(a, b, amount) {
  return a.map((channel, i) => Math.round(channel + (b[i] - channel) * amount))
}

function shade(rgb, amount) {
  return amount >= 0 ? mix(rgb, [255, 255, 255], amount) : mix(rgb, [0, 0, 0], -amount)
}

const css = ([r, g, b], alpha = 1) => `rgba(${r}, ${g}, ${b}, ${alpha})`

const WHITE = [255, 255, 255]
const INK = [29, 29, 31] // Apple's near-black

// Returns the CSS for a brand card, or null to use the default Deq gradient.
export function brandStyle(company) {
  const hex = brandColour(company)
  if (!hex) return null
  const base = toRgb(hex)

  // White text whenever the brand colour allows it (most passes in Wallet use white);
  // near-black only for light brands like Amazon orange or Nvidia green.
  const ink = contrast(WHITE, base) >= 4.5 ? WHITE : INK
  const top = ink === WHITE ? base : shade(base, 0.12)
  const bottom = shade(base, -0.2)

  // The brightest white glow that still keeps text at 4.5:1 where the glow is strongest.
  let glow = 0.55
  while (glow > 0 && contrast(ink, mix(top, WHITE, glow * 0.6)) < 4.5) glow -= 0.05
  glow = Math.max(0, Math.round(glow * 100) / 100)

  return {
    '--card-background': [
      `radial-gradient(90% 58% at 18% 0%, ${css(WHITE, glow)} 0%, ${css(WHITE, 0)} 100%)`,
      `linear-gradient(170deg, ${css(top)} 0%, ${css(base)} 50%, ${css(bottom)} 100%)`,
    ].join(', '),
    '--card-ink': css(ink),
    '--card-ink-soft': css(ink, 0.25),
    '--card-on-ink': ink === WHITE ? '#1d1d1f' : '#ffffff',
    '--card-text-shadow': ink === WHITE ? '0 0.5px 1px rgba(0, 0, 0, 0.12)' : 'none',
  }
}