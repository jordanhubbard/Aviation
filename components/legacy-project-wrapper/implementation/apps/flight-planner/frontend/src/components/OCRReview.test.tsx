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
      image_sha256: '4'.repeat(64),
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
function component(locked = false, sourceLimits: { id: string; page: number }[] = []) {
  return (
    <OCRReview
      documentId="doc_test"
      sourceSha256={sha}
      sourceLimits={sourceLimits}
      locked={locked}
      request={request}
      download={vi.fn()}
      onReviewed={onReviewed}
    />
  )
}
async function generate() {
  fireEvent.click(screen.getByRole('button', { name: 'Prepare page review' }))
  fireEvent.change(await screen.findByLabelText('Physical PDF pages (comma separated)'), {
    target: { value: '1' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Generate selected-page preview' }))
  await screen.findByAltText('Original PDF page 1, label i')
}
const sourceAttestation =
  'I compared the original image and confirm that native text cannot establish its diagram relationships.'
it.each(['layout_relationships_unavailable', 'native_text_inaccurate'] as const)(
  'requires image comparison for %s, then clears private review state',
  async (reason) => {
    const original = request.getMockImplementation()!
    request.mockImplementation(async (...args) => {
      if (args[0].endsWith('/source-limits') && args[1]?.method === 'POST')
        return {
          id: 'job_source',
          state: 'completed',
          result: { source_limit_review_id: 'source_limit_test' },
        }
      if (args[0].endsWith('/source-limits/source_limit_test'))
        return {
          id: 'source_limit_test',
          document_id: 'doc_test',
          page: 1,
          preview_id: preview.id,
          source_sha256: sha,
          image_sha256: preview.pages[0].image_sha256,
          before_index_identity: identity,
          action: 'restrict',
          reason,
          active: true,
          current: true,
          reviewer: 'Codex (AI image review)',
          created_at: 'now',
        }
      return original(...args)
    })
    const view = render(component())
    fireEvent.click(screen.getByText('Review page OCR and transcriptions'))
    expect(request).not.toHaveBeenCalled()
    await generate()
    fireEvent.click(screen.getByText('Limit native text for this page'))
    const save = screen.getByRole('button', { name: 'Use original image only for this page' })
    expect(save).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Source-use reviewer name'), {
      target: { value: 'Codex (AI image review)' },
    })
    expect(save).toBeDisabled()
    fireEvent.click(screen.getByLabelText(sourceAttestation))
    if (reason === 'native_text_inaccurate') {
      fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Reason to limit native text' }))
      fireEvent.click(screen.getByRole('option', { name: 'Native text is inaccurate' }))
      expect(save).toBeDisabled()
      fireEvent.click(
        screen.getByLabelText(
          'I compared the original image and confirm that native words, signs or numbers are inaccurate.',
        ),
      )
    }
    fireEvent.click(save)
    await screen.findByText(/Native page text marked original-image-only/)
    await waitFor(() => expect(onReviewed).toHaveBeenCalledTimes(1))
    const call = request.mock.calls.find(
      ([path, options]) => path.endsWith('/source-limits') && options?.method === 'POST',
    )!
    expect(JSON.parse(call[1]!.body as string)).toEqual({
      action: 'restrict',
      reason,
      expected_sha256: sha,
      expected_index_identity: identity,
      preview_id: preview.id,
      preview_integrity_sha256: preview.integrity_sha256,
      page: 1,
      image_sha256: preview.pages[0].image_sha256,
      reviewer: 'Codex (AI image review)',
      attest_matches_image: true,
    })
    expect(request.mock.calls.some(([path]) => path.endsWith('/embeddings'))).toBe(false)
    expect(save).toBeDisabled()
    expect(
      screen.getByText(
        'Source-use reason: ' +
          (reason === 'native_text_inaccurate'
            ? 'Native text is inaccurate'
            : 'Diagram or table relationships unavailable'),
      ),
    ).toBeVisible()
    expect(screen.getByLabelText('Source-use reviewer name')).toHaveValue('')
    view.rerender(component(true))
    expect(screen.queryByText('Codex (AI image review)')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Source-use reviewer name')).not.toBeInTheDocument()
  },
)

it('re-enables restricted native text only after a fresh image and a distinct release attestation', async () => {
  const original = request.getMockImplementation()!
  request.mockImplementation(async (...args) => {
    if (args[0].endsWith('/source-limits') && args[1]?.method === 'POST')
      return {
        id: 'job_release',
        state: 'completed',
        result: { source_limit_review_id: 'source_limit_release' },
      }
    if (args[0].endsWith('/source-limits/source_limit_release'))
      return {
        id: 'source_limit_release',
        document_id: 'doc_test',
        page: 1,
        preview_id: preview.id,
        source_sha256: sha,
        image_sha256: preview.pages[0].image_sha256,
        before_index_identity: identity,
        action: 'release',
        reason: 'original_text_reviewed',
        active: false,
        current: true,
        reviewer: 'Image reviewer',
        created_at: 'now',
      }
    return original(...args)
  })
  render(component(false, [{ id: 'source_limit_previous', page: 1 }]))
  fireEvent.click(screen.getByText('Review page OCR and transcriptions'))
  await generate()
  fireEvent.click(screen.getByText('Limit native text for this page'))
  const release = screen.getByRole('button', { name: 'Re-enable native page text' })
  expect(release).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Source-use reviewer name'), {
    target: { value: 'Image reviewer' },
  })
  fireEvent.click(
    screen.getByLabelText(
      'I compared the current original image and confirm that native page text is suitable source evidence.',
    ),
  )
  fireEvent.click(release)
  await screen.findByText(/Native page text re-enabled by explicit review/)
  const call = request.mock.calls.find(
    ([path, options]) => path.endsWith('/source-limits') && options?.method === 'POST',
  )!
  expect(JSON.parse(call[1]!.body as string)).toMatchObject({
    action: 'release',
    reason: 'original_text_reviewed',
  })
})
it('loads only on explicit action and applies exact selected IDs after image review', async () => {
  render(component())
  fireEvent.click(screen.getByText('Review page OCR and transcriptions'))
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
  fireEvent.click(screen.getByText('Review page OCR and transcriptions'))
  await generate()
  fireEvent.click(screen.getByLabelText('−36'))
  view.rerender(component(true))
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private-image')
  expect(screen.queryByAltText(/Original PDF page/)).not.toBeInTheDocument()
  expect(screen.queryByText('<script>noise</script>')).not.toBeInTheDocument()
})

const transcriptionReceipt = {
  id: 'transcription_test',
  document_id: 'doc_test',
  preview_id: preview.id,
  page: 1,
  label: 'i',
  source_sha256: sha,
  source_metadata: { icao: 'C172' },
  reviewer: 'Page reviewer',
  created_at: 'now',
  active: true,
  source_current: true,
  method: 'operator_transcription',
  text: 'Literal <script>page text</script> −36 psi.',
  image_sha256: '4'.repeat(64),
}
function transcriptionTransport() {
  const original = request.getMockImplementation()!
  let saved = structuredClone(transcriptionReceipt)
  request.mockImplementation(async (...args) => {
    if (args[0].endsWith('/transcriptions') && args[1]?.method === 'POST') {
      saved = { ...transcriptionReceipt, text: JSON.parse(args[1].body as string).text }
      return {
        id: 'job_transcription',
        state: 'completed',
        result: { transcription_id: transcriptionReceipt.id, embeddings: 'unavailable' },
      }
    }
    if (args[0].endsWith('/transcriptions/' + transcriptionReceipt.id))
      return structuredClone(saved)
    return original(...args)
  })
}
async function draftTranscription() {
  fireEvent.click(screen.getByText('Transcribe visible page text'))
  fireEvent.change(screen.getByLabelText('Literal page transcription'), {
    target: { value: transcriptionReceipt.text },
  })
  fireEvent.change(screen.getByLabelText('Transcription reviewer name'), {
    target: { value: 'Page reviewer' },
  })
}
const transcriptionAttestation =
  'I compared this transcription with the original page image and confirm it contains only matching visible content.'

it('submits explicit literal transcription through a separate image-pinned channel', async () => {
  transcriptionTransport()
  render(component())
  fireEvent.click(screen.getByText('Review page OCR and transcriptions'))
  await generate()
  expect(screen.getByLabelText('Literal page transcription')).toHaveValue('')
  expect(screen.getByLabelText(transcriptionAttestation)).not.toBeChecked()
  await draftTranscription()
  const submit = screen.getByRole('button', { name: 'Save reviewed page transcription' })
  expect(submit).toBeDisabled()
  fireEvent.click(screen.getByLabelText(transcriptionAttestation))
  expect(submit).toBeEnabled()
  fireEvent.change(screen.getByLabelText('Literal page transcription'), {
    target: { value: transcriptionReceipt.text + '\n' },
  })
  expect(screen.getByLabelText(transcriptionAttestation)).not.toBeChecked()
  fireEvent.click(screen.getByLabelText(transcriptionAttestation))
  fireEvent.click(submit)
  await waitFor(() => expect(onReviewed).toHaveBeenCalledOnce())
  const call = request.mock.calls.find(
    ([path, options]) => path.endsWith('/transcriptions') && options?.method === 'POST',
  )!
  expect(JSON.parse(call[1]!.body as string)).toEqual({
    expected_sha256: sha,
    expected_index_identity: identity,
    preview_id: preview.id,
    preview_integrity_sha256: preview.integrity_sha256,
    page: 1,
    image_sha256: '4'.repeat(64),
    text: transcriptionReceipt.text + '\n',
    reviewer: 'Page reviewer',
    attest_matches_image: true,
  })
  expect(request.mock.calls.some(([path]) => path.endsWith('/ocr-reviews'))).toBe(false)
  expect(screen.getByText(transcriptionReceipt.text)).toBeVisible()
  expect(document.querySelector('script')).toBeNull()
  expect(screen.getByText(/Reviewed page transcription retained.*unavailable/)).toBeInTheDocument()
})

it('clears private transcription drafts and image URLs when locked', async () => {
  const view = render(component())
  fireEvent.click(screen.getByText('Review page OCR and transcriptions'))
  await generate()
  await draftTranscription()
  fireEvent.click(screen.getByLabelText(transcriptionAttestation))
  view.rerender(component(true))
  expect(screen.queryByLabelText('Literal page transcription')).not.toBeInTheDocument()
  expect(screen.queryByText(transcriptionReceipt.text)).not.toBeInTheDocument()
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private-image')
})

it('shows retained-source guidance after a transcription embedding-stage failure', async () => {
  const original = request.getMockImplementation()!
  request.mockImplementation(async (...args) =>
    args[0].endsWith('/transcriptions') && args[1]?.method === 'POST'
      ? { id: 'job_transcription', state: 'failed', error: 'Provider unavailable', result: null }
      : original(...args),
  )
  render(component())
  fireEvent.click(screen.getByText('Review page OCR and transcriptions'))
  await generate()
  await draftTranscription()
  fireEvent.click(screen.getByLabelText(transcriptionAttestation))
  fireEvent.click(screen.getByRole('button', { name: 'Save reviewed page transcription' }))
  await screen.findByText(/inspect page transcription history before retrying/)
  expect(screen.getByLabelText('Literal page transcription')).toHaveValue('')
  expect(screen.getByLabelText(transcriptionAttestation)).not.toBeChecked()
  expect(screen.getByRole('button', { name: 'Save reviewed page transcription' })).toBeDisabled()
  expect(onReviewed).not.toHaveBeenCalled()
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
  fireEvent.click(screen.getByText('Review page OCR and transcriptions'))
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
  fireEvent.click(screen.getByText('Review page OCR and transcriptions'))
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

it.each([
  {
    mode: 'table',
    label: 'Table grid suppression',
    notice: /Long table rules were suppressed for recognition/,
  },
  { mode: 'words', label: 'Individual recognized words', notice: /Words are shown individually/ },
])(
  'selects $mode OCR explicitly and reviews the unchanged original image before any apply',
  async ({ mode, label, notice }) => {
    const original = request.getMockImplementation()!
    request.mockImplementation(async (...args: Parameters<typeof original>) => {
      const value = await original(...args)
      if (args[0].endsWith('/ocr-previews/ocr_preview_test') && !args[1]?.method)
        return { ...value, mode }
      return value
    })
    render(component())
    fireEvent.click(screen.getByText('Review page OCR and transcriptions'))
    fireEvent.click(screen.getByRole('button', { name: 'Prepare page review' }))
    fireEvent.change(await screen.findByLabelText('Physical PDF pages (comma separated)'), {
      target: { value: '1' },
    })
    fireEvent.mouseDown(screen.getByLabelText('OCR layout'))
    fireEvent.click(await screen.findByRole('option', { name: label }))
    fireEvent.click(screen.getByRole('button', { name: 'Generate selected-page preview' }))
    await screen.findByAltText('Original PDF page 1, label i')
    expect(await screen.findByText(notice)).toBeVisible()
    const call = request.mock.calls.find(
      ([path, options]) => path.endsWith('/ocr-previews') && options?.method === 'POST',
    )!
    expect(JSON.parse(call[1]!.body as string).mode).toBe(mode)
    if (mode === 'words') {
      const calls = request.mock.calls.length
      fireEvent.change(screen.getByLabelText('Find recognized word (exact)'), {
        target: { value: 'unmatched' },
      })
      expect(screen.queryByLabelText('−36')).not.toBeInTheDocument()
      expect(request.mock.calls.length).toBe(calls)
      fireEvent.change(screen.getByLabelText('Find recognized word (exact)'), {
        target: { value: '−36' },
      })
      expect(screen.getByLabelText('−36')).not.toBeChecked()
      expect(request.mock.calls.length).toBe(calls)
    }
    expect(screen.getByRole('button', { name: 'Apply selected OCR fragments' })).toBeDisabled()
    expect(request.mock.calls.some(([path]) => path.endsWith('/ocr-reviews'))).toBe(false)
  },
)

it('rejects a source-use receipt for a different reason', async () => {
  const original = request.getMockImplementation()!
  request.mockImplementation(async (...args) => {
    if (args[0].endsWith('/source-limits') && args[1]?.method === 'POST')
      return {
        id: 'job_bad_reason',
        state: 'completed',
        result: { source_limit_review_id: 'source_limit_bad_reason' },
      }
    if (args[0].endsWith('/source-limits/source_limit_bad_reason'))
      return {
        id: 'source_limit_bad_reason',
        document_id: 'doc_test',
        page: 1,
        preview_id: preview.id,
        source_sha256: sha,
        image_sha256: preview.pages[0].image_sha256,
        before_index_identity: identity,
        action: 'restrict',
        reason: 'native_text_inaccurate',
        active: true,
      }
    return original(...args)
  })
  render(component())
  fireEvent.click(screen.getByText('Review page OCR and transcriptions'))
  await generate()
  fireEvent.click(screen.getByText('Limit native text for this page'))
  fireEvent.change(screen.getByLabelText('Source-use reviewer name'), {
    target: { value: 'Image reviewer' },
  })
  fireEvent.click(screen.getByLabelText(sourceAttestation))
  fireEvent.click(screen.getByRole('button', { name: 'Use original image only for this page' }))
  await screen.findByText('Source-use receipt does not match the reviewed page')
  expect(onReviewed).not.toHaveBeenCalled()
})
