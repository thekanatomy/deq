// Reads one photo with a vision AI and returns the details of the person in it.
// Shared by the Vercel function (api/scan.js) and the local dev server (vite.config.js).
// The API key only ever lives here on the server, never in the phone's code.
//
// Tries readers in order until one answers:
//   1. Groq (GROQ_API_KEY): the fastest.
//   2. Groq with a second key (GROQ_API_KEY_2), if set.
//   3. Gemini 3.1 Flash-Lite (GEMINI_API_KEY): free tier, stable, slower.
//   4. A second Gemini model on the same key: busy or rate-limited models are
//      counted separately, so one being down rarely means both are.
// A model that's only briefly overloaded (503) gets one quick retry first.

const GROQ_MODEL = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b'
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite'
const GEMINI_BACKUP_MODEL = process.env.GEMINI_BACKUP_MODEL || 'gemini-3.5-flash'

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
  const groqKey2 = process.env.GROQ_API_KEY_2 // optional second Groq key, tried when the first is used up
  const geminiKey = process.env.GEMINI_API_KEY
  if (!groqKey && !groqKey2 && !geminiKey) throw new VisionError(501, 'Set GROQ_API_KEY (or GEMINI_API_KEY) on the server')
  if (typeof image !== 'string' || !image) throw new VisionError(400, 'Send the photo as base64 in "image"')
  if (image.length > MAX_BASE64) throw new VisionError(413, 'Photo is too large')
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(mimeType)) throw new VisionError(400, 'Unsupported image type')

  // Groq first: it answers in about a second; Gemini can take much longer
  const readers = [
    groqKey && { name: `Groq (${GROQ_MODEL})`, read: () => askGroq(image, mimeType, groqKey) },
    groqKey2 && { name: `Groq key 2 (${GROQ_MODEL})`, read: () => askGroq(image, mimeType, groqKey2) },
    geminiKey && { name: `Gemini (${GEMINI_MODEL})`, read: () => askGemini(GEMINI_MODEL, image, mimeType, geminiKey) },
    geminiKey && GEMINI_BACKUP_MODEL && {
      name: `Gemini (${GEMINI_BACKUP_MODEL})`,
      read: () => askGemini(GEMINI_BACKUP_MODEL, image, mimeType, geminiKey),
    },
  ].filter(Boolean)
  let text
  let lastError
  for (const reader of readers) {
    const started = Date.now()
    try {
      text = await reader.read().catch(async error => {
        // 503 means "busy right now": wait a moment and ask the same model once more
        if (error.status !== 503) throw error
        await new Promise(resolve => setTimeout(resolve, 700))
        return reader.read()
      })
      // shows in the dev terminal and in Vercel's logs: which AI answered, and how fast
      console.log(`Scan read by ${reader.name} in ${((Date.now() - started) / 1000).toFixed(1)}s`)
      break
    } catch (error) {
      lastError = error
    }
  }
  if (text === undefined) throw lastError
  let parsed
  try {
    parsed = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''))
  } catch {
    throw new VisionError(502, 'The AI did not return JSON')
  }
  return clean(parsed)
}

// Groq's free daily limit is counted per model, so when one model is used up for the
// day, try the next: GROQ_FALLBACK_MODELS=model-a,model-b (optional).
const GROQ_FALLBACKS = (process.env.GROQ_FALLBACK_MODELS || '').split(',').map(model => model.trim()).filter(Boolean)

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
    // 429: the free daily limit is used up. 503: busy right now. Both are passed on.
    throw new VisionError([429, 503].includes(response.status) ? response.status : 502, `${name} returned ${response.status}`)
  }
  return response.json()
}

async function askGroq(image, mimeType, apiKey) {
  for (const [index, model] of [GROQ_MODEL, ...GROQ_FALLBACKS].entries()) {
    try {
      return await askGroqModel(model, image, mimeType, apiKey)
    } catch (error) {
      const last = index === GROQ_FALLBACKS.length
      if (error.status !== 429 || last) throw error
    }
  }
}

async function askGroqModel(model, image, mimeType, apiKey) {
  const data = await call('Groq', 'https://api.groq.com/openai/v1/chat/completions', { Authorization: `Bearer ${apiKey}` }, {
    model,
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

async function askGemini(model, image, mimeType, apiKey) {
  const data = await call(
    'Gemini',
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
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
  // keep LinkedIn only as a clean profile link: linkedin.com/in/<handle>
  if (result.linkedin) {
    const path = result.linkedin.match(/linkedin\.com\/((?:in|company)\/[^/?#\s]+)/i)
    if (path) result.linkedin = `https://www.linkedin.com/${path[1]}`
    else delete result.linkedin
  }
  // a profile screenshot shows the name but not the link, so the AI tends to guess
  // linkedin.com/in/<first-last>. Real links often end in extra characters, so a
  // link that is only the name, read off a screen or a face, is dropped: no dead links.
  if (result.linkedin && result.name && !['card', 'badge'].includes(result.kind)) {
    const fromName = result.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const handle = result.linkedin.split('/in/')[1]?.toLowerCase()
    if (handle === fromName) delete result.linkedin
  }
  if (result.website && !/^https?:\/\//i.test(result.website)) result.website = `https://${result.website}`
  return result
}
