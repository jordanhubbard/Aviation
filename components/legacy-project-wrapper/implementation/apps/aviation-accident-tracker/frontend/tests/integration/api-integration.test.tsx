import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from '../../src/App';

const eventsPayload = {
  data: [
    {
      id: '10',
      dateZ: '2025-01-01T12:00:00Z',
      registration: 'G-ABCD',
      aircraftType: 'Cessna 172',
      operator: 'Acme Flying Club',
      category: 'general',
      airportIcao: 'EGLL',
      country: 'UK',
      region: 'England',
      lat: 51.4775,
      lon: -0.4614,
      summary: 'Landing gear issue',
      sources: [],
    },
    {
      id: '11',
      dateZ: '2025-01-02T14:00:00Z',
      registration: 'N-99999',
      aircraftType: 'Boeing 737',
      operator: 'BritAir',
      category: 'commercial',
      airportIcao: 'KJFK',
      country: 'USA',
      region: 'NY',
      lat: 40.6413,
      lon: -73.7781,
      summary: 'Engine anomaly',
      sources: [],
    },
  ],
};

describe('API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn((url: RequestInfo | URL) => {
      const s = url.toString();
      if (s.includes('/api/events?')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(eventsPayload) } as Response);
      }
      if (s.includes('/api/filters/options')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ countries: ['UK', 'USA'], regions: ['England', 'NY'] }),
        } as Response);
      }
      if (s.includes('/api/filters/options')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ countries: [], regions: [] }) } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
    }) as typeof fetch;
  });

  test('displays events fetched from API', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('G-ABCD')).toBeInTheDocument();
      expect(screen.getByText('N-99999')).toBeInTheDocument();
    });
  });

  test('displays aircraft type and operator from API response', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Cessna 172')).toBeInTheDocument();
      expect(screen.getByText('BritAir')).toBeInTheDocument();
    });
  });

  test('fetch is called with correct API endpoint', async () => {
    render(<App />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/events'),
      );
    });
  });

  test('handles API errors gracefully without crashing', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as typeof fetch;

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeInTheDocument();
    });
  });
});
