import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import AircraftLibraryPage from './AircraftLibraryPage'

const key = 'synthetic-private-library-access-key'
const capabilities = {
  llm: false,
  model: null,
  embeddings: false,
  ocr: false,
  search: { configured: false, provider: null },
  types: [],
}
const subject = { document_id: 'doc_fixture', icao: 'C172', title: 'Persisted manual' }
function job(id = 'job_fixture', state = 'running') {
  return {
    id,
    kind: 'index',
    state,
    error: null,
    updated_at: '2026-11-17T00:00:00Z',
    subject: { ...subject, title: id === 'job_fixture' ? subject.title : 'Manual ' + id },
    has_result: state === 'completed',
  }
}
const response = (value: unknown) => new Response(JSON.stringify(value))
function page(jobs: ReturnType<typeof job>[], next_offset: number | null = null) {
  return { jobs, next_offset, total: next_offset === null ? jobs.length : 21, offset: 0, limit: 20 }
}
function defaults(input: RequestInfo | URL) {
  const url = String(input)
  if (url.endsWith('/capabilities')) return response(capabilities)
  if (url.includes('/documents?')) return response({ documents: [] })
  return null
}
async function open() {
  fireEvent.change(screen.getByLabelText('Library access key'), { target: { value: key } })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Open library' }))
  })
}
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

it('restores server jobs after reopening without storing credentials or polling', async () => {
  const storage = vi.spyOn(Storage.prototype, 'setItem')
  const fetch = vi.fn(
    async (input: RequestInfo | URL) => defaults(input) ?? response(page([job()])),
  )
  vi.stubGlobal('fetch', fetch)
  const first = render(<AircraftLibraryPage />)
  expect(fetch).not.toHaveBeenCalled()
  await open()
  expect(await screen.findByText(/Process manual: running.*Persisted manual/)).toBeTruthy()
  const count = fetch.mock.calls.length
  vi.useFakeTimers()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60000)
  })
  expect(fetch).toHaveBeenCalledTimes(count)
  vi.useRealTimers()
  first.unmount()
  render(<AircraftLibraryPage />)
  expect((screen.getByLabelText('Library access key') as HTMLInputElement).value).toBe('')
  expect(screen.queryByText(/Persisted manual/)).toBeNull()
  await open()
  expect(await screen.findByText(/Process manual: running.*Persisted manual/)).toBeTruthy()
  expect(fetch.mock.calls.filter(([url]) => String(url).includes('/jobs?'))).toHaveLength(2)
  expect(storage).not.toHaveBeenCalled()
})

it('loads detailed completed results only when requested', async () => {
  const done = job('job_fixture', 'completed')
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).endsWith('/jobs/job_fixture'))
      return response({ ...done, result: { status: 'reviewed original pages' } })
    return defaults(input) ?? response(page([done]))
  })
  vi.stubGlobal('fetch', fetch)
  render(<AircraftLibraryPage />)
  await open()
  expect(fetch.mock.calls.some(([url]) => String(url).endsWith('/jobs/job_fixture'))).toBe(false)
  fireEvent.click(screen.getByText('Recent completed or failed jobs (1)'))
  await act(async () => {
    fireEvent.click(
      screen.getByRole('button', { name: 'Read processing result: Persisted manual' }),
    )
  })
  expect(fetch.mock.calls.some(([url]) => String(url).endsWith('/jobs/job_fixture'))).toBe(true)
  fireEvent.click(screen.getByText('Acquisition / processing results'))
  expect(screen.getByText(/reviewed original pages/)).toBeTruthy()
})

it('keeps ownership through body reads and fences a late result after locking', async () => {
  let finish: ((value: unknown) => void) | undefined
  let signal: AbortSignal | undefined
  let requests = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const existing = defaults(input)
      if (existing) return existing
      if (++requests > 1) return response(page([]))
      signal = init?.signal as AbortSignal
      return {
        ok: true,
        status: 200,
        json: () =>
          new Promise((resolve) => {
            finish = resolve
          }),
      }
    }),
  )
  render(<AircraftLibraryPage />)
  await open()
  await waitFor(() => expect(finish).toBeDefined())
  fireEvent.click(screen.getByRole('button', { name: 'Lock library' }))
  expect(signal?.aborted).toBe(true)
  await act(async () => {
    finish?.(page([job()], 20))
  })
  expect(screen.queryByText(/Persisted manual/)).toBeNull()
  await open()
  expect(await screen.findByText('The last read found no active processing jobs.')).toBeTruthy()
  expect(screen.queryByText(/Persisted manual/)).toBeNull()
  expect(screen.queryByRole('button', { name: 'Load more jobs' })).toBeNull()
})

it('loads another bounded page only on an explicit action', async () => {
  const first = Array.from({ length: 20 }, (_, i) => job('queued_' + i, 'queued'))
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).includes('/jobs?'))
      return response(
        String(input).endsWith('offset=20')
          ? { ...page([job('queued_20', 'queued')]), offset: 20, total: 21 }
          : page(first, 20),
      )
    return defaults(input) ?? response({})
  })
  vi.stubGlobal('fetch', fetch)
  render(<AircraftLibraryPage />)
  await open()
  expect(screen.queryByText(/Manual queued_20/)).toBeNull()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Load more jobs' }))
  })
  expect(await screen.findByText(/Manual queued_20/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Load more jobs' })).toBeNull()
})

it('does not turn an unreadable job list into an empty successful queue', async () => {
  let valid = false
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (input: RequestInfo | URL) =>
        defaults(input) ?? response(valid ? page([]) : { jobs: null, next_offset: null }),
    ),
  )
  render(<AircraftLibraryPage />)
  await open()
  expect(await screen.findByText('Library processing jobs response is invalid')).toBeTruthy()
  expect(screen.queryByText('The last read found no active processing jobs.')).toBeNull()
  valid = true
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Refresh jobs and documents' }))
  })
  expect(await screen.findByText('The last read found no active processing jobs.')).toBeTruthy()
})
