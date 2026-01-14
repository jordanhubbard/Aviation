import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Tests', () => {
  test('should not have any automatically detectable accessibility issues on main page', async ({ page }) => {
    await page.goto('/');
    
    // Wait for content to load
    await expect(page.locator('h1')).toBeVisible();
    await page.waitForTimeout(1000); // Allow async content to load
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should not have accessibility issues in table view', async ({ page }) => {
    await page.goto('/');
    
    // Wait for table to load
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('table')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should not have accessibility issues in detail modal', async ({ page }) => {
    await page.goto('/');
    
    // Wait for events and open modal
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
    await page.locator('tbody tr').first().click();
    
    // Wait for modal to open
    await expect(page.locator('div[style*="position: fixed"]')).toBeVisible();
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('div[style*="position: fixed"]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('keyboard navigation works for filters', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
    
    // Tab through filter controls
    await page.keyboard.press('Tab'); // Search input
    await expect(page.locator('input[placeholder="registration/operator/summary"]')).toBeFocused();
    
    await page.keyboard.press('Tab'); // Category select
    await expect(page.locator('select').first()).toBeFocused();
    
    // Verify focused elements have visible focus indicators
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });

  test('keyboard navigation works for table', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
    
    // Table rows should be clickable via keyboard
    const firstRow = page.locator('tbody tr').first();
    await firstRow.focus();
    await page.keyboard.press('Enter');
    
    // Modal should open
    await expect(page.locator('div[style*="position: fixed"]')).toBeVisible();
  });

  test('close button is keyboard accessible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
    
    // Open modal
    await page.locator('tbody tr').first().click();
    await expect(page.locator('div[style*="position: fixed"]')).toBeVisible();
    
    // Tab to close button and press Enter
    const closeButton = page.locator('button:has-text("Close")');
    await closeButton.focus();
    await page.keyboard.press('Enter');
    
    // Modal should close
    await expect(page.locator('div[style*="position: fixed"]')).not.toBeVisible();
  });

  test('form labels are properly associated', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
    
    // Check that inputs have associated labels
    const searchInput = page.locator('input[placeholder="registration/operator/summary"]');
    await expect(searchInput).toBeVisible();
    
    // The label should be nearby (in parent)
    const label = searchInput.locator('xpath=ancestor::label');
    await expect(label).toContainText('Search');
  });
});

test.describe('Color Contrast', () => {
  test('should have sufficient color contrast for badges', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
    
    // Check contrast for category badges
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .analyze();
    
    // Filter for color-contrast violations
    const contrastViolations = accessibilityScanResults.violations.filter(
      (v) => v.id === 'color-contrast'
    );
    
    expect(contrastViolations).toEqual([]);
  });
});
