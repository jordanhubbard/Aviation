#!/usr/bin/env node
// Run against a deployed app or a local production build. AVIATION_E2E_SECRET
// must match the server; no fixture is created in the production database.
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import {
  installE2EApiHeaders, runE2EScreens, seedRemoteFixture,
  standardE2EFixtures, withE2ERun,
} from '@aviation/shared-sdk/e2e';

const appId = process.argv[2];
if (!['aviation-accident-tracker', 'preflight-check', 'meta-app'].includes(appId)) {
  throw new Error(`No remote E2E screen adapter for ${appId || '(missing app)'}`);
}
const baseUrl = process.env.AVIATION_E2E_BASE_URL || `https://${appId}.jordanhubbard.net`;
const secret = process.env.AVIATION_E2E_SECRET || (appId !== 'aviation-accident-tracker' ? randomBytes(32).toString('hex') : '');
if (secret.length < 32) throw new Error('AVIATION_E2E_SECRET must have at least 32 characters');
const executable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || (existsSync(chromium.executablePath()) ? undefined
    : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');

if (appId === 'meta-app') {
  const manifest = JSON.parse(readFileSync(new URL('./apps.json', import.meta.url), 'utf8'));
  const expected = manifest.apps.filter(app => app.name !== 'meta-app' && app.name !== 'aviation-chat')
    .map(app => `https://${app.hostname || app.name}.${manifest.domain}/`);
  const browser = await chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : {}) });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await runE2EScreens(['launcher', 'settings'], [
      {
        id: 'launcher', dataMode: 'stateless',
        visit: () => page.goto(baseUrl, { waitUntil: 'domcontentloaded' }),
        verify: async () => {
          await page.getByRole('heading', { name: /Aviation Suite/ }).first().waitFor();
          const links = await page.locator('.launcher-card-cta[href]').evaluateAll(elements =>
            elements.map(element => element.getAttribute('href')));
          const missing = expected.filter(url => !links.includes(url));
          if (missing.length || links.length !== expected.length) {
            throw new Error(`Launcher inventory mismatch: missing=${missing} count=${links.length}/${expected.length}`);
          }
        },
      },
      {
        id: 'settings', dataMode: 'stateless',
        visit: () => page.locator('.launcher-card').filter({ hasText: 'Open Settings' }).click(),
        verify: async () => {
          await page.getByRole('heading', { level: 1, name: 'Aviation Suite Settings' }).waitFor();
          await page.getByRole('heading', { name: 'Service Registry' }).waitFor();
          await page.getByRole('button', { name: 'Back to Launcher' }).click();
          await page.locator('.launcher-grid').waitFor();
          if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        },
      },
    ]);
    await context.close();
  } finally { await browser.close(); }
  console.log(`remote E2E passed: ${appId} (${baseUrl}); isolated browser closed`);
} else if (appId === 'preflight-check') {
  const browser = await chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : {}) });
  try {
    await withE2ERun(secret, async run => {
      const context = await browser.newContext();
      const page = await context.newPage();
      run.onCleanup(async () => {
        await page.evaluate(() => {
          localStorage.removeItem('aviation-preflight-profile-v1');
          localStorage.removeItem('aviation-preflight-risk-v1');
        });
        const remaining = await page.evaluate(() =>
          ['aviation-preflight-profile-v1', 'aviation-preflight-risk-v1'].filter(key => localStorage.getItem(key)));
        if (remaining.length) throw new Error(`Preflight data remains: ${remaining}`);
        await context.close();
      });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await runE2EScreens(['aircraft-profile', 'loading', 'risk', 'references'], [
        {
          id: 'aircraft-profile', dataMode: 'isolated-browser',
          visit: async () => {
            await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
            await page.locator('#registration').fill('N123ET');
            await page.locator('#emptyWeight').fill('1500');
            await page.locator('#emptyArm').fill('39');
            await page.locator('#maxGross').fill('2300');
            await page.locator('#fuelArm').fill('48');
            await page.locator('.station-name').first().fill('Front seats');
            await page.locator('.station-arm').first().fill('37');
            await page.locator('.envelope-row').first().locator('.envelope-weight').fill('1500');
            await page.locator('.envelope-row').first().locator('.forward').fill('35');
            await page.locator('.envelope-row').first().locator('.aft').fill('47');
            await page.locator('.envelope-row').nth(1).locator('.envelope-weight').fill('2300');
            await page.locator('.envelope-row').nth(1).locator('.forward').fill('41');
            await page.locator('.envelope-row').nth(1).locator('.aft').fill('47');
            await page.getByRole('button', { name: 'Save aircraft profile' }).click();
          },
          verify: async () => {
            await page.getByText('Aircraft profile saved in this browser.').waitFor();
            const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('aviation-preflight-profile-v1')));
            if (saved.registration !== 'N123ET') throw new Error('Profile was not saved');
          },
        },
        {
          id: 'loading', dataMode: 'isolated-browser',
          visit: async () => {
            await page.locator('.station-weight').first().fill('170');
            await page.locator('#fuelGallons').fill('40');
            await page.locator('#fuelBurnGallons').fill('20');
            await page.getByRole('button', { name: 'Calculate takeoff and landing' }).click();
          },
          verify: async () => {
            const result = await page.locator('#results').innerText();
            if (!result.includes('1910.00') || !result.includes('1790.00')
              || !result.includes('Within entered limits')) throw new Error(`Bad loading result: ${result}`);
          },
        },
        {
          id: 'risk', dataMode: 'isolated-browser',
          visit: async () => {
            await page.locator('.risk').first().check();
            await page.locator('#riskNotes').fill(`Synthetic review ${run.id}`);
          },
          verify: async () => {
            await page.getByText('1 of 4 review areas checked.').waitFor();
            const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('aviation-preflight-risk-v1')));
            if (stored.notes !== `Synthetic review ${run.id}` || stored.pilot !== true) {
              throw new Error('Risk review did not retain the run fixture');
            }
          },
        },
        {
          id: 'references', dataMode: 'stateless',
          visit: async () => page.getByRole('heading', { name: 'References' }).scrollIntoViewIfNeeded(),
          verify: async () => {
            await page.getByRole('link', { name: 'FAA Weight & Balance Handbook' }).waitFor();
            if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
          },
        },
      ]);
    });
  } finally { await browser.close(); }
  console.log(`remote E2E passed: ${appId} (${baseUrl}); browser fixtures removed`);
} else await withE2ERun(secret, async run => {
  const api = { appId, baseUrl, fetch };
  const seeded = await seedRemoteFixture(run, api, 'accident', standardE2EFixtures(run.id).accident);
  if (!seeded || typeof seeded !== 'object' || !('id' in seeded)) throw new Error('Seed did not return an event ID');
  const browser = await chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await installE2EApiHeaders(page, baseUrl, appId, run);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await runE2EScreens(['list', 'filters', 'citations', 'detail-map'], [
      {
        id: 'list', dataMode: 'tagged-database',
        visit: () => page.goto(baseUrl, { waitUntil: 'domcontentloaded' }),
        verify: async () => {
          await page.getByRole('heading', { name: 'Aviation Accident Tracker' }).waitFor();
          await page.getByRole('row', { name: /N123ET/ }).waitFor();
          const records = await page.locator('tbody tr[aria-label^="View details"]').count();
          if (records !== 1) throw new Error(`Expected only the tagged fixture; found ${records} rows`);
          await page.locator('.leaflet-container').waitFor();
          if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        },
      },
      {
        id: 'filters', dataMode: 'tagged-database',
        visit: async () => {
          await page.getByLabel('Category:').selectOption('commercial');
          await page.getByText('No events found for current filters.').waitFor();
          await page.getByLabel('Category:').selectOption('general');
          await page.getByLabel('Region:').selectOption('CA');
          await page.getByPlaceholder('registration/operator/summary').fill('N123ET');
        },
        verify: async () => {
          await page.getByRole('row', { name: /N123ET/ }).waitFor();
          const count = await page.locator('tbody tr[aria-label^="View details"]').count();
          if (count !== 1) throw new Error(`Filtered fixture count is ${count}`);
        },
      },
      {
        id: 'citations', dataMode: 'tagged-database',
        visit: () => page.getByRole('button', { name: 'Show citations for N123ET' }).click(),
        verify: async () => {
          await page.getByText('Known citations').waitFor();
          const link = page.locator('tbody a[href^="https://example.invalid/e2e/"]');
          await link.first().waitFor();
          if (!(await link.first().getAttribute('href')).includes(run.id)) {
            throw new Error('Citation belongs to a different test run');
          }
        },
      },
      {
        id: 'detail-map', dataMode: 'tagged-database',
        visit: () => page.getByRole('row', { name: /View details for N123ET/ }).click(),
        verify: async () => {
          const detail = page.getByRole('dialog');
          await detail.getByText('Synthetic E2E event').waitFor();
          await detail.getByText('@ 37.721, -122.221').waitFor();
          await detail.getByRole('button', { name: 'Close' }).click();
          await page.locator('.leaflet-marker-icon').first().waitFor();
          if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        },
      },
    ]);
    await page.close();
  } finally {
    await browser.close();
  }
});
if (appId === 'aviation-accident-tracker')
  console.log(`remote E2E passed: ${appId} (${baseUrl}); tagged fixture removed`);
