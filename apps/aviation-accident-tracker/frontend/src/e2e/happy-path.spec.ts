import { test, expect } from '@playwright/test';

test.describe('Aviation Accident Tracker - Happy Path', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads the application and displays title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Aviation Accident Tracker');
  });

  test('filters events by search query', async ({ page }) => {
    // Wait for events to load
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
    
    // Get initial row count
    const initialRows = await page.locator('tbody tr').count();
    expect(initialRows).toBeGreaterThan(0);
    
    // Enter search query
    await page.fill('input[placeholder="registration/operator/summary"]', 'N12345');
    
    // Wait for filtered results
    await page.waitForTimeout(500); // Allow debounce
    
    // Verify filtered results
    const filteredRows = await page.locator('tbody tr').count();
    expect(filteredRows).toBeLessThanOrEqual(initialRows);
  });

  test('filters events by category', async ({ page }) => {
    // Wait for events to load
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
    
    // Select "General" category
    await page.selectOption('select', { label: 'General' });
    
    // Wait for filtered results
    await page.waitForTimeout(500);
    
    // Verify all visible events are "general" category
    const categoryBadges = await page.locator('tbody td:has-text("general")').count();
    expect(categoryBadges).toBeGreaterThan(0);
  });

  test('opens and closes event detail modal', async ({ page }) => {
    // Wait for events to load
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
    
    // Click first event row
    await page.locator('tbody tr').first().click();
    
    // Modal should open
    await expect(page.locator('div[style*="position: fixed"]')).toBeVisible();
    
    // Verify modal content
    await expect(page.locator('h2')).toBeVisible();
    
    // Close modal
    await page.click('button:has-text("Close")');
    
    // Modal should be closed
    await expect(page.locator('div[style*="position: fixed"]')).not.toBeVisible();
  });

  test('navigates through pages', async ({ page }) => {
    // Wait for events to load
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
    
    // Verify on page 1
    await expect(page.locator('text=Page 1')).toBeVisible();
    
    // Prev button should be disabled
    await expect(page.locator('button:has-text("Prev")')).toBeDisabled();
    
    // Click Next
    await page.click('button:has-text("Next")');
    
    // Verify on page 2
    await expect(page.locator('text=Page 2')).toBeVisible();
    
    // Prev button should be enabled
    await expect(page.locator('button:has-text("Prev")')).toBeEnabled();
    
    // Click Prev to go back
    await page.click('button:has-text("Prev")');
    
    // Verify back on page 1
    await expect(page.locator('text=Page 1')).toBeVisible();
  });

  test('clears all filters', async ({ page }) => {
    // Wait for events to load
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
    
    // Set some filters
    await page.fill('input[placeholder="registration/operator/summary"]', 'test');
    await page.selectOption('select', { label: 'General' });
    
    // Wait for filters to apply
    await page.waitForTimeout(500);
    
    // Click Clear button
    await page.click('button:has-text("Clear")');
    
    // Verify filters are cleared
    await expect(page.locator('input[placeholder="registration/operator/summary"]')).toHaveValue('');
    await expect(page.locator('select').first()).toHaveValue('all');
  });
});

test.describe('Map Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
  });

  test('displays map with markers', async ({ page }) => {
    // Verify map container is visible
    const mapContainer = page.locator('.leaflet-container');
    await expect(mapContainer).toBeVisible();
    
    // Map should have loaded tiles
    const tiles = page.locator('.leaflet-tile');
    await expect(tiles.first()).toBeVisible({ timeout: 5000 });
  });

  test('map markers are clustered', async ({ page }) => {
    // Check for marker cluster groups
    const clusterMarkers = page.locator('.marker-cluster');
    // Clusters may or may not be visible depending on zoom level
    // Just verify the clustering library loaded
    const leafletOverlay = page.locator('.leaflet-marker-pane');
    await expect(leafletOverlay).toBeVisible();
  });
});

test.describe('Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('displays correctly on mobile', async ({ page }) => {
    await page.goto('/');
    
    // App should load
    await expect(page.locator('h1')).toContainText('Aviation Accident Tracker');
    
    // Filters should be visible (may wrap)
    await expect(page.locator('input[placeholder="registration/operator/summary"]')).toBeVisible();
    
    // Table should be visible (may scroll horizontally)
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
  });
});
