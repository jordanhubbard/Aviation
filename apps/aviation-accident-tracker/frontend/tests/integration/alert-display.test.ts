// apps/aviation-accident-tracker/frontend/tests/integration/alert-display.test.ts

import { describe, test, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/App';


describe('Alert Display Integration Tests', () => {
  beforeAll(() => {
    render(<App />);
  });

  test('displays alert messages correctly', async () => {
    const alertButton = screen.getByRole('button', { name: /trigger alert/i });
    userEvent.click(alertButton);

    const alertMessage = await screen.findByText(/This is an alert message/i);
    expect(alertMessage).toBeInTheDocument();
  });
});
