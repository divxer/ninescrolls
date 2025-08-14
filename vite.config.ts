import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    host: true,
    // Add redirect rules to handle trailing slash issues
    proxy: {}
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  publicDir: 'public',
  base: '/',
  resolve: {
    alias: {
      '@': '/src',
      '@assets': '/public/assets'
    }
  }
})
