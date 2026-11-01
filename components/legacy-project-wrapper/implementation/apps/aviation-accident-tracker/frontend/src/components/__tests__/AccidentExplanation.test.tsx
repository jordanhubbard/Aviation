import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AccidentExplanation } from '../AccidentExplanation';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const event = { registration: 'N123', dateZ: '2026-01-01', category: 'general', summary: 'Recorded event' };

it('requests an explanation for the selected event and labels the result', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ explanation: 'Recorded factors' }) });
  vi.stubGlobal('fetch', fetch);
  render(<AccidentExplanation event={event} />);
  fireEvent.click(screen.getByRole('button', { name: 'Explain with AI' }));
  expect(await screen.findByText('Recorded factors')).toBeInTheDocument();
  expect(screen.getByText(/not an official finding/)).toBeInTheDocument();
  expect(fetch.mock.calls[0][0]).toBe('/api/explain');
  expect(JSON.parse(fetch.mock.calls[0][1].body).context).toContain('registration: N123');
});

it('shows service failure and allows retry', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Service unavailable' }) }));
  render(<AccidentExplanation event={event} />);
  fireEvent.click(screen.getByRole('button', { name: 'Explain with AI' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Service unavailable');
  await waitFor(() => expect(screen.getByRole('button')).toBeEnabled());
});

it('aborts a pending request when the selected event is closed', () => {
  let signal: AbortSignal | undefined;
  vi.stubGlobal('fetch', vi.fn((_url, options) => {
    signal = options.signal;
    return new Promise(() => {});
  }));
  const view = render(<AccidentExplanation event={event} />);
  fireEvent.click(screen.getByRole('button'));
  expect(signal?.aborted).toBe(false);
  view.unmount();
  expect(signal?.aborted).toBe(true);
});
