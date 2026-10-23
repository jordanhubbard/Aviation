import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/App';
import { mockEvents, mockFilterOptions } from '../../src/tests/mockData';

function makeFetch(events = mockEvents) {
  return vi.fn((url: RequestInfo | URL) => {
    const s = url.toString();
    if (s.includes('/api/events?')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: events }) } as Response);
    }
    if (s.includes('/api/filters/options')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFilterOptions) } as Response);
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
  }) as typeof fetch;
}

describe('Pagination Navigation Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = makeFetch();
  });

  test('starts on page 1', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Page 1')).toBeInTheDocument();
    });
  });

  test('Prev button is disabled on page 1', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Prev')).toBeDisabled();
    });
  });

  test('Next button is enabled on page 1', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Next')).not.toBeDisabled();
    });
  });

  test('clicking Next advances to page 2', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => expect(screen.getByText('Page 1')).toBeInTheDocument());

    await user.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(screen.getByText('Page 2')).toBeInTheDocument();
    });
  });

  test('Prev is enabled after advancing to page 2', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => expect(screen.getByText('Next')).toBeInTheDocument());
    await user.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(screen.getByText('Prev')).not.toBeDisabled();
    });
  });
});
