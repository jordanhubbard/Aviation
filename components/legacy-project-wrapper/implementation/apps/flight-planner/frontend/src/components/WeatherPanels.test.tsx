import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import WeatherPanels from './WeatherPanels'
import { weatherService } from '../services/weatherService'
import type { TafResponse } from '../types/weather.types'

const state = vi.hoisted(() => ({ weatherError: false }))
vi.mock('../hooks', () => ({
  useWeather: () => ({
    isError: state.weatherError,
    data: state.weatherError ? undefined : { metar: 'METAR OBSERVATION', ceiling: null },
  }),
  useForecast: () => ({ isError: true }),
}))
vi.mock('../services/weatherService', () => ({ weatherService: { getTaf: vi.fn() } }))

const raw =
  'TAF KJFK 141130Z 1412/1518 18010KT P6SM SCT030\n  FM141800 22015G25KT P6SM BKN050\n  TEMPO 1420/1423 3SM TSRA'
const response: TafResponse = {
  status: 'available',
  reports: [
    {
      icaoId: 'KJFK',
      rawTAF: raw,
      issueTime: '2026-11-14T11:30:00Z',
      validTimeFrom: 1794657600,
      validTimeTo: 1794765600,
    },
  ],
  source: {
    provider: 'NOAA Aviation Weather Center',
    url: 'https://aviationweather.gov/api/data/taf',
    retrieved_at_utc: '2026-11-14T11:45:00Z',
  },
}

function show(airports = ['KJFK']) {
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={client}>
      <WeatherPanels airports={airports} />
    </QueryClientProvider>,
  )
}

afterEach(cleanup)
beforeEach(() => {
  state.weatherError = false
  vi.mocked(weatherService.getTaf).mockReset().mockResolvedValue(response)
})

describe('Route weather TAFs', () => {
  it('preserves full multiline TAFs beside METARs and labels times and source', async () => {
    show()
    const panel = await screen.findByRole('region', { name: 'KJFK TAF' })
    await within(panel).findByText(/FM141800/)
    expect(within(panel).getByText(/FM141800/).textContent).toBe(raw)
    expect(screen.getByText('METAR OBSERVATION')).toBeInTheDocument()
    expect(within(panel).getByText(/Issued:/)).toHaveTextContent('2026-11-14 11:30:00 UTC')
    expect(within(panel).getByText(/Valid:/)).toHaveTextContent(
      '2026-11-14 12:00:00 UTC – 2026-11-15 18:00:00 UTC',
    )
    expect(within(panel).getByText(/Source:/)).toHaveTextContent('NOAA Aviation Weather Center')
    expect(within(panel).getByText(/Retrieved:/)).toHaveTextContent('2026-11-14 11:45:00 UTC')
  })

  it('includes intermediate airports and the destination beyond four airports, deduplicated', async () => {
    show(['KJFK', 'KBOS', 'KORD', 'KDEN', 'KSFO', 'kjfk', ''])
    await screen.findAllByText(/FM141800/)
    expect(screen.getAllByRole('region')).toHaveLength(5)
    expect(screen.getByRole('region', { name: 'KSFO TAF' })).toBeInTheDocument()
    expect(vi.mocked(weatherService.getTaf).mock.calls.map(([airport]) => airport)).toEqual([
      'KJFK',
      'KBOS',
      'KORD',
      'KDEN',
      'KSFO',
    ])
  })

  it('shows loading without hiding the METAR', () => {
    vi.mocked(weatherService.getTaf).mockReturnValue(new Promise(() => {}))
    show()
    expect(screen.getByText('Loading TAF…')).toBeInTheDocument()
    expect(screen.getByText('METAR OBSERVATION')).toBeInTheDocument()
  })

  it('distinguishes no TAF reports from provider failure', async () => {
    vi.mocked(weatherService.getTaf).mockResolvedValue({
      ...response,
      status: 'no_reports',
      reports: [],
    })
    show()
    expect(await screen.findByText('No TAF available for KJFK.')).toBeInTheDocument()
    expect(screen.getByText('METAR OBSERVATION')).toBeInTheDocument()
  })

  it('keeps provider errors separate from METAR results', async () => {
    vi.mocked(weatherService.getTaf).mockRejectedValue(new Error('503'))
    show()
    expect(await screen.findByText('Unable to load TAF for KJFK.')).toBeInTheDocument()
    expect(screen.getByText('METAR OBSERVATION')).toBeInTheDocument()
  })

  it('shows TAFs even when current weather fails, with missing fields explicit', async () => {
    state.weatherError = true
    vi.mocked(weatherService.getTaf).mockResolvedValue({ ...response, reports: [{}] })
    show()
    expect(await screen.findByText('TAF text unavailable.')).toBeInTheDocument()
    expect(screen.getByText(/Issued:/)).toHaveTextContent('Unknown')
    expect(screen.getByText(/Valid:/)).toHaveTextContent('Unknown – Unknown')
    expect(screen.getByText('Unable to load current weather.')).toBeInTheDocument()
  })
})
