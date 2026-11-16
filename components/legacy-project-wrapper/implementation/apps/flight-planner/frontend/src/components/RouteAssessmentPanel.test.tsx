import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import RouteAssessmentPanel from './RouteAssessmentPanel'
vi.mock('./AssessmentMap', () => ({ default: () => <div>Assessment geometry map</div> }))
const result = {
  assessed_at_utc: '2026-11-16T15:00:00Z',
  route_geometry: {
    type: 'LineString',
    coordinates: [
      [0, 0],
      [1, 0],
    ],
  },
  geometries: {},
  distance_nm: 60,
  findings: [],
  total_findings: 0,
  findings_truncated: false,
  unassessed: [],
  unassessed_count: 0,
  terrain: [],
  terrain_source: null,
  sources: [
    {
      name: 'tfr',
      status: 'unavailable',
      error: 'Source unavailable',
      truncated: false,
      missing_geometry_ids: [],
      sources: [],
    },
  ],
  coverage_gaps: ['NOTAM coverage pending'],
  geometry_method: {
    route_max_spacing_nm: 1,
    terrain_max_spacing_nm: 3,
    corridor: 'Estimated corridor',
  },
  limitations: 'Reference planning only',
}
afterEach(() => {
  cleanup()
  window.history.replaceState({}, '', '/')
  vi.unstubAllGlobals()
})
function fill() {
  for (const [label, value] of [
    ['Latitude 1', '0'],
    ['Longitude 1', '0'],
    ['Latitude 2', '0'],
    ['Longitude 2', '1'],
    ['Arrival UTC 1', '2026-11-16T10:00:00Z'],
    ['Arrival UTC 2', '2026-11-16T11:00:00Z'],
  ])
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
}
it('rejects an incomplete profile before network access', async () => {
  vi.stubGlobal('fetch', vi.fn())
  render(<RouteAssessmentPanel />)
  fireEvent.click(screen.getByRole('button', { name: 'Assess route profile' }))
  expect(await screen.findByText(/Complete every route coordinate/)).toBeTruthy()
  expect(fetch).not.toHaveBeenCalled()
})
it('sends explicit times and altitudes and shows partial-source coverage', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => result })),
  )
  render(<RouteAssessmentPanel />)
  fill()
  fireEvent.click(screen.getByRole('button', { name: 'Assess route profile' }))
  await screen.findByText('Assessment geometry map')
  expect(screen.getByText('NOTAM coverage pending')).toBeTruthy()
  expect(screen.getByText('tfr: unavailable')).toBeTruthy()
  const call = vi.mocked(fetch).mock.calls[0]
  expect(call[0]).toBe('/api/route-assessment')
  const request = JSON.parse(String(call[1]?.body))
  expect(request.waypoints[1].at).toBe('2026-11-16T11:00:00Z')
  expect(request.waypoints[0].altitude_ft_msl).toBe(4500)
})
it('discards a late result after the route has changed', async () => {
  let resolve!: (value: unknown) => void
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise((r) => {
          resolve = r
        }),
    ),
  )
  render(<RouteAssessmentPanel />)
  fill()
  fireEvent.click(screen.getByRole('button', { name: 'Assess route profile' }))
  await screen.findByRole('status')
  fireEvent.change(screen.getByLabelText('Latitude 2'), { target: { value: '1' } })
  resolve({ ok: true, json: async () => result })
  await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  expect(screen.queryByText('Assessment geometry map')).toBeNull()
})

it('retains every handed-off airport and prepares reviewed times without automatic assessment', async () => {
  window.history.replaceState({}, '', '/route-assessment?airports=KOAK%20KSFO%20KSJC')
  const airports = {
    KOAK: { latitude: 37.72, longitude: -122.22 },
    KSFO: { latitude: 37.62, longitude: -122.38 },
    KSJC: { latitude: 37.36, longitude: -121.93 },
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => ({
      ok: true,
      json: async () => airports[String(url).split('/').at(-1) as keyof typeof airports],
    })),
  )
  render(<RouteAssessmentPanel />)
  expect(screen.getByLabelText('Route airports (in order)')).toHaveProperty(
    'value',
    'KOAK KSFO KSJC',
  )
  expect(fetch).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Departure UTC'), {
    target: { value: '2026-11-16T10:00:00Z' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Use airport route' }))
  await waitFor(() => expect(screen.getByLabelText('Latitude 3')).toHaveProperty('value', '37.36'))
  expect(vi.mocked(fetch).mock.calls.map((call) => call[0])).toEqual([
    '/api/airports/KOAK',
    '/api/airports/KSFO',
    '/api/airports/KSJC',
  ])
  const times = [1, 2, 3].map((i) =>
    Date.parse((screen.getByLabelText(`Arrival UTC ${i}`) as HTMLInputElement).value),
  )
  expect(times[0]).toBe(Date.parse('2026-11-16T10:00:00Z'))
  expect(times[0]).toBeLessThan(times[1])
  expect(times[1]).toBeLessThan(times[2])
  expect(screen.queryByText('Assessment geometry map')).toBeNull()
})
it('ignores malformed route handoffs without fetching', () => {
  window.history.replaceState({}, '', '/route-assessment?airports=KOAK%20https://evil.example')
  vi.stubGlobal('fetch', vi.fn())
  render(<RouteAssessmentPanel />)
  expect(screen.getByLabelText('Route airports (in order)')).toHaveProperty('value', 'KSAT KAUS')
  expect(fetch).not.toHaveBeenCalled()
})
