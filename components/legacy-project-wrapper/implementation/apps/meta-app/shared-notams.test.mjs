import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import {launchOwnedBrowser} from '../../deploy/browser-runner.mjs';
import { asset, installAviationDataFixtures } from '../../deploy/aviation-data-qualification.mjs';

const snapshot = 'a'.repeat(64);
const notice = (i = 0) => ({ id: `synthetic-${i}`, number: `TEST-${i}`, series: 'TEST', year: '2026',
  location: 'KOAK', icao_location: 'KOAK', text: '<img src=x onerror="window.injected=true"> SYNTHETIC REPLACEMENT\nSecond line', text_length: 2500, text_truncated: true,
  detail_url: 'https://untrusted.invalid/must-not-follow', classification: 'DOMESTIC', type: 'R', activity: 'schedule_requires_review',
  effective_start_utc: '2026-11-17T00:00:00Z', effective_end_utc: null, cancelled_at_utc: null, last_updated_utc: '2026-11-17T01:00:00Z',
  permanent: true, estimated: false, schedule: 'Daily schedule requires review', missing_fields: ['effective_end'], severity: 'high' });
const reports = airport => ({ snapshot_id: snapshot, status: 'available', environment: 'production', production_data: true, complete_snapshot: true,
  requested_locations: [airport], matched_locations: ['KOAK', 'OAK'], source: { provider: 'FAA NMS', environment: 'production', retrieved_at_utc: '2026-11-17T01:00:00Z' },
  synchronized_at: '2026-11-17T01:00:00Z', full_load_at: '2026-11-16T01:00:00Z', incomplete_records: 0, total: 1, offset: 0, limit: 20, next_offset: null,
  notams: [notice()], warnings: ['Synthetic exact source matching only.'], error: null });
const detail = id => ({ snapshot_id: snapshot, status: 'available', environment: 'production', production_data: true,
  source: reports('KOAK').source, notice: { ...notice(), id, text: 'SYNTHETIC FULL ORIGINAL\n' + 'source-only '.repeat(250), text_truncated: false },
  source_feature: { type: 'Feature', properties: { replaces: 'previous-synthetic-notice', literal: '<script>not executable</script>' } }, warnings: ['Synthetic source warning.'] });

test('shared NMS panel preserves status, snapshots, source detail and explicit ownership', async t => {
  const browser = await launchOwnedBrowser(chromium,{ headless: true }); t.after(() => browser.close());
  async function setup(t, respond = null, viewport = { width: 1280, height: 900 }) {
    const page = await browser.newPage({ viewport }); page.setDefaultTimeout(5000); t.after(() => page.close());
    const errors = [], calls = []; page.on('pageerror', e => errors.push(e.message)); t.after(() => assert.deepEqual(errors, []));
    await installAviationDataFixtures(page, 'shared-notam-test');
    await page.route('https://meta-app.jordanhubbard.net/api/v1/planning/api/notams**', async route => {
      const url = new URL(route.request().url()); calls.push(url);
      const result = respond ? await respond(url) : { body: url.pathname.endsWith('/detail') ? detail(url.searchParams.get('id')) : reports(url.searchParams.get('airport')) };
      await route.fulfill({ status: result.status || 200, contentType: 'application/json', body: JSON.stringify(result.body), headers: { 'access-control-allow-origin': '*' } });
    });
    await page.setContent('<meta name="viewport" content="width=device-width, initial-scale=1"><aviation-data-panel airports="KOAK KSFO"></aviation-data-panel>');
    await page.addScriptTag({ content: asset });
    return { page, panel: page.locator('aviation-data-panel'), calls };
  }
  await t.test('startup, weather/source loads and point changes never implicitly request NOTAMs', async t => {
    const { panel, calls } = await setup(t);
    assert.equal(await panel.getByLabel('NOTAM source location', { exact: true }).inputValue(), 'KOAK'); assert.equal(calls.length, 0);
    await panel.getByRole('button', { name: 'Load aviation data', exact: true }).click();
    await panel.getByRole('article', { name: 'KOAK route weather' }).waitFor();
    await panel.locator('.sources > summary').click(); await panel.getByRole('button', { name: 'Check source configuration' }).click();
    await panel.getByText('Synthetic missing credential', { exact: true }).waitFor();
    await panel.getByLabel('Weather review point', { exact: true }).selectOption({ label: 'KSFO' });
    assert.equal(await panel.getByLabel('NOTAM source location', { exact: true }).inputValue(), 'KSFO'); assert.equal(calls.length, 0);
  });
  await t.test('source text/type/permanence/schedule and full replacement record remain literal and explicit', async t => {
    const { page, panel, calls } = await setup(t);
    await panel.getByRole('button', { name: 'Load cached NOTAMs', exact: true }).click();
    await panel.getByRole('article', { name: 'NOTAM synthetic-0', exact: true }).waitFor();
    const out = panel.locator('.notam-results'); assert.match(await out.innerText(), /Source type R.*schedule_requires_review/);
    assert.match(await out.innerText(), /PERMANENT/); assert.match(await out.innerText(), /Missing source fields: effective_end/);
    assert.equal(await out.locator('img').count(), 0); assert.equal(await page.evaluate(() => window.injected), undefined);
    await panel.getByRole('button', { name: 'Read full source notice', exact: true }).click();
    await panel.getByRole('heading', { name: 'Full original source notice', exact: true }).waitFor();
    assert.equal(calls[1].searchParams.get('snapshot_id'), snapshot); assert.match(await out.innerText(), /SYNTHETIC FULL ORIGINAL/);
    await panel.getByText('Original source record', { exact: true }).click(); assert.match(await out.innerText(), /previous-synthetic-notice/);
    assert.equal(await out.locator('script').count(), 0); assert.equal(calls.every(url => url.origin === 'https://meta-app.jordanhubbard.net'), true);
    assert.match(await out.innerText(), /Complete snapshot: yes/); assert.match(await out.innerText(), /Matched source aliases: KOAK, OAK/);
  });
  for (const status of ['no_reports', 'partial', 'stale', 'unavailable']) await t.test(`${status} is distinct from absent applicable NOTAMs`, async t => {
    const { panel } = await setup(t, url => { const value = reports(url.searchParams.get('airport')); return { body: { ...value, status,
      ...(status === 'no_reports' || status === 'unavailable' ? { notams: [], total: 0 } : {}),
      ...(status === 'unavailable' ? { complete_snapshot: false, production_data: false, snapshot_id: null } : {}),
      ...(status === 'partial' ? { incomplete_records: 1 } : {}) } }; });
    await panel.getByRole('button', { name: 'Load cached NOTAMs', exact: true }).click();
    await panel.locator('.notam-status').filter({ hasText: `· ${status} ·` }).waitFor();
    assert.match(await panel.locator('.notam-results').innerText(), /Coverage is limited/);
    assert.equal(await panel.getByText(/No matching cached records for this selection/).count(), status === 'no_reports' ? 1 : 0);
  });
  for (const environment of ['staging', 'fit']) await t.test(`${environment} cannot imply production coverage`, async t => {
    const { panel } = await setup(t, url => { const data = reports(url.searchParams.get('airport')); return { body: { ...data, environment, production_data: false, source: { ...data.source, environment } } }; });
    await panel.getByRole('button', { name: 'Load cached NOTAMs', exact: true }).click();
    await panel.getByText(/Non-production or unselected feed/).waitFor(); assert.match(await panel.locator('.notam-results').innerText(), /Production feed data: no/);
  });
  await t.test('all navigation, including previous page zero, pins the snapshot and clears a changed total', async t => {
    let changed = false;
    const { panel, calls } = await setup(t, url => { const data = reports(url.searchParams.get('airport')), offset = Number(url.searchParams.get('offset')); return { body: { ...data, total: changed ? 22 : 21, offset, next_offset: offset ? null : 20, notams: offset ? [notice(20)] : Array.from({ length: 20 }, (_, i) => notice(i)) } }; });
    await panel.getByRole('button', { name: 'Load cached NOTAMs', exact: true }).click(); await panel.getByRole('button', { name: 'Next NOTAM page', exact: true }).click();
    await panel.getByRole('article', { name: 'NOTAM synthetic-20', exact: true }).waitFor(); assert.equal(calls[1].searchParams.get('snapshot_id'), snapshot);
    await panel.getByRole('button', { name: 'Previous NOTAM page', exact: true }).click(); await panel.getByRole('article', { name: 'NOTAM synthetic-0', exact: true }).waitFor();
    assert.equal(calls[2].searchParams.get('snapshot_id'), snapshot); assert.equal(calls[2].searchParams.get('offset'), '0');
    changed = true; await panel.getByRole('button', { name: 'Next NOTAM page', exact: true }).click();
    await panel.getByText(/NMS snapshot or coverage changed/).waitFor(); assert.equal(await panel.locator('.notam-results article').count(), 0);
  });
  for (const mutation of ['location', 'route', 'inactive', 'validity']) await t.test(`${mutation} changes abort and clear delayed notice/detail work`, async t => {
    const { page, panel } = await setup(t, async url => { await new Promise(r => setTimeout(r, 200)); return { body: reports(url.searchParams.get('airport')) }; });
    await panel.getByRole('button', { name: 'Load cached NOTAMs', exact: true }).click();
    if (mutation === 'location') await panel.getByLabel('NOTAM source location', { exact: true }).fill('KJFK');
    if (mutation === 'route') await panel.getByLabel('Route airports, in order', { exact: true }).fill('KJFK');
    if (mutation === 'inactive') await panel.getByLabel('Include cancelled and expired notices', { exact: true }).check();
    if (mutation === 'validity') await panel.evaluate(node => node.setAttribute('valid-at', '2026-11-18T00:00:00Z'));
    await page.waitForTimeout(300); assert.equal(await panel.locator('.notam-results article').count(), 0);
  });
  for (const mode of ['http', 'malformed', 'incomplete-available', 'wrong-location']) await t.test(`${mode} failure cannot establish a successful empty selection`, async t => {
    const { panel } = await setup(t, url => { const data = reports(url.searchParams.get('airport')); return mode === 'http' ? { status: 503, body: {} } : { body: mode === 'malformed' ? {} : { ...data, ...(mode === 'incomplete-available' ? { complete_snapshot: false } : { requested_locations: ['KJFK'] }) } }; });
    await panel.getByRole('button', { name: 'Load cached NOTAMs', exact: true }).click(); await panel.getByText(/Cached NOTAMs could not be reviewed/).waitFor();
    assert.equal(await panel.locator('.notam-results article').count(), 0); assert.equal(await panel.getByText(/No matching cached records/).count(), 0);
  });
  await t.test('snapshot-conflicting detail remains unavailable and detail selection recovers abandoned buttons', async t => {
    const { page, panel } = await setup(t, async url => {
      if (url.pathname.endsWith('/detail')) { await new Promise(r => setTimeout(r, 150)); return { body: { ...detail(url.searchParams.get('id')), snapshot_id: 'b'.repeat(64) } }; }
      return { body: { ...reports(url.searchParams.get('airport')), notams: [notice(0), notice(1)], total: 2 } };
    });
    await panel.getByRole('button', { name: 'Load cached NOTAMs', exact: true }).click();
    const buttons = panel.getByRole('button', { name: 'Read full source notice', exact: true }); await buttons.first().click(); await buttons.nth(1).click();
    assert.equal(await buttons.first().isDisabled(), false); await page.waitForTimeout(250); await panel.getByText(/NMS detail identity or coverage changed/).waitFor();
    assert.equal(await panel.getByRole('heading', { name: 'Full original source notice', exact: true }).count(), 0);
  });
  await t.test('a delayed detail is discarded after its selected airport changes', async t => {
    const { page, panel } = await setup(t, async url => {
      if (url.pathname.endsWith('/detail')) { await new Promise(r => setTimeout(r, 200)); return { body: detail(url.searchParams.get('id')) }; }
      return { body: reports(url.searchParams.get('airport')) };
    });
    await panel.getByRole('button', { name: 'Load cached NOTAMs', exact: true }).click(); await panel.getByRole('button', { name: 'Read full source notice', exact: true }).click();
    await panel.getByLabel('NOTAM source location', { exact: true }).fill('KJFK'); await page.waitForTimeout(300);
    assert.equal(await panel.locator('.notam-results article').count(), 0); assert.equal(await panel.getByRole('heading', { name: 'Full original source notice', exact: true }).count(), 0);
  });
  await t.test('disconnection aborts pending data and does not republish it on the detached element', async t => {
    const { page, panel } = await setup(t, async url => { await new Promise(r => setTimeout(r, 200)); return { body: reports(url.searchParams.get('airport')) }; });
    await panel.getByRole('button', { name: 'Load cached NOTAMs', exact: true }).click(); await panel.evaluate(node => { window.detachedPanel = node; node.remove(); });
    await page.waitForTimeout(300); assert.equal(await page.evaluate(() => window.detachedPanel.shadowRoot.querySelector('.notam-results').textContent), '');
  });
  for (const fault of ['missing-next', 'skipped-next', 'duplicate-identities']) await t.test(`${fault} cannot silently truncate a report page`, async t => {
    const { panel } = await setup(t, url => ({ body: { ...reports(url.searchParams.get('airport')), total: 21, notams: Array.from({ length: 20 }, (_, i) => notice(fault === 'duplicate-identities' ? 0 : i)), next_offset: fault === 'missing-next' ? null : fault === 'skipped-next' ? 25 : 20 } }));
    await panel.getByRole('button', { name: 'Load cached NOTAMs', exact: true }).click(); await panel.getByText(/Incomplete or inconsistent NOTAM pagination/).waitFor();
    assert.equal(await panel.locator('.notam-results article').count(), 0);
  });
  await t.test('cancelled and expired source semantics require an explicit inactive selection', async t => {
    const { panel, calls } = await setup(t, url => ({ body: { ...reports(url.searchParams.get('airport')), notams: [{ ...notice(), type: 'C', activity: 'cancelled', cancelled_at_utc: '2026-11-17T02:00:00Z' }] } }));
    await panel.getByLabel('Include cancelled and expired notices', { exact: true }).check(); assert.equal(calls.length, 0);
    await panel.getByRole('button', { name: 'Load cached NOTAMs', exact: true }).click(); await panel.getByRole('article', { name: 'NOTAM synthetic-0', exact: true }).waitFor();
    assert.equal(calls[0].searchParams.get('include_inactive'), 'true'); assert.match(await panel.locator('.notam-results').innerText(), /Source type C.*Activity cancelled/);
    assert.match(await panel.locator('.notam-results').innerText(), /Cancelled 2026-11-17 02:00:00 UTC/);
  });
  await t.test('mobile and an embedding booking form retain their decisions and do not submit', async t => {
    const { page, panel } = await setup(t, null, { width: 390, height: 844 });
    await panel.evaluate(node => { const form = document.createElement('form'); form.innerHTML = '<input type="checkbox" name="approved" checked aria-label="Pilot decision">'; node.replaceWith(form); form.append(node); form.addEventListener('submit', event => { event.preventDefault(); window.bookingSubmitted = true; }); });
    await panel.getByRole('button', { name: 'Load cached NOTAMs', exact: true }).click(); await panel.getByRole('article', { name: 'NOTAM synthetic-0', exact: true }).waitFor();
    assert.equal(await page.getByLabel('Pilot decision', { exact: true }).isChecked(), true); assert.equal(await page.evaluate(() => window.bookingSubmitted), undefined);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  });
});
