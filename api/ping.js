// GET /api/ping  ->  204. deq asks this to know whether deq.one can be reached right
// now (a Wi-Fi can block it while the phone still shows a connection).
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.status(204).end()
}
