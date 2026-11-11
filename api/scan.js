// POST /api/scan  { image: <base64 JPEG>, mimeType: 'image/jpeg' }  →  { kind, name, role, company, ... }
// Runs on Vercel as a serverless function. Files starting with "_" in /api are not routes.
import { readPhoto, VisionError } from './_vision.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Use POST' })
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    res.status(200).json(await readPhoto(body))
  } catch (error) {
    const status = error instanceof VisionError ? error.status : 500
    res.status(status).json({ error: error.message })
  }
}