import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/spotify-family-manager/',
  plugins: [react()],
})
