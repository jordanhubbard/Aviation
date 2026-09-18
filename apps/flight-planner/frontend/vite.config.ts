import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', 'e2e/**', 'test-results/**'],
  },
  server: {
    host: '0.0.0.0',
    port: parseInt(process.env.FRONTEND_PORT || '3004'),
    proxy: {
      '/api': {
        target: `http://${process.env.BACKEND_HOST || 'localhost'}:${process.env.BACKEND_PORT || '8000'}`,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  optimizeDeps: {
    // @aviation/shared-sdk is a linked CommonJS workspace package; without
    // pre-bundling, Rollup cannot see its named exports and the build fails
    // with "distanceNM is not exported".
    include: ['@aviation/shared-sdk/aviation/navigation'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    commonjsOptions: {
      include: [/shared-sdk/, /node_modules/],
    },
  },
})
