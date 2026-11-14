// GET /api/pass?card=<code>            ->  an Apple Wallet pass (.pkpass) for that Deq card.
// GET /api/pass?card=<code>&to=google  ->  off to Google Wallet's "Save" page for the same pass.
// A plain link (not fetch) so the phone opens it straight in its own wallet.
import { makeGooglePass, makePass, PassError } from './_pass.js'

export default async function handler(req, res) {
  try {
    const code = String(req.query.card ?? '')
    if (req.query.to === 'google') {
      const url = await makeGooglePass(code)
      res.setHeader('Cache-Control', 'private, max-age=0')
      return res.redirect(303, url)
    }
    const pass = await makePass(code)
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass')
    res.setHeader('Content-Disposition', 'attachment; filename="deq.pkpass"')
    res.setHeader('Cache-Control', 'private, max-age=0')
    res.status(200).send(pass)
  } catch (error) {
    const status = error instanceof PassError ? error.status : 500
    res.status(status).json({ error: error.message })
  }
}
