// deq pulse, on the phone: run a sweep for one card, keep its history, and diff.
// The card stores:
//   pulse.history – every sweep, newest first: { at, isNews, headline }
//   pulse.latest  – the last sweep's full result (the snapshot the next one diffs against)
//   pulse.news    – the open reason to reach out, until you mark it done
import { db } from './db'

const DAY = 24 * 60 * 60 * 1000
const YOU_KEY = 'deq-you'

export function readYou() {
  try {
    return localStorage.getItem(YOU_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveYou(text) {
  try {
    localStorage.setItem(YOU_KEY, text)
  } catch {
    // private mode: kept for this visit only
  }
}

// What they told you: the card's own notes are the "hook" the agent searches against.
function hookOf(person) {
  const vibes = Array.isArray(person.tags) ? person.tags.join(', ') : ''
  return [person.note, person.next && `Next time: ${person.next}`, vibes].filter(Boolean).join('. ')
}

const isoDay = time => new Date(time).toISOString().slice(0, 10)

// The first sweep looks back 30 days before you met (that's the baseline);
// every sweep after that looks only at what's new since the last one.
function sinceFor(person) {
  const last = person.pulse?.latest?.checkedAt
  if (last) return isoDay(Date.parse(last))
  const met = person.metAt ?? person.lastContacted ?? Date.now()
  return isoDay(met - 30 * DAY)
}

export async function sweepCard(person) {
  const response = await fetch('/api/pulse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      card: { name: person.name, role: person.role, company: person.company, hook: hookOf(person), place: person.place },
      since: sinceFor(person),
      you: readYou(),
    }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'The check didn’t go through')

  const fresh = await db.cards.get(person.id)
  const history = [
    { at: result.checkedAt, isNews: result.isNews, headline: result.isNews ? result.headline : '' },
    ...(fresh?.pulse?.history ?? []),
  ].slice(0, 30)
  const news = result.isNews ? result : (fresh?.pulse?.news ?? null) // an open reason stays until you act on it
  await db.cards.update(person.id, { pulse: { history, latest: result, news } })
  return result
}

// You reached out: the reason is used up, the watch goes on.
export async function markReachedOut(person) {
  const fresh = await db.cards.get(person.id)
  await db.cards.update(person.id, { pulse: { ...(fresh?.pulse ?? {}), news: null }, lastContacted: Date.now() })
}

export const hasPulse = person => Boolean(person?.pulse?.news)

export const KIND_LABEL = {
  role_change: 'New role',
  opening: 'Role opened',
  company_news: 'Company news',
  published: 'Published',
}
