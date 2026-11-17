import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import BlankPageReview from './BlankPageReview'

const sha = '1'.repeat(64),
  identity = '2'.repeat(64),
  id = 'review_' + 'a'.repeat(32)
const preview = {
  extraction_status: 'partial',
  document_id: 'doc_test',
  source_sha256: sha,
  index_identity: identity,
  page_count: 4,
  total: 3,
  offset: 0,
  limit: 100,
  next_offset: null,
  items: [2, 3, 4].map((page) => ({
    page,
    label: String(page),
    method: page === 4 ? 'blank' : 'missing',
    error: page === 4 ? null : 'No readable text',
    reviewable: page !== 4,
    verification: page === 4 ? { kind: 'rendered_pure_white', renderer: 'pdfium' } : null,
  })),
}
const record = {
  document_id: 'doc_test',
  source_sha256: sha,
  before_index_identity: identity,
  after_index_identity: '3'.repeat(64),
  review_id: id,
  pages: [2],
  reviewer: 'Named reviewer',
  recorded_at: '2026-11-17T00:00:00Z',
  integrity_sha256: '4'.repeat(64),
  attest_no_text_or_graphics: true as const,
  source_metadata: { title: '<script>Original title</script>', variant: 'S', revision: 'R1' },
}
let request: ReturnType<typeof vi.fn>,
  download: ReturnType<typeof vi.fn>,
  onReviewed: ReturnType<typeof vi.fn>
beforeEach(() => {
  request = vi.fn(async (path: string, options?: RequestInit) => {
    if (path.includes('/blank-pages?')) return structuredClone(preview)
    if (options?.method === 'POST') return structuredClone(record)
    if (path.includes('/blank-page-reviews?'))
      return { document_id: 'doc_test', items: [record], next_offset: null }
    return structuredClone(record)
  })
  download = vi.fn(async () => {})
  onReviewed = vi.fn(async () => {})
})
afterEach(cleanup)
function view(locked = false) {
  const value = render(
    <BlankPageReview
      documentId="doc_test"
      sourceSha256={sha}
      locked={locked}
      request={request}
      download={download}
      onReviewed={onReviewed}
    />,
  )
  fireEvent.click(screen.getByText('Blank and unreadable page review'))
  return value
}
async function load() {
  fireEvent.click(screen.getByRole('button', { name: 'Load blank and unreadable pages' }))
  await screen.findByText('Entire rendered page is white')
}
function select() {
  fireEvent.click(screen.getByLabelText('Review page 2 (label 2) as blank'))
  fireEvent.change(screen.getByLabelText('Blank-page reviewer'), {
    target: { value: 'Named reviewer' },
  })
}
const attest = () =>
  screen.getByLabelText(
    'I inspected every selected original page and attest that it contains no text or graphics',
  )
const save = () => screen.getByRole('button', { name: 'Save selected blank-page review' })

it('loads nothing implicitly and downloads the retained original only on explicit request', async () => {
  view()
  expect(request).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Download original for blank-page review' }))
  await waitFor(() => expect(download).toHaveBeenCalledOnce())
  expect(request).not.toHaveBeenCalled()
})
it('requires explicit pages, reviewer and attestation and posts the exact source identities', async () => {
  view()
  await load()
  expect(save()).toBeDisabled()
  expect(screen.getByLabelText('Review page 2 (label 2) as blank')).not.toBeChecked()
  select()
  expect(save()).toBeDisabled()
  fireEvent.click(attest())
  fireEvent.click(save())
  await screen.findByRole('region', { name: 'Saved blank-page audit' })
  const call = request.mock.calls.find(([, options]) => options?.method === 'POST')
  expect(JSON.parse(call![1]!.body as string)).toEqual({
    pages: [2],
    reviewer: 'Named reviewer',
    attest_no_text_or_graphics: true,
    expected_sha256: sha,
    expected_index_identity: identity,
  })
  expect(onReviewed).toHaveBeenCalledOnce()
  expect(screen.queryByLabelText('Review page 3 (label 3) as blank')).not.toBeInTheDocument()
  expect(document.querySelector('script')).toBeNull()
  expect(screen.getByText(/<script>Original title/)).toBeInTheDocument()
})
it('changing a page choice or reviewer requires a new attestation', async () => {
  view()
  await load()
  select()
  fireEvent.click(attest())
  expect(save()).toBeEnabled()
  fireEvent.click(screen.getByLabelText('Review page 3 (label 3) as blank'))
  expect(attest()).not.toBeChecked()
  fireEvent.click(attest())
  fireEvent.change(screen.getByLabelText('Blank-page reviewer'), {
    target: { value: 'Another reviewer' },
  })
  expect(attest()).not.toBeChecked()
  expect(save()).toBeDisabled()
})
it('does not let active document work be reviewed', async () => {
  view(true)
  await load()
  expect(screen.getByLabelText('Review page 2 (label 2) as blank')).toBeDisabled()
  expect(save()).toBeDisabled()
  expect(request.mock.calls.every(([, options]) => options?.method !== 'POST')).toBe(true)
})
it('discards selected pages after a stale or failed mutation and requires an explicit reload', async () => {
  request.mockImplementation(async (path: string, options?: RequestInit) => {
    if (options?.method === 'POST')
      throw new Error('Source or extraction changed; reload the blank-page review')
    return structuredClone(preview)
  })
  view()
  await load()
  select()
  fireEvent.click(attest())
  fireEvent.click(save())
  await screen.findByText('Source or extraction changed; reload the blank-page review')
  expect(
    screen.queryByRole('button', { name: 'Save selected blank-page review' }),
  ).not.toBeInTheDocument()
  expect(onReviewed).not.toHaveBeenCalled()
})
it('loads audit history and integrity-identified detail only explicitly', async () => {
  view()
  expect(request).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Load blank-page audit history' }))
  await screen.findByRole('button', { name: 'Inspect blank-page audit ' + id })
  expect(screen.queryByRole('region', { name: 'Saved blank-page audit' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Inspect blank-page audit ' + id }))
  await screen.findByRole('region', { name: 'Saved blank-page audit' })
  expect(screen.getByText(/not automatic approval for a later extraction/)).toBeInTheDocument()
})
it('clears a pending prior-document response and all review choices when the source changes', async () => {
  let finish: (v: unknown) => void = () => {}
  request.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve
    }),
  )
  const rendered = view()
  fireEvent.click(screen.getByRole('button', { name: 'Load blank and unreadable pages' }))
  rendered.rerender(
    <BlankPageReview
      documentId="doc_other"
      sourceSha256={'5'.repeat(64)}
      locked={false}
      request={request}
      download={download}
      onReviewed={onReviewed}
    />,
  )
  finish(preview)
  await waitFor(() =>
    expect(screen.queryByText('Entire rendered page is white')).not.toBeInTheDocument(),
  )
  expect(screen.queryByLabelText('Blank-page reviewer')).not.toBeInTheDocument()
})
it('rejects malformed or foreign-source page lists', async () => {
  request.mockResolvedValueOnce({ ...preview, source_sha256: '6'.repeat(64) })
  view()
  fireEvent.click(screen.getByRole('button', { name: 'Load blank and unreadable pages' }))
  await screen.findByText('Invalid blank-page review response')
  expect(screen.queryByLabelText('Blank-page reviewer')).not.toBeInTheDocument()
})
it('rejects changed extraction identity during review pagination', async () => {
  request.mockResolvedValueOnce({ ...preview, total: 4, next_offset: 3 })
  request.mockResolvedValueOnce({
    ...preview,
    index_identity: '7'.repeat(64),
    offset: 3,
    total: 4,
    items: [{ ...preview.items[0], page: 5 }],
    next_offset: null,
  })
  view()
  await load()
  fireEvent.click(screen.getByRole('button', { name: 'Load more review pages' }))
  await screen.findByText('Extraction changed; reload the blank-page review')
  expect(screen.queryByLabelText('Blank-page reviewer')).not.toBeInTheDocument()
})

it('keeps an unprocessed source unknown when no candidate pages exist', async () => {
  request.mockResolvedValueOnce({
    ...preview,
    extraction_status: 'stored',
    page_count: 0,
    total: 0,
    items: [],
  })
  view()
  fireEvent.click(screen.getByRole('button', { name: 'Load blank and unreadable pages' }))
  await screen.findByText(/No extraction is available; process the manual before reviewing pages/)
  expect(save()).toBeDisabled()
  expect(request.mock.calls.every(([, options]) => options?.method !== 'POST')).toBe(true)
})
