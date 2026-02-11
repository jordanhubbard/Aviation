const { test, expect } = require('@playwright/test');

// Setup and teardown for the simulator
const setupSimulator = async () => {
  // Code to start the simulator
};

const teardownSimulator = async () => {
  // Code to stop the simulator
};

test.beforeAll(async () => {
  await setupSimulator();
});

test.afterAll(async () => {
  await teardownSimulator();
});

// Example E2E test
test('example e2e test', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await expect(page).toHaveTitle(/G1000 Simulator/);

  // Add more test steps here
});

// Capture screenshots on failure
test.use({
  screenshot: 'only-on-failure',
});
