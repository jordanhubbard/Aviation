import { describe, expect, it } from 'vitest';
import { AirportDirectory } from '../airports.js';

const sample = [
  { icao: 'KSFO', iata: 'SFO', name: 'San Francisco International', country: 'US', region: 'CA', latitude: 37.6188, longitude: -122.375 },
  { icao: 'KJFK', iata: 'JFK', name: 'John F Kennedy International', country: 'US', region: 'NY', latitude: 40.6413, longitude: -73.7781 },
  { icao: 'EGLL', iata: 'LHR', name: 'London Heathrow', country: 'GB', region: 'ENG', latitude: 51.47, longitude: -0.4543 },
];

describe('AirportDirectory', () => {
  const dir = new AirportDirectory(sample);

  it('finds by ICAO/IATA', () => {
    expect(dir.find('KSFO')?.name).toMatch(/San Francisco/);
    expect(dir.find('lhr')?.icao).toBe('EGLL');
  });

  it('searches by name and region', () => {
    const results = dir.search('Francisco');
    expect(results.some((a) => a.icao === 'KSFO')).toBe(true);
    const gb = dir.search('GB');
    expect(gb.find((a) => a.icao === 'EGLL')).toBeDefined();
  });

  it('returns nearest airport for reverse lookup', () => {
    const nearSf = dir.reverse(37.6, -122.3);
    expect(nearSf?.icao).toBe('KSFO');
  });
});
