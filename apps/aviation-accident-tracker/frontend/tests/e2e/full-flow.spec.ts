// apps/aviation-accident-tracker/frontend/tests/e2e/full-flow.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Full Flow End-to-End Tests', () => {
  test('user can navigate through the app and view events', async ({ page }) => {
    await page.goto('/');

    // Check that the home page loads
    await expect(page).toHaveTitle(/Aviation Accident Tracker/);

    // Navigate to events page
    await page.click('text=Events');

    // Check that events are displayed
    const events = await page.locator('.event-item');
    await expect(events).toHaveCountGreaterThan(0);

    // Filter events by category
    await page.selectOption('select#category-filter', 'Commercial');
    const filteredEvents = await page.locator('.event-item:has-text("Commercial")');
    await expect(filteredEvents).toHaveCountGreaterThan(0);

    // Navigate to map view
    await page.click('text=Map');

    // Check that map markers are displayed
    const markers = await page.locator('.map-marker');
    await expect(markers).toHaveCountGreaterThan(0);
  });
});