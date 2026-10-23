import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '../../src/App';

describe('App render', () => {
  test('App is a function', () => {
    expect(typeof App).toBe('function');
  });

  test('renders the heading', () => {
    const { container } = render(<App />);
    expect(container).toBeTruthy();
    expect(screen.getByRole('heading', { name: /aviation accident tracker/i })).toBeInTheDocument();
  });
});
