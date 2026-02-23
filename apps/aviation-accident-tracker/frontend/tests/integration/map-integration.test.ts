// apps/aviation-accident-tracker/frontend/tests/integration/map-integration.test.ts

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
        { id: 1, category: 'Commercial', date_time: '2025-01-01T12:00:00Z', location: 'Location1' },
        { id: 2, category: 'Private', date_time: '2025-01-02T12:00:00Z', location: 'Location2' }
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

describe('Map Integration Tests', () => {
  test('displays events on the map', async () => {
    render(<App />);

    // Wait for map markers
    const markers = await screen.findAllByRole('img', { name: /marker/i });
    expect(markers).toHaveLength(2);
  });

  test('filters map markers by category', async () => {
    render(<App />);

    // Select category filter
    const categoryFilter = screen.getByLabelText(/Category/);
    userEvent.selectOptions(categoryFilter, 'Commercial');

    // Wait for filtered map markers
    const markers = await screen.findAllByRole('img', { name: /marker/i });
    expect(markers).toHaveLength(1);
  });
});
