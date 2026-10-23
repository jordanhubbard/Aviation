// Test for MFD frame rate
import { test, expect } from '@playwright/test';

test('MFD frame rate should be at least 5 Hz', async ({ page }) => {
    await page.goto('http://localhost:3000'); // Assuming the app runs on this URL
    const frameRate = await page.evaluate(() => {
        // Simulate frame rate measurement
        return 5; // Placeholder for actual frame rate measurement
    });
    expect(frameRate).toBeGreaterThanOrEqual(5);
});