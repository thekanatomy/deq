// What's happened between you and a person, kept on their card as a short list,
// so the detail view can show a timeline: met, then each time you spoke.
const DAY = 24 * 60 * 60 * 1000
const KEEP = 30 // plenty for a timeline, small enough to sync

// The changes to save when you've just been in touch.
export function spokeNow(person, channel) {
  const at = Date.now()
  const history = [...(person.history ?? []), { type: 'spoke', at, channel }].slice(-KEEP)
  return { lastContacted: at, lastChannel: channel, history }
}

// The timeline to show, oldest first. Cards made before history existed still get
// something sensible: when you met, and the last time you spoke.
export function timelineOf(person) {
  const met = person.metAt ?? person.lastContacted
  const events = [{ type: 'met', at: met, place: person.place }]
  const spoken = (person.history ?? []).filter(entry => entry.type === 'spoke')
  if (spoken.length) events.push(...spoken)
  else if (person.lastContacted - met > 60 * 60 * 1000) events.push({ type: 'spoke', at: person.lastContacted, channel: person.lastChannel })
  return events.sort((a, b) => a.at - b.at)
}

// "Also from Chennai, loves F1" -> ["Also from Chennai", "Loves F1"]
export function talkingPoints(note = '') {
  return note
    .split(/[,\n;•]+/)
    .map(part => part.replace(/[.…]+$/, '').trim())
    .filter(Boolean)
    .map(part => part[0].toUpperCase() + part.slice(1))
    .slice(0, 6)
}

// When to reach out, in a few words: "Reach out Tue · in 6 days", "Reach out now · 11 days late".
export function nextStep(person, days = Math.floor((Date.now() - person.lastContacted) / DAY)) {
  if (!person.followUpDays) {
    return { label: days === 0 ? 'Spoke today' : `Spoke ${days} ${days === 1 ? 'day' : 'days'} ago`, detail: '', late: false, soon: false }
  }
  const due = person.lastContacted + person.followUpDays * DAY
  const left = Math.ceil((due - Date.now()) / DAY)
  if (left < 0) return { label: 'Reach out now', detail: `${-left} ${left === -1 ? 'day' : 'days'} late`, late: true, soon: false, due, left }
  if (left === 0) return { label: 'Reach out today', detail: '', late: false, soon: true, due, left }
  const day = new Date(due).toLocaleDateString('en-GB', left < 7 ? { weekday: 'short' } : { day: 'numeric', month: 'short' })
  return { label: `Reach out ${day}`, detail: `in ${left} ${left === 1 ? 'day' : 'days'}`, late: false, soon: left <= 2, due, left }
}
