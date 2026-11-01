import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const providers = vi.hoisted(() => ({ weather: vi.fn(), notams: vi.fn() }));
vi.mock('@aviation/shared-sdk', async (original) => ({
  ...await original<typeof import('@aviation/shared-sdk')>(),
  fetchMetarRaw: providers.weather,
  NotamClient: class { fetchByIcao = providers.notams; },
}));
import { WeatherBriefingService } from '../src/service';

let service: WeatherBriefingService;
beforeEach(() => {
  providers.weather.mockReset().mockResolvedValue('KSFO 011200Z 27005KT 10SM FEW020 18/12 A2992');
  providers.notams.mockReset().mockResolvedValue([]);
  service = new WeatherBriefingService({ name: 'reconciliation', autoStart: false });
});
afterEach(async () => { if (service.getStatus() === 'running') await service.stop(); });

it('reports an empty NOTAM result without inventing records', async () => {
  expect(await service.generateBriefing('KSFO')).toContain('NOTAMs: None active');
  expect(providers.notams).toHaveBeenCalledWith('KSFO');
});

it('preserves weather when the NOTAM provider fails', async () => {
  providers.notams.mockRejectedValue(new Error('offline'));
  const briefing = await service.generateBriefing('KSFO');
  expect(briefing).toContain('METAR: KSFO');
  expect(briefing).toContain('NOTAMs: unavailable');
});

it('lists active NOTAMs in severity order', async () => {
  providers.notams.mockResolvedValue([
    { severity: 'low', text: 'Information', category: 'Other' },
    { severity: 'critical', text: 'Runway closed', category: 'Runway' },
  ]);
  const briefing = await service.generateBriefing('KSFO');
  expect(briefing).toContain('NOTAMs (2 active)');
  expect(briefing.indexOf('Runway closed')).toBeLessThan(briefing.indexOf('Information'));
});

it('does not fetch NOTAMs when weather is unavailable', async () => {
  providers.weather.mockResolvedValue(null);
  expect(await service.generateBriefing('KSFO')).toBe('No weather data available for KSFO.');
  expect(providers.notams).not.toHaveBeenCalled();
});

it('clears cached weather when stopped', async () => {
  await service.start();
  await service.generateBriefing('KSFO');
  expect(service.getAirportConditions('KSFO')).toBeDefined();
  await service.stop();
  expect(service.getAirportConditions('KSFO')).toBeUndefined();
});
