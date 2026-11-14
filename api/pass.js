// GET or POST /api/pass?card=<code>            ->  an Apple Wallet pass (.pkpass) for that Deq card.
// GET or POST /api/pass?card=<code>&to=google  ->  off to Google Wallet's "Save" page for the same pass.
// My Card POSTs a form (card + photo) so the photo fits; still a navigation, not a fetch,
// so the phone opens the result straight in its own wallet.
import { makeGooglePass, makePass, PassError } from './_pass.js'

export default async function handler(req, res) {
  try {
    const form = req.method === 'POST' && req.body && typeof req.body === 'object' ? req.body : {}
    const code = String(form.card ?? req.query.card ?? '')
    const photo = form.photo
    if ((form.to ?? req.query.to) === 'google') {
      const url = await makeGooglePass(code, photo)
      res.setHeader('Cache-Control', 'private, max-age=0')
      return res.redirect(303, url)
    }
    const pass = await makePass(code, photo)
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass')
    res.setHeader('Content-Disposition', 'attachment; filename="deq.pkpass"')
    res.setHeader('Cache-Control', 'private, max-age=0')
    res.status(200).send(pass)
  } catch (error) {
    const status = error instanceof PassError ? error.status : 500
    res.status(status).json({ error: error.message })
  }
}
