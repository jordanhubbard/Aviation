/** Built UI + real cached NOTAM source; no FAA credential or provider interception. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
const [base, destination] = process.argv.slice(2);
if (!base || !destination) throw new Error('Usage: node e2e/notams-acceptance.mjs <application-origin> <evidence-directory>');
const origin = new URL(base);
if (origin.username || origin.password || origin.search || origin.hash || !['http:', 'https:'].includes(origin.protocol)) throw new Error('Use an application origin without credentials or query');
const evidence = path.resolve(destination); await mkdir(evidence, { recursive: true });
const code = process.env.NMS_ACCEPTANCE_LOCATION ?? 'KPAO';
assert.match(code, /^[A-Z0-9]{2,8}$/);
const source = await (await fetch(new URL('/api/notams?airport=' + code, origin))).json();
assert.ok(source.complete_snapshot && source.total > 0, 'Requires a completed actual source cache with matching notices');
const browser = await chromium.launch({ headless: true }); const results = [];
try {
  for (const [name, viewport] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, acceptDownloads: true });
    const page = await context.newPage(); const errors = []; const requests = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('requestfailed', request => errors.push('Failed request: ' + request.url()));
    page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`); });
    page.on('request', request => requests.push({ method: request.method(), url: request.url() }));
    try {
      await page.goto(new URL('/notams', origin).href, { waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: 'NOTAMs', exact: true }).waitFor();
      assert.equal(requests.filter(r => new URL(r.url).pathname.startsWith('/api/notams')).length, 0, 'No startup NOTAM request');
      await page.getByLabel('Airports / source locations').fill(code);
      await page.getByRole('button', { name: 'Read NOTAMs', exact: true }).click();
      await page.getByText(new RegExp(`${source.total} matching cached records`)).waitFor();
      await page.getByRole('button', { name: /^(Source details|Read full source)$/ }).first().click();
      await page.getByRole('region', { name: 'Original NOTAM source' }).waitFor();
      if (!source.production_data) await page.getByText('Non-production NOTAM data: may include test notices.').waitFor();
      const downloadPending = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download original GeoJSON' }).click();
      const download = await downloadPending;
      const file = path.join(evidence, `source-${name}.geojson`); await download.saveAs(file);
      const original = JSON.parse(await readFile(file, 'utf8'));
      assert.equal(original.properties.coreNOTAMData.notam.id, source.notams[0].id);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No document overflow');
      assert.doesNotMatch(await page.locator('body').innerText(), /\bNaN\b|\bInfinity\b/);
      await page.screenshot({ path: path.join(evidence, `notams-${name}.png`), fullPage: true });
      await writeFile(path.join(evidence, `notams-${name}.yml`), await page.locator('body').ariaSnapshot());
      await page.getByLabel('Airports / source locations').fill('../BAD');
      assert.equal(await page.getByRole('region', { name: 'Original NOTAM source' }).count(), 0);
      const before = requests.filter(r => new URL(r.url).pathname === '/api/notams').length;
      await page.getByRole('button', { name: 'Read NOTAMs', exact: true }).click();
      await page.getByText('Provide 1 to 100 source location identifiers', { exact: true }).waitFor();
      assert.equal(requests.filter(r => new URL(r.url).pathname === '/api/notams').length, before, 'Invalid input stays local');
      await page.getByLabel('Airports / source locations').fill('ZZZZZZZZ');
      await page.getByRole('button', { name: 'Read NOTAMs', exact: true }).click();
      await page.getByText('No matching records in this cached snapshot. This is not confirmation that no applicable NOTAM exists.').waitFor();
      assert.equal(requests.filter(r => r.method !== 'GET').length, 0, 'Read-only flow creates no feedback issues or state');
      assert.deepEqual(errors, []);
      results.push({ viewport: name, real_source: true, source_snapshot: source.snapshot_id, records: source.total,
        no_startup_contact: true, original_download_verified: true, input_invalidates_old_results: true,
        invalid_input_local: true, no_reports_qualified: true, no_overflow: true, runtime_errors: errors });
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
await writeFile(path.join(evidence, 'browser-acceptance.json'), JSON.stringify({ provider_interception: false, results }, null, 2));
console.log(JSON.stringify({ result: 'PASS', viewports: results.map(r => r.viewport), records: source.total }));
