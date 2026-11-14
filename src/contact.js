// Saving someone to the phone's Contacts. The vCard comes from /api/vcard because
// iPhone Safari refuses one built in the page; served from deq.one it opens the
// contact with "Create New Contact" ready to tap (Android offers to save it too).
export function saveContact({ name, company, role, email, phone, linkedin }, note) {
  const params = new URLSearchParams()
  const add = (key, value) => value && String(value).trim() && params.set(key, String(value).trim())
  add('name', name)
  add('org', company)
  add('title', role)
  add('email', email)
  add('phone', phone)
  add('url', linkedin && linkedinUrl(linkedin))
  add('note', note)
  window.location.href = `/api/vcard?${params}`
}

export function linkedinUrl(value) {
  const path = value.trim().match(/linkedin\.com\/((?:in|company)\/[^/?#\s]+)/i)
  return path ? `https://www.linkedin.com/${path[1]}` : `https://www.linkedin.com/in/${value.trim().replace(/^@/, '')}`
}
