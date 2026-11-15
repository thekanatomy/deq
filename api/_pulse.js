// deq pulse: one grounded Gemini call per sweep.
// It searches the WORK, never the bare name: the company and the need the person told
// you about. Person-level results only when a source names both the person and the
// company. Every fact must carry a source; nothing is ever sent for you.

// tried in order: a model with no quota left (429) or retired (404) passes to the next
const MODELS = (process.env.GEMINI_PULSE_MODEL || 'gemini-flash-lite-latest,gemini-3.1-flash-lite,gemini-flash-latest,gemini-3.8-flash,gemini-2.5-flash-lite').split(',').map(m => m.trim())
const ENDPOINT = model => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

export class PulseError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.status = status
  }
}

const clip = (value, max = 600) => String(value ?? '').slice(0, max)

function prompt({ card, since, you }) {
  return `You are the research agent inside deq pulse, a contact app. Use Google Search.

Person: ${clip(card.name, 80)}, ${clip(card.role, 120) || 'role unknown'}, ${clip(card.company, 120) || 'company unknown'}
What they told me / what they need: ${clip(card.hook) || 'not recorded'}
Where we met: ${clip(card.place, 160) || 'unknown'}
Look for changes since: ${since}

Find, in this order:
1. What this company does in that area, and anything it announced since ${since}.
2. Open roles at this company matching what they need or what they work on.
3. Anything this specific person published professionally — only if the result clearly names BOTH the person and this company.

Rules:
- Never report a fact you cannot tie to a search result.
- Never infer anything personal: no location, family, social media, photos, or anything outside their professional work.
- If several different people share this name, return nothing for step 3 and say so in "name_note".
- Generic industry news, news that doesn't touch their team, and anything older than ${since} is NOT news.
- If nothing relevant changed since ${since}, set "is_news" to false and say so plainly.

Then write two short opening messages from me to them (2-3 sentences, plain, warm, no flattery, no emojis, no subject line):
- "draft": uses what changed AND what I can offer from ABOUT ME below. Reference where we met.
- "draft_generic": the same message written WITHOUT knowing anything about me or what changed — the generic "great to meet you, let's keep in touch" note.

ABOUT ME:
${clip(you, 2500) || '(nothing provided)'}

Return ONLY JSON, no markdown:
{"is_news": boolean,
 "kind": "role_change" | "opening" | "company_news" | "published" | "none",
 "headline": "one line, under 90 characters, what changed",
 "detail": "one or two sentences with specifics",
 "company_brief": "one sentence on what the company does in their area",
 "openings": [{"title": "...", "url": "..."}],
 "person_public": [{"title": "...", "url": "..."}],
 "name_note": "",
 "confidence": "high" | "medium" | "low",
 "draft": "...",
 "draft_generic": "..."}`
}

function parseJson(text) {
  const body = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end < start) throw new PulseError('The agent returned no result', 502)
  return JSON.parse(body.slice(start, end + 1))
}

export async function sweep(body) {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new PulseError('GEMINI_API_KEY is not set', 500)
  const card = body?.card ?? {}
  if (!card.name && !card.company) throw new PulseError('A card needs a name or company', 400)
  const since = clip(body.since, 40) || new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)

  let response, MODEL, detail = ''
  for (MODEL of MODELS) {
    response = await fetch(ENDPOINT(MODEL), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt({ card, since, you: body.you }) }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.3 },
      }),
    })
    if (response.ok) break
    detail = await response.text().catch(() => '')
    if (![404, 429].includes(response.status)) break
  }
  if (!response.ok) {
    throw new PulseError(`Gemini ${response.status}: ${detail.slice(0, 200)}`, response.status === 429 ? 429 : 502)
  }
  const data = await response.json()
  const candidate = data.candidates?.[0]
  const text = candidate?.content?.parts?.map(part => part.text ?? '').join('') ?? ''
  const result = parseJson(text)

  // the sources Google actually returned, so every claim in the UI has a link
  const meta = candidate?.groundingMetadata ?? {}
  const sources = (meta.groundingChunks ?? [])
    .map(chunk => chunk.web)
    .filter(Boolean)
    .map(web => ({ title: web.title, url: web.uri }))
    .slice(0, 6)

  const isNews = Boolean(result.is_news) && sources.length > 0 // no source, no news
  return {
    checkedAt: new Date().toISOString(),
    since,
    isNews,
    kind: isNews ? result.kind : 'none',
    headline: clip(result.headline, 140),
    detail: clip(result.detail, 500),
    companyBrief: clip(result.company_brief, 300),
    openings: (result.openings ?? []).slice(0, 4),
    personPublic: (result.person_public ?? []).slice(0, 3),
    nameNote: clip(result.name_note, 200),
    confidence: result.confidence ?? 'low',
    draft: clip(result.draft, 900),
    draftGeneric: clip(result.draft_generic, 900),
    queries: meta.webSearchQueries ?? [],
    sources,
    model: MODEL,
  }
}
