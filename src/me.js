// Your own card, kept on this phone.
const KEY = 'deq-me'

export function loadMe(owner = '') {
  try {
    return { name: owner, role: '', company: '', linkedin: '', email: '', ...JSON.parse(localStorage.getItem(KEY)) }
  } catch {
    return { name: owner, role: '', company: '', linkedin: '', email: '' }
  }
}

export function saveMe(me) {
  try {
    localStorage.setItem(KEY, JSON.stringify(me))
  } catch {
    // private mode: the card just isn't remembered next time
  }
}
