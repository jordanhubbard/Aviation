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

describe('Table Filters Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = makeFetch();
  });

  test('search filter sends search param to API', async () => {
    const user = userEvent.setup();
    render(<App />);

    const searchInput = await screen.findByPlaceholderText('registration/operator/summary');
    await user.type(searchInput, 'Cessna');

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('search=Cessna'),
      );
    });
  });

  test('category filter sends category param to API', async () => {
    const user = userEvent.setup();
    render(<App />);

    const categorySelect = await screen.findByLabelText(/Category/);
    await user.selectOptions(categorySelect, 'general');

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('category=general'),
      );
    });
  });

  test('country filter sends country param to API', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => expect(screen.getByLabelText(/Country/)).toBeInTheDocument());
    const countrySelect = screen.getByLabelText(/Country/);
    await user.selectOptions(countrySelect, 'USA');

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('country=USA'),
      );
    });
  });

  test('Clear button resets filters', async () => {
    const user = userEvent.setup();
    render(<App />);

    const searchInput = await screen.findByPlaceholderText('registration/operator/summary');
    await user.type(searchInput, 'test');
    expect(searchInput).toHaveValue('test');

    await user.click(screen.getByText('Clear'));

    expect(searchInput).toHaveValue('');
  });

  test('from/to date filters are rendered', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByLabelText(/From/)).toBeInTheDocument();
      expect(screen.getByLabelText(/To/)).toBeInTheDocument();
    });
  });
});
