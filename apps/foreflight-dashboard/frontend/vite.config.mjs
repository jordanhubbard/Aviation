import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: Number.parseInt(process.env.REACT_DEV_PORT || '3005', 10),
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
      },
    },
  },
  build: {
    outDir: '../src/static/dist',
    emptyOutDir: true,
  },
})
