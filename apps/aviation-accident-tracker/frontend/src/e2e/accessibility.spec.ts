import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const event = {
  id: 'evt-1',
  dateZ: '2026-08-20T12:00:00Z',
  registration: 'N12345',
  operator: 'Bay Area Flying Club',
  aircraftType: 'C172',
  airportIcao: 'KSFO',
  category: 'general',
  country: 'US',
  region: 'CA',
  lat: 37.62,
  lon: -122.38,
  summary: 'Runway excursion',
  narrative: 'Aircraft departed the runway after landing.',
  status: 'final',
  fatalities: 0,
  injuries: 0,
  sources: [{ sourceName: 'NTSB', url: 'https://example.test/report' }],
};

async function mockApi(page: Page) {
  await page.route('**/api/filters/options', (route) => route.fulfill({ json: { countries: ['US'], regions: ['CA'] } }));
  await page.route(/\/api\/events\?.*$/, (route) => route.fulfill({ json: { data: [event] } }));
  await page.route(/\/api\/events\/[^?]+$/, (route) => route.fulfill({ json: event }));
  await page.route('https://*.tile.openstreetmap.org/**', (route) => route.abort());
}

async function expectNoAxeViolations(page: Page, include?: string) {
  let scan = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  if (include) scan = scan.include(include);
  const results = await scan.analyze();
  expect(results.violations).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await expect(page.getByRole('table')).toBeVisible();
});

test('main page and event table have no detectable WCAG A/AA violations', async ({ page }) => {
  await expectNoAxeViolations(page, '#accident-tracker-app');
  await expectNoAxeViolations(page, 'table');
});

test('detail dialog has no detectable WCAG A/AA violations', async ({ page }) => {
  await page.getByRole('row', { name: /N12345/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectNoAxeViolations(page, '[role="dialog"]');
});

test('filters and event rows are keyboard accessible', async ({ page }) => {
  const search = page.getByPlaceholder('registration/operator/summary');
  await search.focus();
  await expect(search).toBeFocused();
  await search.press('Tab');
  await expect(page.getByLabel('Category:')).toBeFocused();

  const row = page.getByRole('row', { name: /N12345/ });
  await row.focus();
  await row.press(' ');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
