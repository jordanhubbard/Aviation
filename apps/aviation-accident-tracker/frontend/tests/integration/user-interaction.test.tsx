import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/App';
import { mockEvents, mockFilterOptions } from '../../src/tests/mockData';

function makeFetch() {
  return vi.fn((url: RequestInfo | URL) => {
    const s = url.toString();
    if (s.includes('/api/events?')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: mockEvents }) } as Response);
    }
    if (s.includes('/api/filters/options')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFilterOptions) } as Response);
    }
    if (s.match(/\/api\/events\/\d+$/)) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockEvents[0]) } as Response);
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
  }) as typeof fetch;
}

describe('User Interaction Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = makeFetch();
  });

  test('clicking a table row opens the detail modal', async () => {
    const user = userEvent.setup();
    render(<App />);

    const cell = await screen.findByText('N12345');
    const row = cell.closest('tr');
    expect(row).not.toBeNull();
    await user.click(row!);

    await waitFor(() => {
      expect(screen.getByText(/Engine failure on approach/)).toBeInTheDocument();
    });
  });

  test('modal shows registration and operator in heading', async () => {
    const user = userEvent.setup();
    render(<App />);

    const cell = await screen.findByText('N12345');
    await user.click(cell.closest('tr')!);

    await waitFor(() => {
      expect(screen.getByText(/N12345 — Private Owner/)).toBeInTheDocument();
    });
  });

  test('closing modal removes event details from screen', async () => {
    const user = userEvent.setup();
    render(<App />);

    const cell = await screen.findByText('N12345');
    await user.click(cell.closest('tr')!);

    await waitFor(() => {
      expect(screen.getByText(/Engine failure on approach/)).toBeInTheDocument();
    });

    await user.click(screen.getByText('Close'));

    await waitFor(() => {
      expect(screen.queryByText(/Engine failure on approach/)).not.toBeInTheDocument();
    });
  });

  test('typing in search box does not crash the app', async () => {
    const user = userEvent.setup();
    render(<App />);

    const searchInput = await screen.findByPlaceholderText('registration/operator/summary');
    await user.type(searchInput, 'Cessna');

    expect(searchInput).toHaveValue('Cessna');
    // App should still be rendered with its heading
    expect(screen.getByRole('heading', { name: /aviation accident tracker/i })).toBeInTheDocument();
  });
});
