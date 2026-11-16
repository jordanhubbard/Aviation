import type { IncomingMessage, ServerResponse } from 'node:http';
import type { WeatherBriefingService } from './service';
import { normalizeStation } from './service';
import { defaultRegionId, getRegion } from './regions';

/** Legacy adapters retain wrappers and text while exposing both weather products. */
export async function handleWeatherApi(req: IncomingMessage, res: ServerResponse, service: WeatherBriefingService): Promise<boolean> {
  const url = new URL(req.url || '/', 'http://weather.local');
  if (!['/station', '/stations', '/briefing'].includes(url.pathname)) return false;
  const send = (status: number, body: unknown, text = false) => {
    res.writeHead(status, { 'Content-Type': text ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
      'Cache-Control': 'no-store', ...(status === 405 ? { Allow: 'GET' } : {}) });
    res.end(text ? String(body) : JSON.stringify(body));
  };
  if (req.method !== 'GET') { send(405, { error: 'method_not_allowed' }); return true; }
  let code: string;
  try {
    code = url.pathname === '/stations' ? '' : normalizeStation(url.searchParams.get(url.pathname === '/station' ? 'code' : 'station') ?? (url.pathname === '/briefing' ? 'KSFO' : ''));
  } catch { send(400, { error: 'invalid_station', message: 'Use a 3–4 character airport code.' }); return true; }
  try {
    if (url.pathname === '/stations') {
      const region = getRegion(url.searchParams.get('region') ?? defaultRegionId);
      send(200, { region: region.id, stations: await service.getStationSummaries(region.stations) });
    } else if (url.pathname === '/station') send(200, { station: await service.getStationSnapshot(code) });
    else {
      const requested = (url.searchParams.get('days') || '').split(',').map(Number).filter(n => [1, 3, 5, 7].includes(n));
      send(200, await service.generateBriefing(code, requested.length ? Math.max(...requested) : 0), true);
    }
  } catch { send(503, { error: 'weather_unavailable' }); }
  return true;
}
