import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    port: parseInt(process.env.PORT || '5173'),
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
