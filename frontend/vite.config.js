import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { publicSeo } from './seo.config.js'


// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), publicSeo(loadEnv(mode, process.cwd(), 'VITE_').VITE_PUBLIC_SITE_URL)],
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: false,
    cors: true,
  },
}))
