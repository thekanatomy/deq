// GET /api/ics?title=…&start=20261119T100000&end=…&details=…  ->  an .ics event
import { makeIcs } from './_ics.js'

export default function handler(req, res) {
  try {
    const ics = makeIcs(req.query)
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
    res.setHeader('Content-Disposition', 'inline; filename="follow-up.ics"')
    res.status(200).send(ics)
  } catch (error) {
    res.status(error.status ?? 500).json({ error: error.message })
  }
}
