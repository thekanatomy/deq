import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// In development, answer /api/scan right here with the same code Vercel runs in production.
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
    },
  }
}

export default defineConfig({
  plugins: [react(), basicSsl(), devApi()],
  server: { host: true },
})