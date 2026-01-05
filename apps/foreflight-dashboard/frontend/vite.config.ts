import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: parseInt(process.env.REACT_DEV_PORT || '3001'),
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.FASTAPI_PORT || '5051'}`,
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: `http://localhost:${process.env.FASTAPI_PORT || '5051'}`,
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    outDir: '../src/static/dist',
    emptyOutDir: true,
  }
})
