import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,            // provides describe/it/expect without explicit imports
    environment: 'node',
    // Run unit tests by default; exclude integration tests that need real network
    // and tests with broken deps (shared-sdk, seed files)
    exclude: [
      'node_modules/**',
      'tests/integration/api.test.ts',
      'tests/integration/end-to-end.test.ts',
      'tests/integration/database.test.ts',
      'src/tests/api.test.ts',
      // These hit real external APIs — skip in CI
      'tests/integration/ingestion.test.ts',
    ],
    coverage: {
      reporter: ['text', 'json'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/__tests__/**'],
    },
  },
});
