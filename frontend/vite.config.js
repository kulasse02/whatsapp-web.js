import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/session': 'http://localhost:3000',
      '/client': 'http://localhost:3000',
      '/chat': 'http://localhost:3000',
      '/groupChat': 'http://localhost:3000',
      '/message': 'http://localhost:3000',
      '/contact': 'http://localhost:3000',
      '/ping': 'http://localhost:3000',
    },
  },
})
