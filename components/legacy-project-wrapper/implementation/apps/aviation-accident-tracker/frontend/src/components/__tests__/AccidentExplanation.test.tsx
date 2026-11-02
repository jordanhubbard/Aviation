import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const { register, dispose } = vi.hoisted(() => ({ register: vi.fn(), dispose: vi.fn() }));
vi.mock('@aviation/ai-explainer/browser', () => ({ registerDecisionContext: register }));
import { AccidentExplanation } from '../AccidentExplanation';

beforeEach(() => { register.mockReset(); dispose.mockReset(); register.mockReturnValue(dispose); });
afterEach(cleanup);
const event = { registration: 'N123', dateZ: '2026-01-01', category: 'general',
  fatalities: 0, summary: 'Recorded event' };

it('supplies selected evidence and an attribution question to the common SDK', () => {
  render(<AccidentExplanation event={event} />);
  const [facts, question] = register.mock.calls[0];
  expect(facts()).toMatchObject({ registration: 'N123', date: '2026-01-01',
    category: 'general', fatalities: 0, summary: 'Recorded event' });
  expect(question).toContain('do not invent an official cause');
  expect(screen.getByText(/not official findings/)).toBeInTheDocument();
});

it('uses the current selected event without restarting the shared UI on rerender', () => {
  const view = render(<AccidentExplanation event={event} />);
  const facts = register.mock.calls[0][0];
  view.rerender(<AccidentExplanation event={{ ...event, registration: 'N456',
    narrative: 'x'.repeat(5000) }} />);
  expect(register).toHaveBeenCalledTimes(1);
  expect(facts().registration).toBe('N456');
  expect(facts().narrative).toHaveLength(2000);
});

it('releases the selected decision scope when its detail closes', () => {
  const view = render(<AccidentExplanation event={event} />);
  view.unmount();
  expect(dispose).toHaveBeenCalledTimes(1);
});
