import { companyOf } from './text'

const DAY = 24 * 60 * 60 * 1000

// The ways to look at your deq. Companies come from the people in it, biggest first.
export function filtersFor(people) {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const filters = [
    { id: 'all', name: 'Everyone', count: people.length },
    {
      id: 'quiet',
      name: 'Gone quiet',
      hint: 'Not spoken in a month',
      label: 'Gone quiet',
      test: person => Date.now() - person.lastContacted > 30 * DAY,
    },
    {
      id: 'month',
      name: 'Met this month',
      label: now.toLocaleDateString('en-GB', { month: 'long' }),
      test: person => (person.metAt ?? person.lastContacted) >= monthStart,
    },
  ]
  const companies = new Map()
  for (const person of people) {
    const company = companyOf(person)
    if (company) companies.set(company, (companies.get(company) ?? 0) + 1)
  }
  const byCompany = [...companies]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([company]) => ({
      id: `company:${company}`,
      name: company,
      label: company,
      group: 'company',
      test: person => companyOf(person) === company,
    }))
  return [...filters, ...byCompany].map(filter => ({
    ...filter,
    count: filter.test ? people.filter(filter.test).length : filter.count,
  }))
}
