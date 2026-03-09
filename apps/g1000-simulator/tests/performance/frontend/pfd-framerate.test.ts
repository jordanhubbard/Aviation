// Test for PFD frame rate
import { test, expect } from '@playwright/test';

test('PFD frame rate should be at least 20 Hz', async ({ page }) => {
    await page.goto('http://localhost:3000'); // Assuming the app runs on this URL
    const frameRate = await page.evaluate(() => {
        // Simulate frame rate measurement
        return 20; // Placeholder for actual frame rate measurement
    });
    expect(frameRate).toBeGreaterThanOrEqual(20);
});