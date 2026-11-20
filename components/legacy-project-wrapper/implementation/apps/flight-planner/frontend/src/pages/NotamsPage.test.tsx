import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import NotamsPage from './NotamsPage'
const now = Date.now()
function notice() {
  return {
    id: 'NMS_TEST',
    number: '04/123',
    series: null,
    year: '2026',
    location: 'PAO',
    icao_location: 'KPAO',
    text: '<script>Source text</script>',
    text_length: 28,
    text_truncated: false,
    detail_url: '/api/notams/detail?id=NMS_TEST',
    classification: 'DOM',
    type: null,
    effective_start_utc: null,
    effective_end_utc: null,
    cancelled_at_utc: null,
    last_updated_utc: new Date(now).toISOString(),
    permanent: true,
    estimated: false,
    schedule: 'DLY 0900-1500',
    activity: 'source_incomplete',
    missing_fields: ['type', 'effective_start'],
    severity: null,
  }
}
function page() {
  const n = notice()
  n.text_length = Array.from(n.text).length
  return {
    status: 'partial',
    environment: 'staging',
    production_data: false,
    complete_snapshot: true,
    snapshot_id: 'a'.repeat(64),
    requested_locations: ['KPAO'],
    matched_locations: ['KPAO', 'PAO'],
    source: {
      provider: 'FAA NMS',
      url: null,
      retrieved_at_utc: new Date(now).toISOString(),
      environment: 'staging',
    },
    synchronized_at: new Date(now).toISOString(),
    full_load_at: new Date(now - 3600000).toISOString(),
    incomplete_records: 1,
    total: 1,
    offset: 0,
    limit: 100,
    next_offset: null,
    notams: [n],
    warnings: ['Not authoritative for all non-US NOTAMs'],
    error: null,
  }
}
async function read() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Read NOTAMs' }))
  })
}
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
it('only reads when asked and renders original text, staging, missing fields and permanence', async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify(page())))
  vi.stubGlobal('fetch', fetch)
  render(<NotamsPage />)
  expect(fetch).not.toHaveBeenCalled()
  await read()
  expect(screen.getByText(/Non-production NOTAM data/)).toBeTruthy()
  expect(screen.getByText(/Unknown → PERM/)).toBeTruthy()
  expect(screen.getByText(/Source fields missing: type, effective_start/)).toBeTruthy()
  expect(screen.getByText('<script>Source text</script>')).toBeTruthy()
  expect(document.querySelector('script')).toBeNull()
  expect(fetch).toHaveBeenCalledTimes(1)
})
it('clears old results when the airport changes and ignores a late response', async () => {
  let finish!: (value: Response) => void
  let pendingSignal!: AbortSignal
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_url: string, options?: RequestInit) =>
        new Promise<Response>((resolve) => {
          pendingSignal = options!.signal!
          finish = resolve
        }),
    ),
  )
  render(<NotamsPage />)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Read NOTAMs' }))
  })
  fireEvent.change(screen.getByLabelText('Airports / source locations'), {
    target: { value: 'KSFO' },
  })
  expect(pendingSignal.aborted).toBe(true)
  await act(async () => {
    finish(new Response(JSON.stringify(page())))
  })
  expect(screen.queryByText(/Non-production NOTAM data/)).toBeNull()
  expect(screen.queryByText('<script>Source text</script>')).toBeNull()
})
it('releases completed list and detail requests before later navigation cancels active work', async () => {
  const signals: AbortSignal[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, options?: RequestInit) => {
      signals.push(options!.signal!)
      return new Response(
        JSON.stringify(
          String(url).includes('/detail?')
            ? {
                status: 'partial',
                environment: 'staging',
                production_data: false,
                snapshot_id: 'a'.repeat(64),
                source: page().source,
                notice: page().notams[0],
                source_feature: {
                  type: 'Feature',
                  properties: { coreNOTAMData: { notam: { id: 'NMS_TEST' } } },
                },
                warnings: [],
              }
            : page(),
        ),
      )
    }),
  )
  const view = render(<NotamsPage />)
  await read()
  expect(signals[0].aborted).toBe(false)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Source details' }))
  })
  expect(signals).toHaveLength(2)
  expect(signals[0].aborted).toBe(false)
  fireEvent.change(screen.getByLabelText('Airports / source locations'), {
    target: { value: 'KSFO' },
  })
  expect(signals[1].aborted).toBe(false)
  view.unmount()
  expect(signals.every((signal) => !signal.aborted)).toBe(true)
})
it('locally ages freshness without network polling', async () => {
  vi.useFakeTimers()
  const fetch = vi.fn(async () => new Response(JSON.stringify(page())))
  vi.stubGlobal('fetch', fetch)
  render(<NotamsPage />)
  await read()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(270000)
  })
  expect(screen.getByText(/Stale source/)).toBeTruthy()
  expect(fetch).toHaveBeenCalledTimes(1)
})
it('reads pinned full source and clears success if the snapshot changes', async () => {
  const seen: string[] = []
  let fail = false
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      seen.push(String(url))
      if (!String(url).includes('/detail?')) return new Response(JSON.stringify(page()))
      if (fail) return new Response('', { status: 409 })
      return new Response(
        JSON.stringify({
          status: 'partial',
          environment: 'staging',
          production_data: false,
          snapshot_id: 'a'.repeat(64),
          source: page().source,
          notice: page().notams[0],
          source_feature: {
            type: 'Feature',
            properties: { coreNOTAMData: { notam: { id: 'NMS_TEST' } } },
          },
          warnings: [],
        }),
      )
    }),
  )
  render(<NotamsPage />)
  await read()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Source details' }))
  })
  expect(screen.getByRole('region', { name: 'Original NOTAM source' })).toBeTruthy()
  expect(seen[1]).toContain('snapshot_id=' + 'a'.repeat(64))
  fireEvent.click(screen.getByRole('button', { name: 'Close source details' }))
  fail = true
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Source details' }))
  })
  expect(screen.getByText(/snapshot changed; reload/)).toBeTruthy()
  expect(screen.queryByText('<script>Source text</script>')).toBeNull()
})
it('shows unavailable errors without sample records', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('', { status: 503 })),
  )
  render(<NotamsPage />)
  await read()
  expect(screen.getByText(/HTTP 503/)).toBeTruthy()
  expect(screen.queryByText(/matching cached records/)).toBeNull()
})

it('labels an uninitialized production cache as unavailable, without calling it staging', async () => {
  const body = {
    ...page(),
    status: 'unavailable',
    environment: 'production',
    production_data: false,
    complete_snapshot: false,
    snapshot_id: null,
    synchronized_at: null,
    full_load_at: null,
    incomplete_records: 0,
    total: 0,
    notams: [],
    warnings: [],
    error: 'Cache unavailable',
    source: { provider: 'FAA NMS', url: null, environment: 'production', retrieved_at_utc: null },
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body))),
  )
  render(<NotamsPage />)
  await read()
  expect(screen.getByText('Production NOTAM data is unavailable.')).toBeTruthy()
  expect(screen.queryByText('Non-production NOTAM data: may include test notices.')).toBeNull()
})

it('downloads retained AIXM as XML and keeps its original text', async () => {
  const xml = '<AIXMBasicMessage>Source &amp; notice</AIXMBasicMessage>'
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            String(url).includes('/detail?')
              ? {
                  status: 'partial',
                  environment: 'staging',
                  production_data: false,
                  snapshot_id: 'a'.repeat(64),
                  source: page().source,
                  notice: notice(),
                  warnings: [],
                  source_feature: {
                    type: 'Feature',
                    properties: { coreNOTAMData: { notam: { id: 'NMS_TEST' } } },
                    source_format: 'AIXM',
                    source_aixm: xml,
                  },
                }
              : page(),
          ),
        ),
    ),
  )
  const blob = vi.fn((_value: Blob) => 'blob:source')
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: blob, revokeObjectURL: vi.fn() }))
  const downloads: string[] = []
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push(this.download)
  })
  render(<NotamsPage />)
  await read()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Source details' }))
  })
  expect(screen.queryByRole('button', { name: 'Download original GeoJSON' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Download source AIXM' }))
  expect(blob).toHaveBeenCalledTimes(1)
  expect(blob.mock.calls[0][0].type).toBe('application/xml')
  expect(downloads).toEqual(['notam-NMS_TEST.xml'])
  click.mockRestore()
})
