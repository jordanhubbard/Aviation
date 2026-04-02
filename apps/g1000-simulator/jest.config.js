/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: [
    '/node_modules/',
    // Playwright tests — run separately via `pnpm playwright test`
    'tests/e2e.test.js',
    'tests/performance/',
    // React frontend tests — need vite/jsdom setup, not covered by jest
    'frontend/src/',
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        module: 'commonjs',
        strict: false,
        noImplicitAny: false,
      },
    }],
  },
  passWithNoTests: true,
};
