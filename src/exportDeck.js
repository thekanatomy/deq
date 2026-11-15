// Menu → Export Deck: everyone in your deq as a CSV that Excel, Numbers and Google
// Sheets open directly. Made on the phone; nothing is sent anywhere.
import { db, visible } from './db'

const COLUMNS = [
  ['Name', card => card.name],
  ['Role', card => card.role],
  ['Company', card => card.company],
  ['Email', card => card.email],
  ['Phone', card => card.phone],
  ['LinkedIn', card => card.linkedin],
  ['Met at', card => card.place],
  ['Met on', card => day(card.metAt)],
  ['Last contacted', card => day(card.lastContacted)],
  ['Notes', card => card.note],
  ['Tags', card => (Array.isArray(card.tags) ? card.tags.join(', ') : '')],
]

const day = time => (time ? new Date(time).toISOString().slice(0, 10) : '')

// quotes around every value; a leading = or @ (or + - not starting a number) is defused
// so a cell can't run as a formula, while phone numbers like +1 480… stay as they are
const cell = value => {
  const text = String(value ?? '').replace(/^(=|@|[+-](?![\d\s(]))/, "'$1")
  return `"${text.replace(/"/g, '""')}"`
}

export async function exportDeck() {
  const cards = (await db.cards.toArray()).filter(visible).sort((a, b) => (b.metAt ?? 0) - (a.metAt ?? 0))
  const rows = [COLUMNS.map(([title]) => cell(title)), ...cards.map(card => COLUMNS.map(([, read]) => cell(read(card))))]
  const csv = '﻿' + rows.map(row => row.join(',')).join('\r\n') // the BOM makes Excel read names in any language
  const file = new File([csv], `deq-${day(Date.now())}.csv`, { type: 'text/csv' })

  // iPhone: the share sheet (Save to Files, Mail, AirDrop). Elsewhere: a download.
  if (navigator.canShare?.({ files: [file] })) {
    try {
      return await navigator.share({ files: [file], title: 'Your deq' })
    } catch (error) {
      if (error?.name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(file)
  const link = Object.assign(document.createElement('a'), { href: url, download: file.name })
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
