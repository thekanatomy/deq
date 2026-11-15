// POST /api/pulse  { card: {name, role, company, hook, place}, since, you }  →  sweep result
import { PulseError, sweep } from './_pulse.js'

export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Use POST' })
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    res.status(200).json(await sweep(body))
  } catch (error) {
    res.status(error instanceof PulseError ? error.status : 500).json({ error: error.message })
  }
}
