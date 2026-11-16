import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts', 'tests/setupAfterEnv.ts'],
    sequence: { setupFiles: 'list' },
    passWithNoTests: false,
  },
})
