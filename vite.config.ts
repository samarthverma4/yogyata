import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // the yogyata-ai service (uvicorn server.app:app --port 8787) answers /ai/*
    proxy: { '/ai': 'http://localhost:8787' },
  },
})
