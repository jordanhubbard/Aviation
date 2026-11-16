import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { WeatherBriefingService } = require('../dist/service.js');
const source = { provider: 'Synthetic test provider', url: 'https://example.invalid', retrieved_at_utc: '2026-11-16T00:00:00Z' };
const product = (name, station = 'KSFO') => ({ status: 'available', source, reports: [{ icaoId: station,
  ...(name === 'metar' ? { rawOb: `${station} 160000Z 27005KT 10SM FEW020 18/12 A2992`, reportTime: source.retrieved_at_utc } :
    { rawTAF: `TAF ${station} 160000Z 1600/1700 P6SM\n FM160600 26008KT BKN030`, issueTime: source.retrieved_at_utc,
      validTimeFrom: 1794787200, validTimeTo: 1794873600 }) }] });
function fixture(reports = async (name, code) => product(name, code)) {
  const calls = [];
  const service = new WeatherBriefingService({ autoStart: false, reports,
    notamClient: { fetchByIcao: async code => { calls.push(code); return []; } } });
  return { service, calls };
}
test('station/list/text preserve METARs and expose original TAFs, source times and map metadata', async () => {
  const { service } = fixture();
  const station = await service.getStationSnapshot('ksfo');
  assert.match(station.metar, /^KSFO/); assert.equal(station.taf.reports[0].rawTAF, product('taf').reports[0].rawTAF);
  assert.equal(station.metar_reports.source, source); assert.equal(station.category, 'VFR');
  assert.ok(Number.isFinite(station.latitude)); assert.ok(station.updatedAt);
  assert.deepEqual(await service.getStationSummaries(['KSFO']), [station]);
  const text = await service.generateBriefing('KSFO', 7);
  for (const part of ['METAR observation:', 'TAF forecast:', 'Valid 2026-', 'Retrieved 2026-', '\n FM160600', 'does not extend published TAF validity', 'NOTAMs: None active']) assert.ok(text.includes(part), part);
});
test('TAF failure and no-report states preserve METAR; missing METAR preserves TAF', async () => {
  for (const status of ['unavailable', 'no_reports']) {
    const { service } = fixture(async (name, code) => name === 'taf' ? { status, reports: [], source } : product(name, code));
    const station = await service.getStationSnapshot('KSFO');
    assert.match(station.metar, /^KSFO/); assert.equal(station.taf.status, status);
    assert.equal(station.partial, status === 'unavailable');
  }
  const { service } = fixture(async (name, code) => name === 'metar' ? { status: 'no_reports', reports: [], source } : product(name, code));
  const station = await service.getStationSnapshot('KSFO');
  assert.equal(station.metar, null); assert.equal(station.category, 'UNKNOWN');
  assert.match(await service.generateBriefing('KSFO'), /TAF KSFO/);
});
test('provider rejection does not relabel cached weather as current; stop clears state', async () => {
  const { service } = fixture(); await service.start();
  await service.getStationSnapshot('KSFO');
  service.getAirportConditions('KSFO').lastUpdated = new Date(0);
  service.reports = async () => { throw new Error('offline'); };
  const station = await service.getStationSnapshot('KSFO');
  assert.equal(station.metar, null); assert.equal(station.taf.status, 'unavailable'); assert.equal(station.partial, true);
  await service.stop(); assert.equal(service.getAirportConditions('KSFO'), undefined);
});
test('concurrent calls coalesce products and invalid codes never reach a provider', async () => {
  let count = 0;
  const { service } = fixture(async (name, code) => { count++; await new Promise(r => setTimeout(r, 5)); return product(name, code); });
  await Promise.all([service.getStationSnapshot('KSFO'), service.getStationSummaries(['KSFO'])]);
  assert.equal(count, 2);
  await assert.rejects(service.getStationSnapshot('../bad'));
  assert.equal(count, 2);
});
test('NOTAM failure preserves both products; active NOTAM severity order remains', async () => {
  const { service } = fixture();
  service.notamClient = { fetchByIcao: async () => { throw Error('offline'); } };
  assert.match(await service.generateBriefing('KSFO'), /NOTAMs: unavailable/);
  service.notamClient = { fetchByIcao: async () => [{ severity: 'low', text: 'Information' }, { severity: 'critical', text: 'Runway closed' }] };
  const text = await service.generateBriefing('KSFO');
  assert.ok(text.indexOf('Runway closed') < text.indexOf('Information'));
});
