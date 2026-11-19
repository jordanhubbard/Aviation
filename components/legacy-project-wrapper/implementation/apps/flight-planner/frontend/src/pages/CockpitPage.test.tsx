import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import CockpitPage from './CockpitPage'
import type { Snapshot } from '../cockpit/client'

function state(): Snapshot {
  const base = {
    source_id: '127.0.0.1:4567',
    received_at: new Date().toISOString(),
    age_seconds: 0,
    live: true,
    stale: false,
  }
  return {
    source: 'local-udp-gdl90',
    session: 7,
    listening: true,
    connected: true,
    udp_bind: '127.0.0.1',
    udp_port: 4000,
    counters: { reports: 2 },
    decode_errors: {},
    capabilities: { weather_decoding: false },
    limitations: ['Advisory source reports'],
    traffic: [],
    recent_reports: [],
    receivers: [
      {
        source_id: base.source_id,
        connected: true,
        device_profile_valid: null,
        device_id: null,
        heartbeat: {
          ...base,
          report: {
            kind: 'heartbeat',
            message_id: 0,
            payload_hex: '00',
            gps_position_valid: false,
            utc_valid: false,
            seconds_since_midnight: 123,
            status_byte_1: 0,
            status_byte_2: 0,
            message_counts_raw: 0,
          },
        },
        geometric_altitude: {
          ...base,
          report: {
            kind: 'geometric_altitude',
            message_id: 11,
            payload_hex: '0b',
            geometric_altitude_ft: 2500,
            datum: null,
            datum_source: 'unknown_receiver_profile',
            vertical_warning: false,
            vertical_figure_of_merit_m: null,
            vertical_figure_of_merit_lower_bound: false,
          },
        },
        ownship: null,
      },
    ],
  }
}
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  localStorage.clear()
  sessionStorage.clear()
})
async function connect() {
  fireEvent.change(screen.getByLabelText('Bridge operator token'), {
    target: { value: 't'.repeat(40) },
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Connect and read snapshot' }))
  })
}
it('does not contact a bridge until asked; snapshots age without silent polling', async () => {
  vi.useFakeTimers()
  const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify(state())))
  vi.stubGlobal('fetch', fetch)
  render(<CockpitPage />)
  expect(fetch).not.toHaveBeenCalled()
  await connect()
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(screen.getByText(/Session 7/)).toBeTruthy()
  expect(screen.getByText(/Unknown datum/)).toBeTruthy()
  expect(screen.getByText(/calendar date unknown/)).toBeTruthy()
  expect(screen.queryAllByText('Fresh receipt')).toHaveLength(2)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(6000)
  })
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(screen.queryAllByText('Fresh receipt')).toHaveLength(0)
  expect(screen.getByText(/Last known snapshot/)).toBeTruthy()
  expect(localStorage.length).toBe(0)
  expect(sessionStorage.length).toBe(0)
})
it('supports explicit control and opt-in monitoring; disconnect clears private state and timers', async () => {
  vi.useFakeTimers()
  let listening = true
  const fetch = vi.fn().mockImplementation(async (url: string) => {
    if (url.endsWith('/stop')) listening = false
    if (url.endsWith('/start')) listening = true
    return new Response(JSON.stringify({ ...state(), listening, connected: listening }))
  })
  vi.stubGlobal('fetch', fetch)
  render(<CockpitPage />)
  await connect()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Stop receiver listener' }))
  })
  expect(screen.getByText(/Receiver listener stopped/)).toBeTruthy()
  expect(screen.queryAllByText('Fresh receipt')).toHaveLength(0)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Start receiver listener' }))
  })
  expect(screen.getByText(/receiver reports connected/)).toBeTruthy()
  expect(
    fetch.mock.calls.some(([url, init]) => url.endsWith('/start') && init.method === 'POST'),
  ).toBe(true)
  fireEvent.click(screen.getByLabelText('Monitor every 2 seconds'))
  const before = fetch.mock.calls.length
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2100)
  })
  expect(fetch).toHaveBeenCalledTimes(before + 1)
  fireEvent.click(screen.getByRole('button', { name: 'Disconnect and clear' }))
  expect(screen.getByLabelText('Bridge operator token')).toHaveValue('')
  expect(screen.queryByText(/Source 127/)).toBeNull()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000)
  })
  expect(fetch).toHaveBeenCalledTimes(before + 1)
})
it('failed refresh retains explicitly non-live data and never echoes the provider body', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify(state())))
    .mockResolvedValueOnce(new Response('sensitive provider body', { status: 401 }))
  vi.stubGlobal('fetch', fetch)
  render(<CockpitPage />)
  await connect()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Refresh snapshot' }))
  })
  expect(screen.getByText(/HTTP 401/)).toBeTruthy()
  expect(screen.queryAllByText('Fresh receipt')).toHaveLength(0)
  expect(screen.getByText(/Last known snapshot/)).toBeTruthy()
  expect(screen.queryByText('sensitive provider body')).toBeNull()
})
it('aborts a pending request on disconnect and cannot resurrect cleared reports', async () => {
  let signal: AbortSignal | undefined
  let resolve: (response: Response) => void = () => undefined
  vi.stubGlobal(
    'fetch',
    vi.fn((_url, init) => {
      signal = init.signal
      return new Promise<Response>((done) => {
        resolve = done
      })
    }),
  )
  render(<CockpitPage />)
  await connect()
  fireEvent.click(screen.getByRole('button', { name: 'Disconnect and clear' }))
  expect(signal?.aborted).toBe(true)
  await act(async () => {
    resolve(new Response(JSON.stringify(state())))
  })
  expect(screen.getByLabelText('Bridge operator token')).toHaveValue('')
  expect(screen.queryByText(/Session 7/)).toBeNull()
})

it('shows received text with explicit validity and receipt semantics and clears private weather', async () => {
  const snapshot = state()
  snapshot.capabilities = {
    weather_decoding: true,
    weather_product_ids: [413],
    weather_segmented: false,
    weather_graphical: false,
  }
  snapshot.weather = [
    {
      source_id: '127.0.0.1:4567',
      received_at: new Date().toISOString(),
      age_seconds: 2,
      live: false,
      stale: false,
      report: {
        kind: 'fisb_text',
        message_id: 7,
        payload_hex: '07' + '00'.repeat(435),
        product_id: 413,
        report_type: 'TAF',
        location_id: 'KSFO',
        report_time: '181200ZAM',
        body: 'NIL= <SCRIPT>ALERT</SCRIPT>',
        raw_text: 'TAF KSFO 181200ZAM NIL= <SCRIPT>ALERT</SCRIPT>',
        product_age_seconds: null,
        validity: 'unassessed',
      },
    },
  ]
  const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify(snapshot)))
  vi.stubGlobal('fetch', fetch)
  const view = render(<CockpitPage />)
  await connect()
  expect(screen.getByText('Receiver weather (1)')).toBeTruthy()
  expect(screen.getByText('Product validity unassessed')).toBeTruthy()
  expect(screen.getByText(/Report time \(as received\): 181200ZAM/)).toBeTruthy()
  expect(screen.getByText('NIL= <SCRIPT>ALERT</SCRIPT>')).toBeTruthy()
  expect(view.container.querySelector('script')).toBeNull()
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(localStorage.length).toBe(0)
  expect(sessionStorage.length).toBe(0)
  fireEvent.click(screen.getByRole('button', { name: 'Disconnect and clear' }))
  expect(screen.queryByText('Receiver weather (1)')).toBeNull()
})
