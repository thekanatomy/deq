// Turns whatever a QR code contains into card fields.
// Handles LinkedIn profile QR codes, vCards (most business-card QR codes),
// MECARDs and plain email links. Anything else comes back empty.

function titleCase(word) {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

// linkedin.com/in/kanish-goudam-1a2b3c4d  ->  "Kanish Goudam"
function nameFromSlug(slug) {
  return decodeURIComponent(slug)
    .split('-')
    .filter(part => part && !/\d/.test(part))
    .map(titleCase)
    .join(' ')
}

function parseLinkedIn(text) {
  const match = text.match(/linkedin\.com\/in\/([^/?#\s]+)/i)
  if (!match) return null
  const slug = match[1]
  return { linkedin: `https://www.linkedin.com/in/${slug}`, name: nameFromSlug(slug) }
}

function parseVCard(text) {
  const lines = text.replace(/\r\n[ \t]/g, '').split(/\r?\n/)
  const card = {}
  for (const line of lines) {
    const colon = line.indexOf(':')
    if (colon < 0) continue
    const key = line.slice(0, colon).split(';')[0].toUpperCase()
    const value = line.slice(colon + 1).trim()
    if (key === 'FN') card.name = value
    if (key === 'N' && !card.name) card.name = value.split(';').reverse().filter(Boolean).join(' ')
    if (key === 'TITLE') card.role = value
    if (key === 'ORG') card.company = value.split(';')[0]
    if (key === 'EMAIL' && !card.email) card.email = value
    if (key === 'URL' && /linkedin\.com/i.test(value)) card.linkedin = parseLinkedIn(value)?.linkedin
  }
  return card
}

function parseMeCard(text) {
  const card = {}
  for (const part of text.slice(7).split(';')) {
    const [key, ...rest] = part.split(':')
    const value = rest.join(':')
    if (key === 'N') card.name = value.split(',').reverse().join(' ').trim()
    if (key === 'EMAIL') card.email = value
    if (key === 'ORG') card.company = value
    if (key === 'TITLE') card.role = value
    if (key === 'URL' && /linkedin\.com/i.test(value)) card.linkedin = parseLinkedIn(value)?.linkedin
  }
  return card
}

export function parseScan(text) {
  const trimmed = text.trim()
  if (/^BEGIN:VCARD/i.test(trimmed)) return parseVCard(trimmed)
  if (/^MECARD:/i.test(trimmed)) return parseMeCard(trimmed)
  if (/^mailto:/i.test(trimmed)) return { email: trimmed.slice(7).split('?')[0] }
  return parseLinkedIn(trimmed) ?? {}
}