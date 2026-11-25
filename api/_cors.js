// The iPhone app (Capacitor) loads deq from the phone, so its requests come from
// capacitor://localhost. Only that origin and deq.one itself are allowed.
const ALLOWED = new Set(['capacitor://localhost', 'https://deq.one'])

// Returns true when the request was a preflight that is now answered.
export function cors(req, res, methods = 'GET, POST') {
  const origin = req.headers.origin
  if (origin && ALLOWED.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', `${methods}, OPTIONS`)
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return true
  }
  return false
}
