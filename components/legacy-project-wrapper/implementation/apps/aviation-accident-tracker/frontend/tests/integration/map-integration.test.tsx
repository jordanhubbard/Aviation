import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from '../../src/App';

const twoPositionedEvents = {
  data: [
    {
      id: '30',
      dateZ: '2025-04-01T10:00:00Z',
      registration: 'D-EMAP',
      aircraftType: 'Airbus A320',
      operator: 'EuroAir',
      category: 'commercial',
      airportIcao: 'EDDF',
      country: 'DEU',
      region: 'Hesse',
      lat: 50.0379,
      lon: 8.5622,
      summary: 'Hydraulic issue',
      sources: [],
    },
    {
      id: '31',
      dateZ: '2025-04-02T11:00:00Z',
      registration: 'F-GKXJ',
      aircraftType: 'Cessna 172',
      operator: 'Paris Aero Club',
      category: 'general',
      airportIcao: 'LFPG',
      country: 'FRA',
      region: 'Ile-de-France',
      lat: 49.0097,
      lon: 2.5479,
      summary: 'Engine roughness',
      sources: [],
    },
    {
      id: '32',
      dateZ: '2025-04-03T12:00:00Z',
      registration: 'I-ABCD',
      aircraftType: 'Piper PA-28',
      operator: 'Rome Flying School',
      category: 'general',
      airportIcao: 'LIRF',
      country: 'ITA',
      region: 'Lazio',
      // No lat/lon — should NOT produce a marker
      summary: 'Hard landing',
      sources: [],
    },
  ],
};

describe('Map Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn((url: RequestInfo | URL) => {
      const s = url.toString();
      if (s.includes('/api/events?')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(twoPositionedEvents) } as Response);
      }
      if (s.includes('/api/filters/options')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ countries: [], regions: [] }) } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
    }) as typeof fetch;
  });

  test('renders the map container', () => {
    render(<App />);
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  test('renders markers only for events with coordinates', async () => {
    render(<App />);

    await waitFor(() => {
      const markers = screen.getAllByTestId('marker');
      // 3 events but only 2 have lat/lon
      expect(markers).toHaveLength(2);
    });
  });

  test('does not render marker for event without coordinates', async () => {
    render(<App />);

    await waitFor(() => {
      const markers = screen.getAllByTestId('marker');
      expect(markers.length).toBeLessThan(twoPositionedEvents.data.length);
    });
  });
});
