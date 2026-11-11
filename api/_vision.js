// Reads one photo with a vision AI and returns the details of the person in it.
// Shared by the Vercel function (api/scan.js) and the local dev server (vite.config.js).
// The API key only ever lives here on the server, never in the phone's code.
//
// Uses Groq when GROQ_API_KEY is set (free, no card, doesn't train on your photos),
// otherwise Gemini when GEMINI_API_KEY is set.

const GROQ_MODEL = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b'
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'

const PROMPT = `You help someone save a person they just met at an event.
Look at the photo. It may be a business card, a conference badge, a LinkedIn or other profile on a screen, a name tag, a slide, or just the person's face.
Fill in only what you can actually read in the photo. Never guess or invent anything; leave a field as an empty string if it is not visible.
kind: "card" for a business card, "badge" for a badge or name tag, "screen" for a phone or laptop screen, "person" if it is mainly a photo of a person, "other" otherwise.
name: the person's full name, in normal capitalisation (not ALL CAPS).
role: their job title or what they study, short (at most 4 words, e.g. "Product Designer", "MS Computer Science student"), never a whole headline. company: their company, university or organisation, as people say it ("ASU" is fine for Arizona State University).
linkedin: a full https://www.linkedin.com/in/... link if a LinkedIn handle or URL is visible.
email, phone, website: exactly as printed.
Reply with only a JSON object with exactly these keys: kind, name, role, company, email, phone, linkedin, website.`

const SCHEMA = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['card', 'badge', 'screen', 'person', 'other'] },
    name: { type: 'string' },
    role: { type: 'string' },
    company: { type: 'string' },
    email: { type: 'string' },
    phone: { type: 'string' },
    linkedin: { type: 'string' },
    website: { type: 'string' },
  },
  required: ['kind', 'name', 'role', 'company', 'email', 'phone', 'linkedin', 'website'],
}

const FIELDS = ['name', 'role', 'company', 'email', 'phone', 'linkedin', 'website']
const MAX_BASE64 = 4_000_000 // Vercel accepts request bodies up to 4.5 MB

export class VisionError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export async function readPhoto({ image, mimeType = 'image/jpeg' } = {}) {
  const groqKey = process.env.GROQ_API_KEY
  const geminiKey = process.env.GEMINI_API_KEY
  if (!groqKey && !geminiKey) throw new VisionError(501, 'Set GROQ_API_KEY (or GEMINI_API_KEY) on the server')
  if (typeof image !== 'string' || !image) throw new VisionError(400, 'Send the photo as base64 in "image"')
  if (image.length > MAX_BASE64) throw new VisionError(413, 'Photo is too large')
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(mimeType)) throw new VisionError(400, 'Unsupported image type')

  const text = groqKey ? await askGroq(image, mimeType, groqKey) : await askGemini(image, mimeType, geminiKey)
  let parsed
  try {
    parsed = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''))
  } catch {
    throw new VisionError(502, 'The AI did not return JSON')
  }
  return clean(parsed)
}

async function call(name, url, headers, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error(`${name} error`, response.status, detail.slice(0, 500))
    throw new VisionError(502, `${name} returned ${response.status}`)
  }
  return response.json()
}

async function askGroq(image, mimeType, apiKey) {
  const data = await call('Groq', 'https://api.groq.com/openai/v1/chat/completions', { Authorization: `Bearer ${apiKey}` }, {
    model: GROQ_MODEL,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: PROMPT },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${image}` } },
        ],
      },
    ],
  })
  return data.choices?.[0]?.message?.content ?? ''
}

async function askGemini(image, mimeType, apiKey) {
  const data = await call(
    'Gemini',
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    { 'x-goog-api-key': apiKey },
    {
      contents: [{ role: 'user', parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: image } }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0 },
    },
  )
  return data.candidates?.[0]?.content?.parts?.map(part => part.text ?? '').join('') ?? ''
}

// Trims everything, drops empty fields, and keeps only what the app understands.
function clean(raw) {
  const result = { kind: ['card', 'badge', 'screen', 'person', 'other'].includes(raw.kind) ? raw.kind : 'other' }
  for (const key of FIELDS) {
    const value = typeof raw[key] === 'string' ? raw[key].trim() : ''
    if (value) result[key] = value.slice(0, 200)
  }
  if (result.linkedin && !/^https?:\/\//i.test(result.linkedin)) result.linkedin = `https://${result.linkedin.replace(/^\/+/, '')}`
  if (result.linkedin && !/linkedin\.com\//i.test(result.linkedin)) delete result.linkedin
  if (result.website && !/^https?:\/\//i.test(result.website)) result.website = `https://${result.website}`
  return result
}
