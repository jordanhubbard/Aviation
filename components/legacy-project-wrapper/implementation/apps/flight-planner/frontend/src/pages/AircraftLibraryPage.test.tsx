import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import AircraftLibraryPage from './AircraftLibraryPage'

const document = {
  id: 'doc_test',
  icao: 'C172',
  sha256: '1'.repeat(64),
  status: 'indexed',
  error: null,
  metadata: {
    icao: 'C172',
    title: '<script>untrusted title</script>',
    variant: 'S',
    revision: 'example',
    kind: 'POH',
    tails: [],
    scope: 'type',
    serial_applicability: '',
    notes: '',
  },
  extraction: { page_count: 1, incomplete_pages: [] },
  sources: [{ filename: 'example.pdf', url: null, retrieved_at: '2026-11-16T00:00:00Z' }],
  artifacts: {},
}
let seen: { path: string; init?: RequestInit }[]
let askResponse: (() => Promise<unknown>) | undefined
beforeEach(() => {
  seen = []
  askResponse = undefined
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init?: RequestInit) => {
      seen.push({ path, init })
      let body: unknown
      if (path.endsWith('/capabilities'))
        body = {
          llm: true,
          model: 'fixture',
          embeddings: false,
          ocr: false,
          types: [{ icao: 'C172', documents: 1 }],
          search: { configured: false, provider: null },
        }
      else if (path.includes('/documents?')) body = { documents: [document] }
      else if (path.endsWith('/pages/1'))
        body = {
          document_id: 'doc_test',
          page: 1,
          label: '1',
          method: 'text',
          text: '<img src=x onerror=alert(1)> Performance page',
        }
      else if (path.endsWith('/search'))
        body = {
          passages: [{ document_id: 'doc_test', page: 1, text: 'Original performance page' }],
        }
      else if (path.endsWith('/ask'))
        body = askResponse
          ? await askResponse()
          : {
              insufficient_evidence: false,
              reason: '',
              claims: [
                {
                  text: 'The synthetic source says 900 feet.',
                  citations: [
                    {
                      document_id: 'doc_test',
                      page: 1,
                      label: '1',
                      quote: 'takeoff ground roll 900 feet',
                      method: 'text',
                    },
                  ],
                },
              ],
            }
      else body = { job: { id: 'job_one', state: 'queued', kind: 'index' } }
      return { ok: true, json: async () => body }
    }),
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function open() {
  render(<AircraftLibraryPage />)
  expect(seen).toHaveLength(0)
  fireEvent.change(screen.getByLabelText('Library access key'), {
    target: { value: 'private-test-token' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Open library' }))
  await screen.findByText(document.metadata.title)
}

it('keeps private access in headers, renders metadata as text and disables unconfigured discovery', async () => {
  await open()
  expect(seen.every((r) => !r.path.includes('private-test-token'))).toBe(true)
  expect(
    seen.every(
      (r) =>
        (r.init?.headers as Record<string, string>).Authorization === 'Bearer private-test-token',
    ),
  ).toBe(true)
  expect(window.localStorage.getItem('AIRCRAFT_LIBRARY_TOKEN')).toBeNull()
  expect(screen.getByRole('button', { name: 'Find and acquire web examples' })).toBeDisabled()
  expect(window.document.querySelector('script')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Lock library' }))
  await waitFor(() => expect(screen.queryByText(document.metadata.title)).toBeNull())
  expect(screen.getByLabelText('Library access key')).toHaveValue('')
})

it('shows cited answers and original page text safely', async () => {
  await open()
  fireEvent.change(
    screen.getByLabelText('Performance, systems, maintenance or procedure question'),
    { target: { value: 'What is the ground roll?' } },
  )
  fireEvent.click(screen.getByRole('button', { name: 'Ask with citations' }))
  await screen.findByText('The synthetic source says 900 feet.')
  fireEvent.click(screen.getByRole('button', { name: /Source .* PDF page 1/ }))
  await screen.findByText('<img src=x onerror=alert(1)> Performance page')
  expect(window.document.querySelector('img')).toBeNull()
})

it('discards an answer when the question changes during the request', async () => {
  await open()
  let resolve!: (value: unknown) => void
  askResponse = () =>
    new Promise((r) => {
      resolve = r
    })
  const input = screen.getByLabelText('Performance, systems, maintenance or procedure question')
  fireEvent.change(input, { target: { value: 'Old question' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ask with citations' }))
  await waitFor(() => expect(resolve).toBeDefined())
  fireEvent.change(input, { target: { value: 'New question' } })
  resolve({ insufficient_evidence: true, reason: 'Old answer must not appear', claims: [] })
  await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  expect(screen.queryByText(/Old answer must not appear/)).toBeNull()
})

it('sends PDF bytes with explicit ICAO and tail associations', async () => {
  await open()
  fireEvent.change(screen.getByLabelText('Associated registrations'), {
    target: { value: 'N123AB, N456CD' },
  })
  fireEvent.change(screen.getByLabelText('PDF manuals'), {
    target: { files: [new File(['%PDF-example'], 'manual.pdf', { type: 'application/pdf' })] },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Upload 1 PDF' }))
  await screen.findByText(/index: queued/)
  const upload = seen.find((r) => r.path.endsWith('/documents') && r.init?.method === 'POST')!
  const form = upload.init!.body as FormData
  expect(JSON.parse(String(form.get('metadata_json')))).toMatchObject({
    icao: 'C172',
    tails: ['N123AB', 'N456CD'],
  })
  expect((form.get('file') as File).name).toBe('manual.pdf')
})
