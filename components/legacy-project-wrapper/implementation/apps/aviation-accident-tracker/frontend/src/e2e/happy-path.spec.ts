import { expect, test, type Page } from '@playwright/test';

const events = [
  {
    id: 'evt-general',
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
    sources: [],
  },
  {
    id: 'evt-commercial',
    dateZ: '2026-08-21T12:00:00Z',
    registration: 'N98765',
    operator: 'Example Air',
    aircraftType: 'B738',
    airportIcao: 'KJFK',
    category: 'commercial',
    country: 'US',
    region: 'NY',
    lat: 40.64,
    lon: -73.78,
    summary: 'Rejected takeoff',
    narrative: 'Crew rejected the takeoff safely.',
    status: 'preliminary',
    fatalities: 0,
    injuries: 0,
    sources: [],
  },
];

async function mockApi(page: Page) {
  await page.route('**/api/filters/options', (route) =>
    route.fulfill({ json: { countries: ['US'], regions: ['CA', 'NY'] } }),
  );
  await page.route('**/api/airports**', (route) =>
    route.fulfill({ json: [{ icao: 'KSFO', iata: 'SFO', name: 'San Francisco International' }] }),
  );
  await page.route(/\/api\/events\?.*$/, (route) => {
    const url = new URL(route.request().url());
    const search = url.searchParams.get('search')?.toLowerCase();
    const category = url.searchParams.get('category');
    const filtered = events.filter(
      (event) =>
        (!search || `${event.registration} ${event.operator} ${event.summary}`.toLowerCase().includes(search)) &&
        (!category || event.category === category),
    );
    return route.fulfill({ json: { data: filtered } });
  });
  await page.route(/\/api\/events\/[^?]+$/, (route) => {
    const event = events.find(({ id }) => route.request().url().endsWith(id)) ?? events[0];
    return route.fulfill({ json: { ...event, sources: [{ sourceName: 'NTSB', url: 'https://example.test/report' }] } });
  });
  await page.route('https://*.tile.openstreetmap.org/**', (route) => route.abort());
}

test.beforeEach(async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await expect(page.getByRole('table')).toBeVisible();
});

test('loads events and filters by search and category', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Aviation Accident Tracker' })).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(2);

  await page.getByPlaceholder('registration/operator/summary').fill('N12345');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.getByRole('cell', { name: 'N12345' })).toBeVisible();

  await page.getByRole('button', { name: 'Clear' }).click();
  await page.getByLabel('Category:').selectOption('commercial');
  await expect(page.getByRole('cell', { name: 'N98765' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'N12345' })).toHaveCount(0);
});

test('opens detail with the keyboard and closes it', async ({ page }) => {
  const row = page.getByRole('row', { name: /N12345/ });
  await row.focus();
  await row.press('Enter');

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading')).toContainText('N12345');
  await expect(dialog.getByRole('link', { name: 'NTSB' })).toBeVisible();

  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toHaveCount(0);
});

test('updates pagination and clears all filters', async ({ page }) => {
  await expect(page.getByText('Page 1', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Prev' })).toBeDisabled();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Page 2', { exact: true })).toBeVisible();

  await page.getByPlaceholder('registration/operator/summary').fill('N12345');
  await page.getByLabel('Category:').selectOption('general');
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(page.getByPlaceholder('registration/operator/summary')).toHaveValue('');
  await expect(page.getByLabel('Category:')).toHaveValue('all');
  await expect(page.getByText('Page 1', { exact: true })).toBeVisible();
});

test('renders at a mobile viewport without horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await expect(page.getByRole('heading', { name: 'Aviation Accident Tracker' })).toBeVisible();
  const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflows).toBe(false);
});
