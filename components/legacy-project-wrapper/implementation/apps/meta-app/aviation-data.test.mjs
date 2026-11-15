import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { asset, installAviationDataFixtures, exerciseAviationDataPanel } from '../../deploy/aviation-data-qualification.mjs';

test('application aviation data browser acceptance', async t => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) }); t.after(() => browser.close());
  async function setup(t, options = {}, viewport = { width: 1280, height: 900 }) {
    const page = await browser.newPage({ viewport }); t.after(() => page.close());
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    t.after(() => assert.deepEqual(errors, []));
    const fixture = await installAviationDataFixtures(page, 'widget-test', options);
    await page.setContent('<meta name="viewport" content="width=device-width, initial-scale=1"><aviation-data-panel airports="KOAK KSFO"></aviation-data-panel>');
    await page.addScriptTag({ content: asset });
    return { page, panel: page.locator('aviation-data-panel'), ...fixture };
  }
  await t.test('context, multiline TAF, UTC, units/nulls, safe text and all six paginated reference collections', async t => {
    const { page, panel, calls, raw } = await setup(t);
    assert.equal(calls.length, 0);
    await exerciseAviationDataPanel(page, 'widget-test', 'KOAK KSFO');
    assert.equal(await panel.getByRole('article', { name: 'KOAK route weather' }).locator('pre').textContent(), raw('KOAK'));
    assert.match(await panel.locator('section').innerText(), /2026-11-14 11:30:00 UTC/);
    assert.deepEqual(calls[0].body.airports, ['KOAK', 'KSFO']);
    assert.equal(calls[0].body.include_metars, true);
    await panel.locator('summary').filter({ hasText: 'FAA NAS airport events' }).click();
    await panel.getByText('Synthetic airport closure', { exact: true }).waitFor();
    await panel.locator('summary').filter({ hasText: 'NWS surface forecast' }).click();
    await panel.getByText('<img src=x onerror="window.injected=true"> Synthetic forecast text', { exact: true }).waitFor();
    assert.equal(await panel.locator('img').count(), 0);
    assert.equal(await page.evaluate(() => window.injected), undefined);
    for (const resource of ['airspaces', 'navaids', 'reporting-points', 'hotspots', 'obstacles']) {
      await panel.getByLabel('Collection').selectOption(resource);
      await panel.getByRole('button', { name: 'Find reference data' }).click();
      await panel.getByRole('heading', { name: 'Synthetic ' + resource, exact: true }).waitFor();
    }
    await panel.getByRole('button', { name: 'Next page' }).click();
    await panel.getByRole('heading', { name: /Page 2/ }).waitFor();
    await panel.getByRole('button', { name: 'Previous page' }).click();
    await panel.getByRole('heading', { name: /Page 1/ }).waitFor();
  });
  await t.test('single airport, UTC validity selection and mobile layout', async t => {
    const { page, panel, calls } = await setup(t, {}, { width: 390, height: 844 });
    await panel.evaluate(node => { node.setAttribute('airports', 'SFO'); node.setAttribute('valid-at', '2026-11-14T13:00:00+01:00'); });
    await exerciseAviationDataPanel(page, 'widget-test', 'SFO');
    assert.deepEqual(calls[0].body.airports, ['SFO', 'SFO']);
    assert.equal(calls[0].body.valid_at, '2026-11-14T12:00:00.000Z');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: '/tmp/aviation-data-mobile.png', fullPage: true });
  });
  await t.test('partial, missing reports and catalog omissions stay explicit', async t => {
    const { page, panel } = await setup(t, { route: data => ({ ...data, partial: true, truncated: true, discovery_limited: true,
      source: { ...data.source, unlocated_taf_station_ids: ['XXXX'] }, stations: [{ ...data.stations[0], taf: { status: 'unavailable', reports: [], source: data.source } }] }) });
    await panel.getByRole('button', { name: 'Load aviation data' }).click();
    await panel.getByText('Partial briefing:', { exact: false }).waitFor();
    await panel.getByText(/Results are truncated/).waitFor();
    await panel.getByText(/Unlocated TAF stations: XXXX/).waitFor();
    await panel.getByText('Provider unavailable. Reports could not be retrieved.').waitFor();
    await panel.getByText('No reports available.', { exact: true }).waitFor();
    await page.screenshot({ path: '/tmp/aviation-data-desktop.png', fullPage: true });
  });
  await t.test('one source failure leaves successful route reports usable', async t => {
    const { panel } = await setup(t, { failPath: '/aviation-data/nws/alerts' });
    await panel.getByRole('button', { name: 'Load aviation data' }).click();
    await panel.getByRole('article', { name: 'KOAK route weather' }).waitFor();
    await panel.locator('summary').filter({ hasText: 'NWS active alerts' }).click();
    await panel.getByText(/Provider request unavailable \(HTTP 503\)/).waitFor();
  });
  await t.test('route failure differs from an empty successful briefing', async t => {
    const { panel } = await setup(t, { failPath: '/aviation-weather/route' });
    await panel.getByRole('button', { name: 'Load aviation data' }).click();
    await panel.getByText(/Route reports could not be loaded/).waitFor();
    assert.equal(await panel.locator('article').count(), 0);
  });
  await t.test('context changes abort stale responses and clear results', async t => {
    const { page, panel } = await setup(t, { delay: 250 });
    await panel.getByRole('button', { name: 'Load aviation data' }).click();
    await panel.evaluate(node => node.setAttribute('airports', 'KJFK'));
    await page.waitForTimeout(400);
    assert.equal(await panel.locator('article').count(), 0);
    assert.match(await panel.locator('.status').textContent(), /Context changed/);
    await panel.getByRole('button', { name: 'Load aviation data' }).click();
    await panel.getByRole('article', { name: 'KJFK route weather' }).waitFor();
    await panel.getByLabel('Route airports, in order').fill('KDEN');
    assert.equal(await panel.locator('article').count(), 0);
  });
  await t.test('data review inside a booking form does not submit or change its dispatch decision', async t => {
    const { page, panel } = await setup(t);
    await panel.evaluate(node => {
      const form = document.createElement('form');
      form.innerHTML = '<label><input type="checkbox" name="dispatch" checked>Dispatch approved by pilot</label>';
      node.replaceWith(form); form.append(node);
      form.addEventListener('submit', event => { event.preventDefault(); window.bookingSubmitted = true; });
    });
    await panel.getByRole('button', { name: 'Load aviation data' }).click();
    await panel.getByRole('article', { name: 'KOAK route weather' }).waitFor();
    assert.equal(await page.getByLabel('Dispatch approved by pilot').isChecked(), true);
    assert.equal(await page.evaluate(() => window.bookingSubmitted), undefined);
  });
  await t.test('invalid route and unbounded reference queries make no provider calls', async t => {
    const { panel, calls } = await setup(t);
    await panel.getByLabel('Route airports, in order').fill('INVALID');
    await panel.getByRole('button', { name: 'Load aviation data' }).click();
    await panel.getByText(/Enter 1–50 ICAO/).waitFor();
    await panel.locator('.references > summary').click();
    await panel.getByRole('button', { name: 'Find reference data' }).click();
    await panel.getByText(/Enter a two-letter country/).waitFor();
    assert.equal(calls.length, 0);
  });
});
