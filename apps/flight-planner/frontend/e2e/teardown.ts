import { FullConfig } from '@playwright/test';

async function globalTeardown(_config: FullConfig) {
  // Teardown code for simulator
  console.log('Tearing down simulator...');
  // Add teardown logic here
}

export default globalTeardown;