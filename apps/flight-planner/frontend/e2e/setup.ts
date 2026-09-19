import { FullConfig } from '@playwright/test';

async function globalSetup(_config: FullConfig) {
  // Setup code for simulator
  console.log('Setting up simulator...');
  // Add setup logic here
}

export default globalSetup;