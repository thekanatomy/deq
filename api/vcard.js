// GET /api/vcard?name=…&org=…&title=…&email=…&phone=…&url=…&note=…  ->  a contact card (.vcf).
// iPhone Safari won't open a vCard made in the page (a data: link), but it does open one
// served from here: it shows the contact with "Create New Contact" ready to tap.

// vCard text escaping: backslash, comma, semicolon and line breaks
const clean = value =>
  String(value ?? '')
    .slice(0, 500)
    .replace(/\\/g, '\\\\')
    .replace(/([,;])/g, '\\$1')
    .replace(/\r?\n/g, '\\n')
    .trim()

export default function handler(req, res) {
  const q = req.query
  const name = clean(q.name)
  if (!name) return res.status(400).json({ error: 'The contact needs a name' })
  const [given, ...rest] = String(q.name).trim().split(/\s+/)
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${clean(rest.join(' '))};${clean(given)};;;`,
    `FN:${name}`,
    q.org && `ORG:${clean(q.org)}`,
    q.title && `TITLE:${clean(q.title)}`,
    q.email && `EMAIL;TYPE=INTERNET:${clean(q.email)}`,
    q.phone && `TEL;TYPE=CELL:${clean(q.phone)}`,
    q.url && `URL:${clean(q.url)}`,
    q.note && `NOTE:${clean(q.note)}`,
    'END:VCARD',
  ].filter(Boolean)
  const file = (String(q.name).replace(/[^\w\s-]/g, '').trim() || 'contact').slice(0, 60)
  res.setHeader('Content-Type', 'text/vcard; charset=utf-8')
  res.setHeader('Content-Disposition', `inline; filename="${file}.vcf"`)
  res.setHeader('Cache-Control', 'private, max-age=0')
  res.status(200).send(lines.join('\r\n') + '\r\n')
}
