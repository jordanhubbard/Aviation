/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        module: 'commonjs',
        strict: false,
        noImplicitAny: false,
        skipLibCheck: true,
        resolveJsonModule: true,
        moduleResolution: 'node',
        types: ['node', 'jest'],
      },
    }],
  },
  // setupFiles runs BEFORE the test framework — only env vars / globals here
  setupFiles: ['<rootDir>/tests/setup.ts'],
  // setupFilesAfterEnv runs AFTER jest globals (describe/it/beforeEach) are available
  setupFilesAfterEnv: ['<rootDir>/tests/setupAfterEnv.ts'],
  passWithNoTests: false,
};
