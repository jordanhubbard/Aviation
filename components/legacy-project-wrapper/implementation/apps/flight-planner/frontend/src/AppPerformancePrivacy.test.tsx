import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

const probe = vi.hoisted(() => ({ provider: undefined as (() => Record<string, unknown>) | undefined }))
vi.mock('@aviation/ai-explainer/browser', () => ({
  registerDecisionContext: (provider: () => Record<string, unknown>) => { probe.provider = provider; return () => {} },
}))
vi.mock('./pages/AircraftPerformancePage', () => ({ default: () => <div>Private performance excerpt: 1234 feet</div> }))
vi.mock('./pages/WeatherPage', () => ({ default: () => <div>Public weather reference</div> }))

beforeEach(() => { probe.provider = undefined })
afterEach(() => { cleanup(); window.history.replaceState({}, '', '/') })
it('excludes a private performance view even after the URL changes while its DOM is still rendered', async () => {
  window.history.replaceState({}, '', '/aircraft-performance')
  render(<BrowserRouter><App /></BrowserRouter>)
  await screen.findByText('Private performance excerpt: 1234 feet')
  await waitFor(() => expect(probe.provider).toBeDefined())
  expect(String(probe.provider!().displayedFacts)).not.toContain('1234 feet')
  // Navigation updates the URL before an animated outgoing view is removed.
  window.history.replaceState({}, '', '/weather')
  expect(document.querySelector('main')?.textContent).toContain('1234 feet')
  expect(String(probe.provider!().displayedFacts)).not.toContain('1234 feet')
})
it('retains ordinary explanation context for a public workspace', async () => {
  window.history.replaceState({}, '', '/weather')
  render(<BrowserRouter><App /></BrowserRouter>)
  await screen.findByText('Public weather reference')
  await waitFor(() => expect(probe.provider).toBeDefined())
  expect(String(probe.provider!().displayedFacts)).toContain('Public weather reference')
})
