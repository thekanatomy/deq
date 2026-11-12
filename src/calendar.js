// Follow-up reminders in the calendar people already use. No sign-in, no API key:
// Apple Calendar gets an .ics event from /api/ics, Android gets an intent that opens
// its calendar app on a filled-in event, and Google Calendar gets its new-event page.
import { isAndroid } from './browser'

const DAY = 24 * 60 * 60 * 1000
const pad = n => String(n).padStart(2, '0')
// calendar time, in your own time zone: 20261119T100000
export const stamp = date =>
  `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`

function linkedinUrl(value) {
  const path = value.trim().match(/linkedin\.com\/((?:in|company)\/[^/?#\s]+)/i)
  return path ? `https://www.linkedin.com/${path[1]}` : `https://www.linkedin.com/in/${value.trim().replace(/^@/, '')}`
}

// When to reach out: their follow-up date (or a week out), never sooner than tomorrow, at 10:00, 15 minutes.
export function followUpWindow(person) {
  const from = person.lastContacted ?? Date.now()
  const base = person.followUpDays ? from + person.followUpDays * DAY : Date.now() + 7 * DAY
  const start = new Date(Math.max(base, Date.now() + DAY))
  start.setHours(10, 0, 0, 0)
  return { start, end: new Date(start.getTime() + 15 * 60 * 1000) }
}

function event(person) {
  const { start, end } = followUpWindow(person)
  const details = [
    person.note && `Stood out: ${person.note}`,
    person.place && `Met at ${person.place}`,
    person.linkedin && `LinkedIn: ${linkedinUrl(person.linkedin)}`,
    person.email && `Email: ${person.email}`,
    'From deq.one',
  ]
    .filter(Boolean)
    .join('\n')
  return { title: `Follow up with ${person.name}`, start, end, details }
}

export function googleCalendarUrl(person) {
  const { title, start, end, details } = event(person)
  const params = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${stamp(start)}/${stamp(end)}`, details })
  return `https://calendar.google.com/calendar/render?${params}`
}

function appleCalendar(person) {
  const { title, start, end, details } = event(person)
  const params = new URLSearchParams({ title, start: stamp(start), end: stamp(end), details, uid: `${person.id}-${start.getTime()}` })
  window.location.href = `/api/ics?${params}`
}

function androidCalendar(person, app) {
  const { title, start, end, details } = event(person)
  const extras = [
    'action=android.intent.action.INSERT',
    'type=vnd.android.cursor.item/event',
    app && `package=${app}`,
    `S.title=${encodeURIComponent(title)}`,
    `S.description=${encodeURIComponent(details)}`,
    `l.beginTime=${start.getTime()}`,
    `l.endTime=${end.getTime()}`,
    `S.browser_fallback_url=${encodeURIComponent(googleCalendarUrl(person))}`,
  ].filter(Boolean)
  window.location.href = `intent:#Intent;${extras.join(';')};end`
}

// The calendars to offer on this phone.
export const CALENDARS = isAndroid
  ? [
      { id: 'google', label: 'Google Calendar', short: 'Google Calendar' },
      { id: 'other', label: 'Other calendar app', short: 'Other app' },
    ]
  : [
      { id: 'apple', label: 'Apple Calendar', short: 'Apple' },
      { id: 'google', label: 'Google Calendar', short: 'Google' },
    ]

export function openReminder(person, calendar) {
  if (calendar === 'apple') return appleCalendar(person)
  if (calendar === 'other') return androidCalendar(person, null)
  if (isAndroid) return androidCalendar(person, 'com.google.android.calendar')
  // iPhone: a new tab keeps deq where it was
  const tab = window.open(googleCalendarUrl(person), '_blank', 'noopener')
  if (!tab) window.location.href = googleCalendarUrl(person)
}
