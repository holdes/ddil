import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.API_URL || 'http://backend:8000',
        changeOrigin: true,
        ws: true,
      },
      '/tiles': {
        target: process.env.API_URL || 'http://backend:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: process.env.WS_URL || 'ws://backend:8000',
        ws: true,
      },
    },
  },
})
