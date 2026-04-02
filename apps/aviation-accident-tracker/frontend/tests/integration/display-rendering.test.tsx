import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from '../../src/App';

describe('Display Rendering Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn((url: RequestInfo | URL) => {
      const s = url.toString();
      if (s.includes('/api/events?')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                {
                  id: '20',
                  dateZ: '2025-03-01T09:00:00Z',
                  registration: 'VH-XYZ',
                  aircraftType: 'Piper PA-28',
                  operator: 'Down Under Aviation',
                  category: 'general',
                  airportIcao: 'YSSY',
                  country: 'AUS',
                  region: 'NSW',
                  lat: -33.9461,
                  lon: 151.177,
                  summary: 'Bird strike on climbout',
                  sources: [],
                },
              ],
            }),
        } as Response);
      }
      if (s.includes('/api/filters/options')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ countries: [], regions: [] }) } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
    }) as typeof fetch;
  });

  test('renders the page title', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /aviation accident tracker/i })).toBeInTheDocument();
  });

  test('renders filter controls on load', async () => {
    render(<App />);
    expect(screen.getByPlaceholderText('registration/operator/summary')).toBeInTheDocument();
    expect(screen.getByLabelText(/Category/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Country/)).toBeInTheDocument();
  });

  test('renders event list with data from API', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('VH-XYZ')).toBeInTheDocument();
      expect(screen.getByText('Down Under Aviation')).toBeInTheDocument();
      expect(screen.getByText('Piper PA-28')).toBeInTheDocument();
    });
  });

  test('renders pagination controls', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Page 1')).toBeInTheDocument();
      expect(screen.getByText('Prev')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
    });
  });

  test('renders the map container', () => {
    render(<App />);
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });
});
