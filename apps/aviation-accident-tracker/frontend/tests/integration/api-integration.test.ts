// apps/aviation-accident-tracker/frontend/tests/integration/api-integration.test.ts

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

describe('API Integration Tests', () => {
  test('displays events fetched from API', async () => {
    render(<App />);

    // Wait for events to be displayed
    const events = await screen.findAllByText(/Commercial|Private/);
    expect(events).toHaveLength(2);
  });

  test('handles API errors gracefully', async () => {
    server.use(
      rest.get('/api/events', (req, res, ctx) => {
        return res(ctx.status(500));
      })
    );

    render(<App />);

    // Wait for error message
    const errorMessage = await screen.findByText(/Error fetching events/);
    expect(errorMessage).toBeInTheDocument();
  });
});
