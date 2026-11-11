// The "short layer": what fits on a card, worked out once when someone is saved and
// remembered with them (roleShort, companyShort). The full role and company are kept
// too and show in the zoom view.
//
//   "MS Data Science @ ASU | Building a personal tool that works under 5 seconds"
//     -> "MS Data Science"
//   "Sri Venkateswara College of Engineering" -> "SVCE"

import { brandColour } from './brands.js'

const MAX_ROLE = 32
const MAX_COMPANY = 20
const SMALL_WORDS = new Set(['of', 'and', 'the', 'for', 'at', 'in', '&'])

function clip(text, max) {
  if (text.length <= max) return text
  return text.slice(0, max - 1).replace(/\s+\S*$/, '') + '…'
}

export function shortRole(role = '') {
  const whole = role.replace(/\s+/g, ' ').trim()
  if (whole.length <= MAX_ROLE) return whole
  // LinkedIn headlines pile things up with | • · @ " at " – —; the first part is the title
  const first = role.split(/\s*[|•·–—]\s*|\s+@\s*|\s+-\s+|\s+at\s+|,|;/i)[0] ?? ''
  return clip(first.replace(/\s+/g, ' ').trim(), MAX_ROLE)
}

export function shortCompany(company = '') {
  const clean = company
    .replace(/\b(pvt\.?|private|limited|ltd\.?|inc\.?|llc|corp\.?|corporation)\b/gi, '')
    .replace(/[\s,]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (clean.length <= MAX_COMPANY) return clean
  // a company we know with a long suffix: "Honeywell Aerospace Technologies" -> "Honeywell"
  const lead = clean.split(' ')[0]
  if (brandColour(lead)) return lead
  const words = clean.split(' ').filter(word => !SMALL_WORDS.has(word.toLowerCase()))
  // long institution names read better as initials: Arizona State University -> ASU
  if (words.length >= 3 || (words.length === 2 && /universit|college|institute|school/i.test(clean))) return words.map(word => word[0].toUpperCase()).join('')
  return clip(clean, MAX_COMPANY)
}

// What the card shows: the remembered short version, or work it out for older cards.
export const roleOf = person => person.roleShort || shortRole(person.role)
export const companyOf = person => person.companyShort || shortCompany(person.company)

// Added to every save, so the short version is remembered with the person.
export function withShortText(fields) {
  return { ...fields, roleShort: shortRole(fields.role), companyShort: shortCompany(fields.company) }
}
