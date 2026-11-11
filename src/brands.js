// Each company's card is painted from its brand colour, the way Apple Music paints
// Now Playing from the album art. Unknown companies keep the original Deq blue.

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

function toRgb(hex) {
  const value = parseInt(hex.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

// --- Apple Music style mesh -----------------------------------------------------
// Like Now Playing: four soft colours taken from the brand colour (a light tint, two
// neighbouring hues and a deep shade) floating over a dark base. The card blurs this
// layer, so it reads as one glowing surface. White text always reads on it.

const DEQ_BLUE = '#2C69B1' // companies we don't know keep Kanish's original Deq blue

function toHsl(hex) {
  const [r, g, b] = toRgb(hex).map(channel => channel / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l * 100]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s * 100, l * 100]
}

const hsl = (h, s, l) => `hsl(${Math.round((h + 360) % 360)} ${Math.round(Math.min(s, 100))}% ${Math.round(Math.max(4, Math.min(l, 90)))}%)`

export function meshColours(company) {
  const [h, s, l] = toHsl(brandColour(company) ?? DEQ_BLUE)
  return {
    light: hsl(h + 12, s * 0.95, l + 24),
    alt: hsl(h - 28, s * 0.9, l + 4),
    deep: hsl(h + 6, s * 0.85, l * 0.42),
    accent: hsl(h + 38, s * 0.75, l * 0.85),
    base: hsl(h, s * 0.7, l * 0.32),
  }
}

// Returns the CSS variables for a card (and for the page glow and zoom view behind it).
export function brandStyle(company) {
  const { light, alt, deep, accent, base } = meshColours(company)
  const mesh = [
    `radial-gradient(45% 40% at 22% 18%, ${light}, transparent 70%)`,
    `radial-gradient(55% 45% at 88% 28%, ${alt}, transparent 72%)`,
    `radial-gradient(60% 50% at 25% 85%, ${deep}, transparent 72%)`,
    `radial-gradient(50% 45% at 85% 88%, ${accent}, transparent 70%)`,
    base,
  ].join(', ')
  return {
    '--card-background': mesh,
    '--card-base': base,
    '--card-ink': '#ffffff',
    '--card-ink-soft': 'rgba(255, 255, 255, 0.66)',
    '--card-on-ink': '#1d1d1f',
    '--card-text-shadow': 'none',
  }
}
