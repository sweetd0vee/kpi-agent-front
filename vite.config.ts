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
      // Бэкенд каскадирования (документы, коллекции, чат, дашборд)
      '/api/documents': { target: 'http://localhost:8000', changeOrigin: true },
      '/api/collections': { target: 'http://localhost:8000', changeOrigin: true },
      '/api/chat': { target: 'http://localhost:8000', changeOrigin: true },
      '/api/dashboard': { target: 'http://localhost:8000', changeOrigin: true },
      // Open Web UI (модели, файлы, знания)
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
