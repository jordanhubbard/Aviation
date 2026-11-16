import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import ChartsPage from './ChartsPage'

vi.mock('../components/ChartMap', () => ({ default: () => <div>Projected chart map</div> }))
const chart = {
  id: 'chart_one',
  name: 'KSFO airport diagram',
  family: 'terminal',
  kind: 'APD',
  format: 'pdf',
  airport: 'KSFO',
  source: 'FAA d-TPP',
  cycle: '2611',
  freshness: 'current',
  edition_freshness: 'current',
  verification_state: 'verified',
  source_checked_at: '2026-11-16T00:00:00Z',
  effective_from: '2026-10-29T09:01:00Z',
  effective_to: '2026-11-26T09:01:00Z',
  url: 'https://aeronav.faa.gov/diagram.pdf',
  cached: {
    sha256: 'a'.repeat(64),
    at: '2026-11-16T00:00:00Z',
    members: [{ name: 'diagram.pdf', format: 'pdf', sha256: 'a'.repeat(64) }],
  },
}
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => ({
      ok: true,
      json: async () =>
        path.includes('/info')
          ? { ...chart.cached.members[0], pages: 2 }
          : {
              charts: [chart],
              total: 1,
              page: 1,
              limit: 30,
              source_status: { terminal: { status: 'available', verification_state: 'verified' } },
            },
    })),
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('finds sourced charts and displays pinned PDF pages with local zoom', async () => {
  render(<ChartsPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Find charts' }))
  await screen.findByText('KSFO airport diagram')
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('airport=KSFO'), expect.anything())
  fireEvent.click(screen.getByRole('button', { name: 'View chart details' }))
  const image = await screen.findByRole('img')
  expect(image.getAttribute('src')).toContain('sha256=' + 'a'.repeat(64))
  fireEvent.click(screen.getByRole('button', { name: 'Next PDF page' }))
  expect(image.getAttribute('src')).toContain('/preview/2.png')
  const calls = vi.mocked(fetch).mock.calls.length
  fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
  expect(image.style.width).toBe('150%')
  expect(vi.mocked(fetch).mock.calls.length).toBe(calls)
  expect(
    screen.getByRole('button', { name: 'Next PDF page' }).getAttribute('disabled'),
  ).not.toBeNull()
})

it('clears obsolete catalog when the airport changes', async () => {
  render(<ChartsPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Find charts' }))
  await screen.findByText('KSFO airport diagram')
  fireEvent.change(screen.getByLabelText('Airport identifier'), { target: { value: 'KSQL' } })
  await waitFor(() => expect(screen.queryByText('KSFO airport diagram')).toBeNull())
})

it('keeps source failure and missing coverage explicit', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        charts: [],
        total: 0,
        page: 1,
        limit: 30,
        source_status: { terminal: { status: 'unavailable', error: 'FAA download failed' } },
      }),
    })),
  )
  render(<ChartsPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Find charts' }))
  expect(await screen.findByText(/Previous copies have not been revalidated/)).toBeTruthy()
  expect(screen.getByText('0 matching charts · page 1')).toBeTruthy()
})

it('shows stale catalog verification even when the edition dates are current', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        charts: [
          { ...chart, freshness: 'cached-unverified', verification_state: 'cached-unverified' },
        ],
        total: 1,
        page: 1,
        limit: 30,
        source_status: {
          terminal: { status: 'available', verification_state: 'cached-unverified' },
        },
      }),
    })),
  )
  render(<ChartsPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Find charts' }))
  expect(await screen.findByText(/terminal: cached-unverified/)).toBeTruthy()
  expect(screen.getByText(/Edition: current · Catalog: cached-unverified/)).toBeTruthy()
  expect(screen.getByText('cached-unverified', { exact: true })).toBeTruthy()
})
