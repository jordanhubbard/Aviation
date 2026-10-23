import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from '../../src/App';

describe('Alert/Error Display Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('shows error message when API call fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as typeof fetch;

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeInTheDocument();
    });
  });

  test('shows loading state while fetching', () => {
    global.fetch = vi.fn(() => new Promise(() => {})) as typeof fetch;

    render(<App />);

    expect(screen.getByText('Loading events…')).toBeInTheDocument();
  });

  test('shows no-events message when API returns empty array', async () => {
    global.fetch = vi.fn((url: RequestInfo | URL) => {
      const s = url.toString();
      if (s.includes('/api/events')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) } as Response);
      }
      if (s.includes('/api/filters/options')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ countries: [], regions: [] }) } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
    }) as typeof fetch;

    render(<App />);

    await waitFor(() => {
      expect(screen.queryByText('Loading events…')).not.toBeInTheDocument();
    });
    expect(screen.getByText(/No events found for current filters/)).toBeInTheDocument();
  });
});
