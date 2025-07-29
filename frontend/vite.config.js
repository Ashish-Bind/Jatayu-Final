import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      // Proxy all API calls starting with /api or /candidate to Flask
      '/candidate': 'http://localhost:5000',
      '/recruiter': 'http://localhost:5000',
      '/admin': 'http://localhost:5000',
      '/api': 'http://localhost:5000',
    },
  },
})
