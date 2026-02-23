// apps/aviation-accident-tracker/frontend/tests/integration/user-interaction.test.ts

import { describe, test, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/App';


describe('User Interaction Integration Tests', () => {
  beforeAll(() => {
    render(<App />);
  });

  test('navigates through menu items', async () => {
    const menuButton = screen.getByRole('button', { name: /menu/i });
    userEvent.click(menuButton);

    const menuItem = await screen.findByText(/Dashboard/i);
    expect(menuItem).toBeInTheDocument();
    userEvent.click(menuItem);

    const dashboardHeading = await screen.findByRole('heading', { name: /Dashboard/i });
    expect(dashboardHeading).toBeInTheDocument();
  });

  test('displays alerts correctly', async () => {
    const alertButton = screen.getByRole('button', { name: /show alert/i });
    userEvent.click(alertButton);

    const alertMessage = await screen.findByText(/This is an alert/i);
    expect(alertMessage).toBeInTheDocument();
  });
});
