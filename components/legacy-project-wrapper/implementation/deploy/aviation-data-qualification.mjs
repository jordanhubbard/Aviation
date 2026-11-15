// Browser-only synthetic fixtures; these never contact or impersonate a live provider.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
export const assetUrl = 'https://meta-app.jordanhubbard.net/aviation-data.js';
export const apiUrl = 'https://meta-app.jordanhubbard.net/api/v1/planning/api';
export const asset = readFileSync(new URL('../apps/meta-app/public/aviation-data.js', import.meta.url), 'utf8');
export async function installAviationDataFixtures(page, runId, options = {}) {
  const calls = [];
  const source = { provider: `Synthetic application fixture ${runId}`, retrieved_at_utc: '2026-11-14T12:00:00Z', license: 'Synthetic test data' };
  const raw = station => `TAF ${station} 141130Z 1412/1512 18010KT P6SM SCT030\n  TEMPO 1418/1422 3SM TSRA BKN020CB`;
  await page.route(assetUrl, route => route.fulfill({ contentType: 'text/javascript', body: asset }));
  await page.route(apiUrl + '/**', async route => {
    const req = route.request(); const url = new URL(req.url());
    if (req.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' } }); return; }
    const path = url.pathname.slice(new URL(apiUrl).pathname.length);
    const body = req.method() === 'POST' ? req.postDataJSON() : null;
    calls.push({ path, method: req.method(), body, query: Object.fromEntries(url.searchParams) });
    const base = { is_test_data: true, test_run_id: runId, source, limitations: 'Synthetic coverage only', truncated: false };
    let response;
    if (path === '/aviation-weather/route' && req.method() === 'POST') {
      const ids = [...new Set(body.airports)];
      response = { ...base, resolved_airports: ids.map(station_id => ({ station_id, latitude: 37.7, longitude: -122.2 })),
        stations: ids.map((station_id, index) => ({ station_id, requested_airport: true, latitude: 37.7, longitude: -122.2, distance_from_route_nm: 0, closest_leg: index,
          valid_at_status: 'not_requested', taf: { source, status: 'available', reports: [{ rawTAF: raw(station_id), issueTime: '2026-11-14T11:30:00Z', validTimeFrom: 1794657600, validTimeTo: 1794744000 }] },
          metar: { source, status: 'no_reports', reports: [] } })), partial: false, discovery_limited: false };
      if (options.route) response = options.route(response);
      if (options.delay) await new Promise(resolve => setTimeout(resolve, options.delay));
    } else if (path === '/aviation-weather/winds-aloft') {
      response = { ...base, levels_hpa: [850], data: { hourly: { time: ['2026-11-14T12:00'], wind_speed_850hPa: [null], wind_direction_850hPa: [180], temperature_850hPa: [4], geopotential_height_850hPa: [1500] }, hourly_units: { wind_speed_850hPa: 'kn', wind_direction_850hPa: '°', temperature_850hPa: '°C', geopotential_height_850hPa: 'm' } } };
    } else if (path === '/aviation-data/nws/forecast') {
      response = { ...base, data: { properties: { periods: [{ name: 'Synthetic afternoon', startTime: '2026-11-14T12:00:00Z', endTime: '2026-11-14T13:00:00Z', temperature: null, temperatureUnit: 'F', windDirection: 'S', windSpeed: '10 mph', detailedForecast: '<img src=x onerror="window.injected=true"> Synthetic forecast text' }] } } };
    } else if (path === '/aviation-weather/stations') {
      response = { ...base, stations: [{ station_id: 'KLVK', name: 'Synthetic nearby airport', distance_from_route_nm: 10 }] };
    } else if (path === '/aviation-data/sources') {
      response = { sources: [{ provider: 'openAIP', configured: false, coverage: 'Synthetic worldwide', license: 'CC BY-NC 4.0', limitations: 'Synthetic missing credential' }] };
    } else if (/^\/aviation-data\/openaip\/(airports|airspaces|navaids|reporting-points|hotspots|obstacles)$/.test(path)) {
      const pageNumber = Number(url.searchParams.get('page'));
      response = { ...base, records: [{ name: 'Synthetic ' + path.split('/').at(-1), elevation: null }], total_count: 30, page: pageNumber, next_page: pageNumber === 1 ? 2 : null };
    } else if (path === '/aviation-data/faa/airport-events') {
      response = { ...base, records: [{ airportId: 'OAK', airportLongName: 'Synthetic Oakland', airportClosure: { simpleText: 'Synthetic airport closure', startTime: '2026-11-14T12:00:00Z', endTime: '2026-11-14T13:00:00Z' } }] };
    } else if (['/aviation-data/nws/alerts', '/aviation-data/faa/airport-events', '/aviation-weather/cwa'].includes(path)) {
      response = { ...base, records: [], status: 'no_reports' };
    } else { throw new Error(`Unexpected aviation data request ${req.method()} ${path}`); }
    assert.equal(req.method(), path === '/aviation-weather/route' ? 'POST' : 'GET');
    const status = options.failPath === path ? 503 : 200;
    await route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(status === 200 ? response : { detail: 'Synthetic provider failure' }) });
  });
  return { calls, raw };
}
export async function exerciseAviationDataPanel(page, runId, expectedAirports) {
  const panel = page.locator('aviation-data-panel').first();
  await panel.getByRole('heading', { name: 'Aviation data review', exact: true }).waitFor();
  const airportInput = panel.getByLabel('Route airports, in order');
  if (expectedAirports) assert.equal(await airportInput.inputValue(), expectedAirports);
  else await airportInput.fill('KOAK KSFO');
  const first = (await airportInput.inputValue()).split(' ')[0];
  await panel.getByRole('button', { name: 'Load aviation data' }).click();
  await panel.getByRole('article', { name: `${first} route weather` }).getByText(/TEMPO 1418\/1422/).waitFor();
  await panel.getByText(`Synthetic application fixture ${runId}`, { exact: false }).first().waitFor();
  const winds = panel.locator('details').filter({ has: page.locator('summary', { hasText: 'Modeled winds aloft' }) }).first();
  await winds.locator('summary').click(); await winds.getByRole('cell', { name: 'Unknown kn', exact: true }).waitFor();
  await panel.locator('.references > summary').click(); await panel.getByLabel('Country (two-letter code)').fill('US');
  await panel.getByRole('button', { name: 'Find reference data' }).click();
  await panel.getByRole('heading', { name: 'Synthetic airports', exact: true }).waitFor();
  await panel.locator('.sources > summary').click(); await panel.getByRole('button', { name: 'Check source configuration' }).click();
  await panel.getByText('Not configured', { exact: true }).waitFor();
  return panel;
}
