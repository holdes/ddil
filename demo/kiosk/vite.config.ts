import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Dedupe React so libraries (e.g. qrcode.react) don't get a separate copy
  // through optimized deps — that causes "Invalid hook call" errors at runtime.
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 3100,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
    },
  },
})
