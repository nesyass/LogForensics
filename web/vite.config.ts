import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The dev server proxies API calls to the local FastAPI process so the
// frontend and backend can be developed independently.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
