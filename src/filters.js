import { companyOf, roleOf } from './text'

// The kind of role, so "Senior Product Analyst" and "Product Analyst" sit together
// and every kind of student is just "Student".
const SENIORITY = /\b(senior|sr\.?|junior|jr\.?|associate|assoc\.?|lead|principal|staff|head of|i{1,3}|iv)\b/gi
const STUDENT = /\b(student|undergrad|undergraduate|grad|graduate|ms|m\.s\.|mba|phd|ph\.d\.?|b\.?tech|bachelor'?s?|master'?s?|freshman|sophomore|junior year|senior year)\b/i

export function roleKind(person) {
  const role = roleOf(person)
  if (!role) return ''
  if (STUDENT.test(role)) return 'Student'
  const kind = role.replace(SENIORITY, ' ').replace(/[^\p{L}\p{N}&/ ]+/gu, ' ').replace(/\s+/g, ' ').trim()
  return kind.replace(/\b\p{Ll}/gu, letter => letter.toUpperCase())
}

// Groups that hold at least one person, biggest first.
function groupBy(people, keyOf, group) {
  const counts = new Map()
  for (const person of people) {
    const key = keyOf(person)
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, count]) => ({
      id: `${group}:${key}`,
      name: key,
      label: key,
      group,
      count,
      test: person => keyOf(person) === key,
    }))
}

// Where you met, without the city: "Memorial Union, Tempe" -> "Memorial Union"
export const placeOf = person => (person.place ?? '').split(',')[0].trim()

// The groups inside Categories, each opening its own list.
export const GROUPS = [
  { id: 'company', name: 'Companies' },
  { id: 'role', name: 'Roles' },
  { id: 'place', name: 'Where You Met' },
]

// The ways to look at your deq: everyone, then by company, role and place.
export function filtersFor(people) {
  return [
    { id: 'all', name: 'Everyone', count: people.length },
    ...groupBy(people, companyOf, 'company'),
    ...groupBy(people, roleKind, 'role'),
    ...groupBy(people, placeOf, 'place'),
  ]
}
