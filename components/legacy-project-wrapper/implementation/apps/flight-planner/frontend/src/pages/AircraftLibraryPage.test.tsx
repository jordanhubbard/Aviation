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
let documentsResponse: unknown | undefined
let seen: { path: string; init?: RequestInit }[]
let askResponse: (() => Promise<unknown>) | undefined
let historyResponse: (() => Promise<unknown>) | undefined
const revision = 'a'.repeat(64)
const historicalSummary = {
  revision_id: revision,
  archived_at: '2026-11-17T00:00:00Z',
  reason: 'generation_changed',
  model: 'older-model',
  status: 'partial',
  completed_batches: 1,
  source_sha256: document.sha256,
}
const historicalRecord = {
  document_id: document.id,
  revision_id: revision,
  source_sha256: document.sha256,
  source_metadata: { ...document.metadata, revision: 'retained edition' },
  historical: true,
  eligible_for_resume: false,
  artifact: {
    status: 'partial',
    sections: [
      {
        pages: [1],
        insufficient_evidence: false,
        reason: '',
        claims: [
          {
            text: 'Retained source claim.',
            citations: [
              {
                document_id: document.id,
                page: 1,
                label: '1',
                quote: '<script>historical quote</script>',
                method: 'text',
              },
            ],
          },
        ],
      },
    ],
  },
}
beforeEach(() => {
  seen = []
  documentsResponse = undefined
  askResponse = undefined
  historyResponse = undefined
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
      else if (path.includes('/documents?')) body = documentsResponse ?? { documents: [document] }
      else if (path.includes('/jobs?'))
        body = { jobs: [], next_offset: null, total: 0, offset: 0, limit: 20 }
      else if (path.includes('/distillations?'))
        body = historyResponse
          ? await historyResponse()
          : { items: [historicalSummary], next_offset: null }
      else if (path.endsWith('/distillations/' + revision)) body = historicalRecord
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
      else
        body = {
          job: {
            id: 'job_one',
            state: 'queued',
            kind: 'index',
            subject: null,
            has_result: false,
            result: null,
            error: null,
            updated_at: '2026-11-17T00:00:00Z',
          },
        }
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
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Load documents' })).not.toBeDisabled(),
  )
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
  expect(screen.getByRole('button', { name: 'Ask with citations' })).not.toBeDisabled()
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
  await screen.findByText(/Process manual: queued/)
  const upload = seen.find((r) => r.path.endsWith('/documents') && r.init?.method === 'POST')!
  const form = upload.init!.body as FormData
  expect(JSON.parse(String(form.get('metadata_json')))).toMatchObject({
    icao: 'C172',
    tails: ['N123AB', 'N456CD'],
  })
  expect((form.get('file') as File).name).toBe('manual.pdf')
})

it('loads historical summaries only explicitly, retains old source context and clears private history on lock', async () => {
  await open()
  expect(seen.some((r) => r.path.includes('/distillations'))).toBe(false)
  fireEvent.click(
    screen.getByRole('button', { name: 'Load summary history for ' + document.metadata.title }),
  )
  fireEvent.click(
    await screen.findByRole('button', {
      name: 'Inspect historical summary ' + revision.slice(0, 12),
    }),
  )
  await screen.findByText('Retained source claim.')
  expect(screen.getByText(/Historical summary\. Its source metadata/)).toBeInTheDocument()
  expect(screen.getByText(/retained edition/)).toBeInTheDocument()
  expect(screen.getByText('<script>historical quote</script>')).toBeInTheDocument()
  expect(window.document.querySelector('script')).toBeNull()
  expect(
    screen.getByText('Retained source claim.').closest('[data-aviation-private]'),
  ).not.toBeNull()
  expect(JSON.stringify({ ...localStorage })).not.toContain('historical quote')
  fireEvent.click(screen.getByRole('button', { name: 'Lock library' }))
  await waitFor(() => expect(screen.queryByText('Retained source claim.')).toBeNull())
})

it('rejects a delayed history response after the private library scope changes', async () => {
  await open()
  let resolve!: (value: unknown) => void
  historyResponse = () =>
    new Promise((r) => {
      resolve = r
    })
  fireEvent.click(
    screen.getByRole('button', { name: 'Load summary history for ' + document.metadata.title }),
  )
  await waitFor(() => expect(resolve).toBeTypeOf('function'))
  fireEvent.change(screen.getByLabelText('Library access key'), {
    target: { value: 'different-private-key' },
  })
  resolve({ items: [historicalSummary], next_offset: null })
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: 'Inspect historical summary ' + revision.slice(0, 12) }),
    ).toBeNull(),
  )
})

it('paginates summary history explicitly and reports malformed history without inventing records', async () => {
  await open()
  historyResponse = async () => ({ items: [historicalSummary], next_offset: 20 })
  fireEvent.click(
    screen.getByRole('button', { name: 'Load summary history for ' + document.metadata.title }),
  )
  const older = await screen.findByRole('button', { name: 'Load older summaries' })
  historyResponse = async () => ({ items: [], next_offset: null })
  fireEvent.click(older)
  await waitFor(() =>
    expect(seen.some((r) => r.path.endsWith('/distillations?limit=20&offset=20'))).toBe(true),
  )
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Load older summaries' })).toBeNull(),
  )
  expect(
    screen.getAllByRole('button', { name: 'Inspect historical summary ' + revision.slice(0, 12) }),
  ).toHaveLength(1)
  historyResponse = async () => ({ items: [{ revision_id: '../invalid' }], next_offset: null })
  fireEvent.click(
    screen.getByRole('button', { name: 'Load summary history for ' + document.metadata.title }),
  )
  await screen.findByText('Invalid distillation history response')
})

it.each(['partial', 'complete'])(
  'shows reused-section provenance with honest %s coverage',
  async (status) => {
    documentsResponse = {
      documents: [
        {
          ...document,
          artifacts: {
            distillation: {
              status,
              sections: [],
              recovery: { kind: 'reviewed_ocr_prefix', recovered_batches: 2, recovered_claims: 3 },
            },
          },
        },
      ],
    }
    await open()
    fireEvent.click(await screen.findByText(`LLM distillation (${status})`))
    expect(
      await screen.findByText(
        /Previously validated sections reused after source review: 2 batches and 3 claims/,
      ),
    ).toBeVisible()
    if (status === 'partial')
      expect(screen.getByText(/Additional evidence remains unresolved/)).toBeVisible()
    else
      expect(screen.queryByText(/Additional evidence remains unresolved/)).not.toBeInTheDocument()
  },
)
