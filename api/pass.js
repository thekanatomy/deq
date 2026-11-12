// GET /api/pass?card=<code>  ->  an Apple Wallet pass (.pkpass) for that Deq card.
// A plain link (not fetch) so iPhone Safari opens it straight in "Add to Wallet".
import { makePass, PassError } from './_pass.js'

export default async function handler(req, res) {
  try {
    const pass = await makePass(String(req.query.card ?? ''))
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass')
    res.setHeader('Content-Disposition', 'attachment; filename="deq.pkpass"')
    res.setHeader('Cache-Control', 'private, max-age=0')
    res.status(200).send(pass)
  } catch (error) {
    const status = error instanceof PassError ? error.status : 500
    res.status(status).json({ error: error.message })
  }
}
