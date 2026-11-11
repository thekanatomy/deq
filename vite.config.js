import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // basicSsl serves the dev site over https, which phones require before
  // they allow the live camera. host: true lets your phone reach your laptop.
  plugins: [react(), basicSsl()],
  server: { host: true },
})