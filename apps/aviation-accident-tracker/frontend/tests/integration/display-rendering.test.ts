// apps/aviation-accident-tracker/frontend/tests/integration/display-rendering.test.ts

import { describe, test, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../src/App';


describe('Display Rendering Integration Tests', () => {
  beforeAll(() => {
    render(<App />);
  });

  test('renders event list with mock data', async () => {
    const mockEvents = [
      { id: 1, category: 'Commercial', date_time: '2025-01-01T12:00:00Z' },
      { id: 2, category: 'Private', date_time: '2025-01-02T12:00:00Z' }
    ];

    // Mock API response
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ events: mockEvents })
      })
    );

    render(<App />);

    // Wait for events to be displayed
    const events = await screen.findAllByText(/Commercial|Private/);
    expect(events).toHaveLength(2);
  });
});
