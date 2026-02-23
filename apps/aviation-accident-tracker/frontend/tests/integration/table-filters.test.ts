// apps/aviation-accident-tracker/frontend/tests/integration/table-filters.test.ts

import { describe, test, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/App';
import { setupServer } from 'msw/node';
import { rest } from 'msw';

const server = setupServer(
  rest.get('/api/events', (req, res, ctx) => {
    return res(ctx.json({
      events: [
        { id: 1, category: 'Commercial', date_time: '2025-01-01T12:00:00Z' },
        { id: 2, category: 'Private', date_time: '2025-01-02T12:00:00Z' }
      ],
      total: 2,
      page: 1,
      limit: 10
    }));
  })
);

beforeAll(() => server.listen());
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

describe('Table Filters Integration Tests', () => {
  test('filters events by category', async () => {
    render(<App />);

    // Select category filter
    const categoryFilter = screen.getByLabelText(/Category/);
    userEvent.selectOptions(categoryFilter, 'Commercial');

    // Wait for filtered events
    const events = await screen.findAllByText(/Commercial/);
    expect(events).toHaveLength(1);
  });

  test('filters events by date range', async () => {
    render(<App />);

    // Set date range filter
    const dateFromInput = screen.getByLabelText(/Date From/);
    const dateToInput = screen.getByLabelText(/Date To/);
    userEvent.type(dateFromInput, '2025-01-01');
    userEvent.type(dateToInput, '2025-01-01');

    // Wait for filtered events
    const events = await screen.findAllByText(/2025-01-01/);
    expect(events).toHaveLength(1);
  });
});
