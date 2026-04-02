import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api/documents': { target: 'http://localhost:8000', changeOrigin: true },
      '/api/collections': { target: 'http://localhost:8000', changeOrigin: true },
      '/api/chat': { target: 'http://localhost:8000', changeOrigin: true },
      '/api/dashboard': { target: 'http://localhost:8000', changeOrigin: true },
      '/api/board-goals': { target: 'http://localhost:8000', changeOrigin: true },
      '/api/kpi': { target: 'http://localhost:8000', changeOrigin: true },
      '/api/ppr': { target: 'http://localhost:8000', changeOrigin: true },
      '/api/leader-goals': { target: 'http://localhost:8000', changeOrigin: true },
      '/api/strategy-goals': { target: 'http://localhost:8000', changeOrigin: true },
      '/api/settings': { target: 'http://localhost:8000', changeOrigin: true },
      '/api/db': { target: 'http://localhost:8000', changeOrigin: true },
      '/api/reference': { target: 'http://localhost:8000', changeOrigin: true },
      '/api/process-registry': { target: 'http://localhost:8000', changeOrigin: true },
      '/api/staff': { target: 'http://localhost:8000', changeOrigin: true },
      '/api/leaders': { target: 'http://localhost:8000', changeOrigin: true },
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
