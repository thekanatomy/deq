// A calendar event as an .ics file. Served from the server (not built in the
// browser) because iPhone only opens Calendar's "Add Event" for a real web
// address, including from the Home Screen app.

const escape = text => String(text).replace(/[\;,]/g, match => `\\${match}`).replace(/\r?\n/g, '\\n')
const STAMP = /^\d{8}T\d{6}$/

export function makeIcs({ title, start, end, details = '', uid }) {
  if (!title || !STAMP.test(start) || !STAMP.test(end)) throw Object.assign(new Error('Bad event'), { status: 400 })
  const now = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//deq//EN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escape(uid || `${start}-${title.length}`)}@deq.one`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escape(title.slice(0, 200))}`,
    `DESCRIPTION:${escape(details.slice(0, 1500))}`,
    'BEGIN:VALARM',
    'TRIGGER:PT0M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escape(title.slice(0, 200))}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}
