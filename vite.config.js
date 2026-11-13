import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// In development, answer /api/scan, /api/ics and /api/pass right here with the same code Vercel runs in production.
// Reads the AI key from .env.local (never shipped to the phone).
function devApi() {
  return {
    name: 'deq-dev-api',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '')
      for (const key of [
        'GROQ_API_KEY',
        'GROQ_API_KEY_2',
        'GROQ_MODEL',
        'GROQ_FALLBACK_MODELS',
        'GEMINI_API_KEY',
        'GEMINI_MODEL',
        'GEMINI_BACKUP_MODEL',
        'WALLETWALLET_API_KEY',
      ]) if (env[key]) process.env[key] = env[key]

      server.middlewares.use('/api/scan', async (req, res) => {
        const send = (status, body) => {
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(body))
        }
        if (req.method !== 'POST') return send(405, { error: 'Use POST' })
        try {
          let raw = ''
          for await (const chunk of req) raw += chunk
          const { readPhoto } = await server.ssrLoadModule('/api/_vision.js')
          send(200, await readPhoto(JSON.parse(raw || '{}')))
        } catch (error) {
          send(error.status ?? 500, { error: error.message })
        }
      })

      // GET /api/ics?… : a calendar event for Apple Calendar, same code as on Vercel
      server.middlewares.use('/api/ics', async (req, res) => {
        try {
          const query = Object.fromEntries(new URL(req.url, 'https://localhost').searchParams)
          const { makeIcs } = await server.ssrLoadModule('/api/_ics.js')
          res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
          res.setHeader('Content-Disposition', 'inline; filename="follow-up.ics"')
          res.end(makeIcs(query))
        } catch (error) {
          res.statusCode = error.status ?? 500
          res.end(JSON.stringify({ error: error.message }))
        }
      })

      // GET /api/pass?card=… : the Apple Wallet pass, same code as on Vercel
      server.middlewares.use('/api/pass', async (req, res) => {
        try {
          const card = new URL(req.url, 'https://localhost').searchParams.get('card') ?? ''
          const { makePass } = await server.ssrLoadModule('/api/_pass.js')
          const pass = await makePass(card)
          res.setHeader('Content-Type', 'application/vnd.apple.pkpass')
          res.setHeader('Content-Disposition', 'attachment; filename="deq.pkpass"')
          res.end(pass)
        } catch (error) {
          res.statusCode = error.status ?? 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: error.message }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), basicSsl(), devApi()],
  server: { host: true },
  // which version is running, shown in About: the commit Vercel built from
  define: { __BUILD__: JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA || 'dev').slice(0, 7)) },
})