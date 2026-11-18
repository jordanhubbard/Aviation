import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import OCRReview from './OCRReview'

const sha = '1'.repeat(64),
  identity = '2'.repeat(64)
const context = {
  document_id: 'doc_test',
  source_sha256: sha,
  index_identity: identity,
  page_count: 3,
}
const preview = {
  ...context,
  id: 'ocr_preview_test',
  integrity_sha256: '3'.repeat(64),
  source_current: true,
  engine_version: 'tesseract test',
  mode: 'sparse',
  status: 'preview',
  pages: [
    {
      page: 1,
      label: 'i',
      width: 100,
      height: 100,
      error: null,
      fragments: [
        { id: 'fragment_1', text: '−36', offset: 0, bbox: [1, 1, 20, 10], confidence: 70 },
        {
          id: 'fragment_2',
          text: '<script>noise</script>',
          offset: 4,
          bbox: [1, 20, 30, 10],
          confidence: 12,
        },
      ],
    },
  ],
}
let request: ReturnType<typeof vi.fn>, onReviewed: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.stubGlobal(
    'URL',
    Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:private-image'),
      revokeObjectURL: vi.fn(),
    }),
  )
  request = vi.fn(async (path: string, options?: RequestInit, binary?: boolean) => {
    if (binary) return new Blob(['PNG fixture'], { type: 'image/png' })
    if (path.endsWith('/ocr')) return context
    if (options?.method === 'POST' && path.endsWith('/ocr-previews'))
      return { id: 'job_preview', state: 'completed', result: { preview_id: preview.id } }
    if (options?.method === 'POST' && path.endsWith('/ocr-reviews'))
      return {
        id: 'job_apply',
        state: 'completed',
        result: { review_id: 'ocr_review_test', embeddings: 'unavailable' },
      }
    if (path.endsWith('/ocr-reviews/ocr_review_test'))
      return {
        id: 'ocr_review_test',
        preview_id: preview.id,
        reviewer: 'Named reviewer',
        created_at: 'now',
        active: true,
        fragments: [{ ...preview.pages[0].fragments[0], page: 1, label: 'i' }],
      }
    return structuredClone(preview)
  })
  onReviewed = vi.fn(async () => {})
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
function component(locked = false) {
  return (
    <OCRReview
      documentId="doc_test"
      sourceSha256={sha}
      locked={locked}
      request={request}
      download={vi.fn()}
      onReviewed={onReviewed}
    />
  )
}
async function generate() {
  fireEvent.click(screen.getByRole('button', { name: 'Prepare OCR preview' }))
  fireEvent.change(await screen.findByLabelText('Physical PDF pages (comma separated)'), {
    target: { value: '1' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Generate selected-page preview' }))
  await screen.findByAltText('Original PDF page 1, label i')
}
it('loads only on explicit action and applies exact selected IDs after image review', async () => {
  render(component())
  fireEvent.click(screen.getByText('Review OCR for diagram labels'))
  expect(request).not.toHaveBeenCalled()
  await generate()
  expect(screen.getByLabelText('−36')).not.toBeChecked()
  expect(screen.getByLabelText('<script>noise</script>')).not.toBeChecked()
  expect(document.querySelector('script')).toBeNull()
  const apply = screen.getByRole('button', { name: 'Apply selected OCR fragments' })
  expect(apply).toBeDisabled()
  fireEvent.click(screen.getByLabelText('−36'))
  fireEvent.change(screen.getByLabelText('OCR reviewer name'), {
    target: { value: 'Named reviewer' },
  })
  fireEvent.click(
    screen.getByLabelText(
      'I compared every selected fragment with its original page image and confirm the selected OCR text matches.',
    ),
  )
  fireEvent.click(apply)
  await waitFor(() => expect(onReviewed).toHaveBeenCalledOnce())
  const call = request.mock.calls.find(
    ([path, options]) => path.endsWith('/ocr-reviews') && options?.method === 'POST',
  )!
  expect(JSON.parse(call[1]!.body as string)).toEqual({
    expected_sha256: sha,
    expected_index_identity: identity,
    preview_id: preview.id,
    preview_integrity_sha256: preview.integrity_sha256,
    selections: [{ page: 1, fragment_id: 'fragment_1' }],
    reviewer: 'Named reviewer',
    attest_matches_image: true,
  })
  expect(screen.getByText(/Selected OCR retained/)).toBeInTheDocument()
})
it('revokes private images and clears selected text on locking', async () => {
  const view = render(component())
  fireEvent.click(screen.getByText('Review OCR for diagram labels'))
  await generate()
  fireEvent.click(screen.getByLabelText('−36'))
  view.rerender(component(true))
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private-image')
  expect(screen.queryByAltText(/Original PDF page/)).not.toBeInTheDocument()
  expect(screen.queryByText('<script>noise</script>')).not.toBeInTheDocument()
})
it('cannot apply a stale retained preview', async () => {
  const original = request.getMockImplementation()!
  request.mockImplementation(async (...args) => {
    const result = await original(...args)
    return args[0].endsWith('/ocr-previews/' + preview.id)
      ? { ...preview, source_current: false }
      : result
  })
  render(component())
  fireEvent.click(screen.getByText('Review OCR for diagram labels'))
  await generate()
  expect(screen.getByLabelText('−36')).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Apply selected OCR fragments' })).toBeDisabled()
})

it('clears selections and attestation after a source conflict', async () => {
  const original = request.getMockImplementation()!
  request.mockImplementation(async (...args) => {
    if (args[0].endsWith('/ocr-reviews') && args[1]?.method === 'POST')
      throw new Error('Source changed; prepare a fresh preview')
    return original(...args)
  })
  render(component())
  fireEvent.click(screen.getByText('Review OCR for diagram labels'))
  await generate()
  fireEvent.click(screen.getByLabelText('−36'))
  fireEvent.change(screen.getByLabelText('OCR reviewer name'), {
    target: { value: 'Named reviewer' },
  })
  fireEvent.click(
    screen.getByLabelText(
      'I compared every selected fragment with its original page image and confirm the selected OCR text matches.',
    ),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Apply selected OCR fragments' }))
  await screen.findByText('Source changed; prepare a fresh preview')
  expect(screen.getByLabelText('−36')).not.toBeChecked()
  expect(screen.getByRole('button', { name: 'Apply selected OCR fragments' })).toBeDisabled()
})
