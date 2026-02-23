// apps/aviation-accident-tracker/frontend/tests/integration/menu-navigation.test.ts

import { describe, test, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/App';


describe('Menu Navigation Integration Tests', () => {
  beforeAll(() => {
    render(<App />);
  });

  test('navigates to different sections via menu', async () => {
    const menuButton = screen.getByRole('button', { name: /menu/i });
    userEvent.click(menuButton);

    const dashboardItem = await screen.findByText(/Dashboard/i);
    userEvent.click(dashboardItem);
    const dashboardHeading = await screen.findByRole('heading', { name: /Dashboard/i });
    expect(dashboardHeading).toBeInTheDocument();

    const reportsItem = await screen.findByText(/Reports/i);
    userEvent.click(reportsItem);
    const reportsHeading = await screen.findByRole('heading', { name: /Reports/i });
    expect(reportsHeading).toBeInTheDocument();
  });
});
