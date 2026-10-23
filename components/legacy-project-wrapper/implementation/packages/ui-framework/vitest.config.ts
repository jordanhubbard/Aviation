import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    exclude: ['dist/**', 'node_modules/**'],
  },
});
