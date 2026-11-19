import { afterEach, describe, expect, it, vi } from 'vitest'
import { bridgeClient, bridgeOrigin, type Snapshot } from './client'

export const emptySnapshot: Snapshot = {
  source: 'local-udp-gdl90',
  session: 1,
  listening: true,
  connected: false,
  udp_bind: '127.0.0.1',
  udp_port: 4000,
  receivers: [],
  traffic: [],
  recent_reports: [],
  counters: {},
  decode_errors: {},
  capabilities: { weather_decoding: false },
  limitations: [],
}
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
describe('explicit local bridge client', () => {
  it.each([
    'https://bridge.example',
    'http://127.0.0.1:18190',
    'http://[::1]:18190',
    'http://localhost:18190/',
  ])('accepts explicit origin %s', (url) => {
    expect(bridgeOrigin(url)).toBe(new URL(url).origin)
  })
  it.each([
    'http://bridge.example',
    'https://user:secret@bridge.example',
    'https://bridge.example/path',
    'https://bridge.example/?token=secret',
    'https://bridge.example/#secret',
    'ftp://localhost',
    'http://localhost:0',
  ])('rejects unsafe origin %s before contact', (url) => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    expect(() => bridgeClient(url, 't'.repeat(40))).toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })
  it('sends memory credentials only in headers and never follows redirects', async () => {
    const fetch = vi
      .fn()
      .mockImplementation(async () => new Response(JSON.stringify(emptySnapshot)))
    vi.stubGlobal('fetch', fetch)
    const client = bridgeClient('http://localhost:18190', 't'.repeat(40))
    const signal = new AbortController().signal
    await client.state(signal)
    await client.control('stop', signal)
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      'http://localhost:18190/api/cockpit/state',
      'http://localhost:18190/api/cockpit/stop',
    ])
    expect(fetch.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      headers: { Authorization: `Bearer ${'t'.repeat(40)}` },
    })
    expect(fetch.mock.calls[1][1].method).toBe('POST')
  })
  it.each([
    { ...emptySnapshot, receivers: [{}] },
    { ...emptySnapshot, traffic: [null] },
    { ...emptySnapshot, receivers: Array(9).fill({}) },
    { ...emptySnapshot, session: -1 },
    { ...emptySnapshot, limitations: [{}] },
  ])('rejects malformed or over-limit state', async (data) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(data))))
    await expect(
      bridgeClient('http://localhost', 't'.repeat(40)).state(new AbortController().signal),
    ).rejects.toThrow('invalid report collection')
  })
  it('bounds a stalled request and reports no response body or credential', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener('abort', () =>
              reject(new DOMException('secret raw transport body', 'AbortError')),
            )
          }),
      ),
    )
    const request = bridgeClient('http://localhost', 't'.repeat(40)).state(
      new AbortController().signal,
    )
    const rejected = expect(request).rejects.toThrow('Bridge unavailable or request cancelled')
    await vi.advanceTimersByTimeAsync(8000)
    await rejected
  })
})

const weatherReport = {
  kind: 'fisb_text' as const,
  message_id: 7,
  payload_hex: '07' + '00'.repeat(435),
  product_id: 413 as const,
  raw_text: 'TAF KSFO 181200Z NIL=',
  report_type: 'TAF',
  location_id: 'KSFO',
  report_time: '181200Z',
  body: 'NIL=',
  product_age_seconds: null,
  validity: 'unassessed' as const,
}
function weatherSnapshot(): Snapshot {
  return {
    ...emptySnapshot,
    capabilities: {
      weather_decoding: true,
      weather_product_ids: [413],
      weather_segmented: false,
      weather_graphical: false,
    },
    weather: [
      {
        source_id: '127.0.0.1:4000',
        received_at: '2026-11-18T01:00:00Z',
        age_seconds: 0,
        live: false,
        stale: false,
        report: { ...weatherReport },
      },
    ],
  }
}
it('accepts bounded complete weather without asserting product validity', async () => {
  const value = weatherSnapshot()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(value))))
  expect(
    await bridgeClient('http://localhost:18190', 't'.repeat(40)).state(
      new AbortController().signal,
    ),
  ).toEqual(value)
})
it.each(['live', 'age', 'body', 'count', 'coverage', 'kind'])(
  'rejects malformed or falsely fresh receiver weather: %s',
  async (failure) => {
    const value = weatherSnapshot()
    if (failure === 'live') value.weather![0].live = true
    if (failure === 'age')
      (value.weather![0].report as unknown as Record<string, unknown>).product_age_seconds = 0
    if (failure === 'body')
      (value.weather![0].report as unknown as Record<string, unknown>).body = 'OTHER'
    if (failure === 'count') value.weather = Array(129).fill(value.weather![0])
    if (failure === 'coverage') value.capabilities.weather_graphical = true
    if (failure === 'kind')
      (value.weather![0].report as unknown as Record<string, unknown>).kind = 'uplink'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(value))))
    await expect(
      bridgeClient('http://localhost:18190', 't'.repeat(40)).state(new AbortController().signal),
    ).rejects.toThrow(/invalid report collection/)
  },
)
