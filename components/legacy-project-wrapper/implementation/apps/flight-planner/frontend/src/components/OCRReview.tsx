import {
  AircraftLibraryOCRClient,
  type AircraftOCRMode,
  type AircraftPageTranscription,
  type AircraftSourceLimitRecord,
} from '@aviation/shared-sdk/aviation/aircraft-library'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'

type Context = {
  document_id: string
  source_sha256: string
  index_identity: string
  page_count: number
}
type Fragment = { id: string; text: string; offset: number; bbox: number[]; confidence: number }
type Page = {
  page: number
  label: string
  width: number
  height: number
  fragments: Fragment[]
  error: string | null
  image_sha256: string
}
type Preview = Context & {
  source_metadata?: Record<string, unknown>
  id: string
  integrity_sha256: string
  source_current: boolean
  mode: string
  engine_version: string
  status: string
  pages: Page[]
}
type Review = {
  source_metadata?: Record<string, unknown>
  source_sha256?: string
  id: string
  preview_id: string
  reviewer: string
  created_at: string
  active: boolean
  fragments: (Fragment & { page: number; label: string })[]
}
type History = { items: { id: string; created_at: string }[]; next_offset: number | null }
type Job = {
  id: string
  state: string
  error: string | null
  result: {
    preview_id?: string
    review_id?: string
    transcription_id?: string
    source_limit_review_id?: string
    embeddings?: string
  } | null
}
type Props = {
  documentId: string
  sourceSha256: string
  sourceLimits?: { id: string; page: number }[]
  locked: boolean
  request: (path: string, options?: RequestInit, binary?: boolean) => Promise<unknown>
  download: () => Promise<void>
  onReviewed: () => Promise<void>
}

export default function OCRReview({
  documentId,
  sourceSha256,
  sourceLimits = [],
  locked,
  request,
  download,
  onReviewed,
}: Props) {
  const [context, setContext] = useState<Context | null>(null)
  const [pages, setPages] = useState('')
  const [mode, setMode] = useState<AircraftOCRMode>('sparse')
  const [wordFilter, setWordFilter] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [number, setNumber] = useState(0)
  const [image, setImage] = useState('')
  const [zoom, setZoom] = useState(false)
  const [selected, setSelected] = useState<{ page: number; fragment_id: string }[]>([])
  const [reviewer, setReviewer] = useState('')
  const [attested, setAttested] = useState(false)
  const [history, setHistory] = useState<History | null>(null)
  const [historyKind, setHistoryKind] = useState<
    'ocr-previews' | 'ocr-reviews' | 'transcriptions' | 'source-limits'
  >('ocr-previews')
  const [review, setReview] = useState<Review | null>(null)
  const [draft, setDraft] = useState('')
  const [transcriptionReviewer, setTranscriptionReviewer] = useState('')
  const [transcriptionAttested, setTranscriptionAttested] = useState(false)
  const [transcription, setTranscription] = useState<AircraftPageTranscription | null>(null)
  const [sourceReviewer, setSourceReviewer] = useState('')
  const [sourceAttested, setSourceAttested] = useState(false)
  const [sourceReview, setSourceReview] = useState<AircraftSourceLimitRecord | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const epoch = useRef(0)
  const invalidate = useCallback(() => {
    epoch.current++
  }, [])
  const imageURL = useRef('')
  const client = new AircraftLibraryOCRClient(request)
  function releaseImage() {
    if (imageURL.current) URL.revokeObjectURL(imageURL.current)
    imageURL.current = ''
    setImage('')
    setDraft('')
    setTranscriptionReviewer('')
    setTranscriptionAttested(false)
    setSourceReviewer('')
    setSourceAttested(false)
  }
  useEffect(() => {
    invalidate()
    setContext(null)
    setPages('')
    setPreview(null)
    setSelected([])
    setWordFilter('')
    setReviewer('')
    setAttested(false)
    setHistory(null)
    setReview(null)
    setDraft('')
    setTranscriptionReviewer('')
    setTranscriptionAttested(false)
    setTranscription(null)
    setSourceReviewer('')
    setSourceAttested(false)
    setSourceReview(null)
    setStatus('')
    setError('')
    setBusy(false)
    setZoom(false)
    if (imageURL.current) URL.revokeObjectURL(imageURL.current)
    imageURL.current = ''
    setImage('')
    return () => {
      invalidate()
      if (imageURL.current) URL.revokeObjectURL(imageURL.current)
      imageURL.current = ''
    }
  }, [documentId, sourceSha256, locked, invalidate])
  async function run(action: (current: number) => Promise<void>) {
    const current = ++epoch.current
    setBusy(true)
    setError('')
    try {
      await action(current)
    } catch (e) {
      if (current === epoch.current && !(e instanceof DOMException && e.name === 'AbortError')) {
        setError(e instanceof Error ? e.message : 'OCR review failed')
        setSelected([])
        setWordFilter('')
        setAttested(false)
        setDraft('')
        setTranscriptionAttested(false)
        setSourceAttested(false)
        setContext(null)
        setPreview((value) => (value ? { ...value, source_current: false } : null))
      }
    } finally {
      if (current === epoch.current) setBusy(false)
    }
  }
  async function loadImage(value: Preview, physicalPage: number, current: number) {
    releaseImage()
    setNumber(physicalPage)
    const blob = await client.image(documentId, value.id, physicalPage)
    if (current !== epoch.current) return
    if (!(blob instanceof Blob) || blob.type !== 'image/png')
      throw new Error('OCR page image is unavailable')
    imageURL.current = URL.createObjectURL(blob)
    setImage(imageURL.current)
  }
  async function loadPreview(id: string, current: number, physicalPage?: number) {
    releaseImage()
    setPreview(null)
    setSelected([])
    setWordFilter('')
    setAttested(false)
    const value = await client.preview(documentId, id)
    if (current !== epoch.current) return
    if (
      value.document_id !== documentId ||
      value.source_sha256 !== sourceSha256 ||
      !Array.isArray(value.pages) ||
      !value.pages.length
    )
      throw new Error('OCR preview source does not match this document')
    setPreview(value)
    await loadImage(value, physicalPage ?? value.pages[0].page, current)
  }
  async function waitForJob(initial: Job, current: number, channel = 'OCR') {
    let job = initial
    while (current === epoch.current && ['queued', 'running'].includes(job.state)) {
      setStatus(`${channel} job ${job.state}`)
      await new Promise((resolve) => setTimeout(resolve, 1000))
      if (current !== epoch.current) return null
      job = await client.job(job.id)
      if (job.id !== initial.id) throw new Error('OCR job identity changed')
    }
    if (current !== epoch.current) return null
    if (job.state !== 'completed')
      throw new Error(
        (job.error || 'OCR job did not complete') +
          `. If this was an application, inspect ${channel === 'OCR' ? 'OCR review' : channel === 'Source use' ? 'source-use review' : 'page transcription'} history before retrying: its source stage may already be retained.`,
      )
    return job
  }
  async function loadHistory(kind: typeof historyKind, current: number, offset = 0) {
    const value =
      kind === 'transcriptions'
        ? await client.transcriptions(documentId, offset)
        : kind === 'source-limits'
          ? await client.sourceLimits(documentId, offset)
          : await client.history(documentId, kind, offset)
    if (current !== epoch.current) return
    setHistoryKind(kind)
    setHistory(offset ? { ...value, items: [...(history?.items || []), ...value.items] } : value)
  }
  const currentPage = preview?.pages.find((p) => p.page === number)
  const pageLimited = sourceLimits.some((r) => r.page === number)
  const disabled = busy || locked
  return (
    <Box component="details" sx={{ mt: 2 }}>
      <summary>Review page OCR and transcriptions</summary>
      <Stack spacing={2} sx={{ mt: 2, minWidth: 0 }}>
        <Alert severity="warning">
          OCR can misread signs, labels and drawing lines. Compare each selected fragment with the
          original page image. This review does not approve performance data or aircraft
          applicability.
        </Alert>
        {error && <Alert severity="error">{error}</Alert>}
        {status && <Typography role="status">{status}</Typography>}
        <Stack direction="row" flexWrap="wrap" gap={1}>
          <Button
            disabled={disabled}
            onClick={() =>
              void run(async (current) => {
                const value = await client.context(documentId)
                if (current !== epoch.current) return
                if (value.document_id !== documentId || value.source_sha256 !== sourceSha256)
                  throw new Error('OCR source changed')
                releaseImage()
                setPreview(null)
                setSelected([])
                setWordFilter('')
                setAttested(false)
                setContext(value)
              })
            }
          >
            Prepare page review
          </Button>
          <Button disabled={disabled} onClick={() => void run(() => download())}>
            Download original PDF
          </Button>
          <Button
            disabled={disabled}
            onClick={() => void run((e) => loadHistory('ocr-previews', e))}
          >
            Retained previews
          </Button>
          <Button
            disabled={disabled}
            onClick={() => void run((e) => loadHistory('ocr-reviews', e))}
          >
            OCR review history
          </Button>
          <Button
            disabled={disabled}
            onClick={() => void run((e) => loadHistory('transcriptions', e))}
          >
            Page transcription history
          </Button>
          <Button
            disabled={disabled}
            onClick={() => void run((e) => loadHistory('source-limits', e))}
          >
            Source-use review history
          </Button>
        </Stack>
        {context && (
          <Stack spacing={2}>
            <Typography variant="body2">
              Select up to ten physical PDF pages, from 1 to {context.page_count}. Native page text
              will be preserved.
            </Typography>
            <TextField
              label="Physical PDF pages (comma separated)"
              value={pages}
              disabled={disabled}
              onChange={(e) => setPages(e.target.value)}
            />
            <TextField
              select
              label="OCR layout"
              value={mode}
              disabled={disabled}
              onChange={(e) => setMode(e.target.value as AircraftOCRMode)}
            >
              <MenuItem value="sparse">Sparse labels and diagrams</MenuItem>
              <MenuItem value="normal">Normal page layout</MenuItem>
              <MenuItem value="table">Table grid suppression</MenuItem>
              <MenuItem value="words">Individual recognized words</MenuItem>
            </TextField>
            <Button
              disabled={disabled || !pages.trim()}
              onClick={() =>
                void run(async (current) => {
                  const numbers = pages.split(',').map((v) => Number(v.trim()))
                  if (
                    !numbers.length ||
                    numbers.length > 10 ||
                    new Set(numbers).size !== numbers.length ||
                    numbers.some((p) => !Number.isInteger(p) || p < 1 || p > context.page_count)
                  )
                    throw new Error('Select 1–10 distinct physical pages within the document')
                  releaseImage()
                  setPreview(null)
                  setSelected([])
                  setWordFilter('')
                  setAttested(false)
                  setReview(null)
                  const queued = await client.queuePreview(documentId, {
                    pages: numbers,
                    mode,
                    expected_sha256: context.source_sha256,
                    expected_index_identity: context.index_identity,
                  })
                  if (current !== epoch.current) return
                  const done = await waitForJob(queued, current)
                  if (done?.result?.preview_id) {
                    setStatus('OCR preview ready; no fragments approved')
                    await loadPreview(done.result.preview_id, current)
                  }
                })
              }
            >
              Generate selected-page preview
            </Button>
          </Stack>
        )}
        {preview && (
          <Stack spacing={2}>
            {!preview.source_current && (
              <Alert severity="warning">
                Historical preview: the source index or metadata changed. Prepare a fresh preview
                before applying fragments.
              </Alert>
            )}
            <Typography variant="body2">
              {preview.engine_version} · {preview.mode} layout · {preview.status}. OCR confidence
              reflects recognition uncertainty.
            </Typography>
            {preview.mode === 'words' && (
              <Alert severity="info">
                Words are shown individually. Select only complete words that match the original
                page. Other words in the same line remain unapproved.
              </Alert>
            )}
            {preview.mode === 'table' && (
              <Alert severity="info">
                Long table rules were suppressed for recognition. The review image is the untouched
                original page. Suppression can damage text; compare every selected fragment with it.
              </Alert>
            )}
            <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
              Original SHA-256 {preview.source_sha256}. Source association:{' '}
              {String(preview.source_metadata?.icao || 'unknown type')}, variant{' '}
              {String(preview.source_metadata?.variant || 'unknown')}, revision{' '}
              {String(preview.source_metadata?.revision || 'unknown')}.
            </Typography>
            <Stack direction="row" gap={1} flexWrap="wrap">
              {preview.pages.map((p) => (
                <Button
                  key={p.page}
                  disabled={disabled}
                  onClick={() => void run((e) => loadImage(preview, p.page, e))}
                >
                  PDF page {p.page} (label {p.label})
                </Button>
              ))}
              <Button disabled={disabled || !image} onClick={() => setZoom(!zoom)}>
                {zoom ? 'Fit page' : 'Zoom page'}
              </Button>
            </Stack>
            {currentPage && (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'minmax(0, 1fr)',
                    lg: 'minmax(0, 1fr) minmax(240px, 1fr)',
                  },
                  gap: 2,
                }}
              >
                <Box
                  sx={{
                    overflow: 'auto',
                    maxHeight: '75vh',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  {image ? (
                    <Box sx={{ position: 'relative', width: zoom ? currentPage.width : '100%' }}>
                      <Box
                        component="img"
                        src={image}
                        alt={`Original PDF page ${currentPage.page}, label ${currentPage.label}`}
                        sx={{ display: 'block', width: '100%' }}
                      />
                      <svg
                        aria-hidden="true"
                        viewBox={`0 0 ${currentPage.width} ${currentPage.height}`}
                        style={{
                          position: 'absolute',
                          inset: 0,
                          width: '100%',
                          height: '100%',
                          pointerEvents: 'none',
                        }}
                      >
                        {currentPage.fragments
                          .filter((f) =>
                            selected.some(
                              (s) => s.page === currentPage.page && s.fragment_id === f.id,
                            ),
                          )
                          .map((f) => (
                            <rect
                              key={f.id}
                              x={f.bbox[0]}
                              y={f.bbox[1]}
                              width={f.bbox[2]}
                              height={f.bbox[3]}
                              fill="none"
                              stroke="#005fcc"
                              strokeWidth="3"
                            />
                          ))}
                      </svg>
                    </Box>
                  ) : (
                    <Typography>Load the page image before selecting its fragments.</Typography>
                  )}
                </Box>
                <Stack spacing={1}>
                  <Box component="details">
                    <summary>Limit native text for this page</summary>
                    <Stack spacing={2} sx={{ mt: 2 }}>
                      <Alert severity={pageLimited ? 'warning' : 'info'}>
                        {pageLimited
                          ? 'Native text from this page is original-image-only. It remains searchable, but cannot support generated claims. Compare a fresh page image before re-enabling it.'
                          : 'Flattened diagrams can associate numbers with the wrong labels. Mark native text as original-image-only when it cannot establish the relationships. Originals and reviewed literal sources are preserved; coverage remains partial.'}
                      </Alert>
                      <TextField
                        label="Source-use reviewer name"
                        helperText="Identify yourself; label agent reviews as such."
                        value={sourceReviewer}
                        inputProps={{ maxLength: 200 }}
                        disabled={disabled || !image || !preview.source_current}
                        onChange={(e) => {
                          setSourceReviewer(e.target.value)
                          setSourceAttested(false)
                        }}
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={sourceAttested}
                            disabled={
                              disabled ||
                              !image ||
                              !preview.source_current ||
                              !sourceReviewer.trim()
                            }
                            onChange={(e) => setSourceAttested(e.target.checked)}
                          />
                        }
                        label={
                          pageLimited
                            ? 'I compared the current original image and confirm that native page text is suitable source evidence.'
                            : 'I compared the original image and confirm that native text cannot establish its diagram relationships.'
                        }
                      />
                      <Button
                        disabled={
                          disabled ||
                          !image ||
                          !preview.source_current ||
                          !sourceReviewer.trim() ||
                          !sourceAttested
                        }
                        onClick={() =>
                          void run(async (current) => {
                            const source = await client.context(documentId)
                            if (current !== epoch.current) return
                            if (
                              source.index_identity !== preview.index_identity ||
                              source.source_sha256 !== preview.source_sha256
                            )
                              throw new Error('Source changed; prepare a fresh page review')
                            const decision = pageLimited
                              ? {
                                  action: 'release' as const,
                                  reason: 'original_text_reviewed' as const,
                                }
                              : {
                                  action: 'restrict' as const,
                                  reason: 'layout_relationships_unavailable' as const,
                                }
                            const queued = await client.reviewSourceUse(documentId, {
                              ...decision,
                              expected_sha256: source.source_sha256,
                              expected_index_identity: source.index_identity,
                              preview_id: preview.id,
                              preview_integrity_sha256: preview.integrity_sha256,
                              page: currentPage.page,
                              image_sha256: currentPage.image_sha256,
                              reviewer: sourceReviewer,
                              attest_matches_image: true,
                            })
                            if (current !== epoch.current) return
                            const done = await waitForJob(queued, current, 'Source use')
                            if (!done?.result?.source_limit_review_id) return
                            const value = await client.sourceLimit(
                              documentId,
                              done.result.source_limit_review_id,
                            )
                            if (current !== epoch.current) return
                            if (
                              value.document_id !== documentId ||
                              value.page !== currentPage.page ||
                              value.action !== decision.action ||
                              value.source_sha256 !== sourceSha256 ||
                              value.image_sha256 !== currentPage.image_sha256 ||
                              value.before_index_identity !== preview.index_identity
                            )
                              throw new Error('Source-use receipt does not match the reviewed page')
                            setSourceReview(value)
                            setSourceReviewer('')
                            setSourceAttested(false)
                            setSelected([])
                            setAttested(false)
                            setDraft('')
                            setTranscriptionAttested(false)
                            setContext(null)
                            setPreview({ ...preview, source_current: false })
                            setStatus(
                              decision.action === 'restrict'
                                ? 'Native page text marked original-image-only. Generated coverage remains partial; inspect historical summaries before using them.'
                                : 'Native page text re-enabled by explicit review. Generate a new distillation when ready; old interpretations are not automatically admitted.',
                            )
                            await onReviewed()
                          })
                        }
                      >
                        {pageLimited
                          ? 'Re-enable native page text'
                          : 'Use original image only for this page'}
                      </Button>
                    </Stack>
                  </Box>
                  <Box component="details">
                    <summary>Transcribe visible page text</summary>
                    <Stack spacing={2} sx={{ mt: 2 }}>
                      <Alert severity="info">
                        Type only content visible on this original page, preserving signs, units and
                        table layout. This is operator transcription, separate from machine OCR. It
                        does not approve performance data or aircraft applicability.
                      </Alert>
                      <TextField
                        label="Literal page transcription"
                        multiline
                        minRows={4}
                        value={draft}
                        disabled={disabled || !image || !preview.source_current}
                        inputProps={{ maxLength: 12000 }}
                        helperText="8–12,000 characters. Do not infer values or add explanations."
                        onChange={(e) => {
                          setDraft(e.target.value)
                          setTranscriptionAttested(false)
                        }}
                      />
                      <TextField
                        label="Transcription reviewer name"
                        helperText="Identify yourself; label agent reviews as such."
                        value={transcriptionReviewer}
                        disabled={disabled || !image || !preview.source_current}
                        inputProps={{ maxLength: 200 }}
                        onChange={(e) => {
                          setTranscriptionReviewer(e.target.value)
                          setTranscriptionAttested(false)
                        }}
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={transcriptionAttested}
                            disabled={
                              disabled ||
                              !image ||
                              !preview.source_current ||
                              draft.trim().length < 8
                            }
                            onChange={(e) => setTranscriptionAttested(e.target.checked)}
                          />
                        }
                        label="I compared this transcription with the original page image and confirm it contains only matching visible content."
                      />
                      <Button
                        disabled={
                          disabled ||
                          !image ||
                          !preview.source_current ||
                          !currentPage.image_sha256 ||
                          draft.trim().length < 8 ||
                          draft.length > 12000 ||
                          !transcriptionReviewer.trim() ||
                          !transcriptionAttested
                        }
                        onClick={() =>
                          void run(async (current) => {
                            const queued = await client.transcribe(documentId, {
                              expected_sha256: preview.source_sha256,
                              expected_index_identity: preview.index_identity,
                              preview_id: preview.id,
                              preview_integrity_sha256: preview.integrity_sha256,
                              page: currentPage.page,
                              image_sha256: currentPage.image_sha256,
                              text: draft,
                              reviewer: transcriptionReviewer,
                              attest_matches_image: true,
                            })
                            if (current !== epoch.current) return
                            const done = await waitForJob(queued, current, 'Transcription')
                            if (!done) return
                            if (!done.result?.transcription_id)
                              throw new Error(
                                'Transcription receipt unavailable; inspect the job before retrying',
                              )
                            const value = await client.transcription(
                              documentId,
                              done.result.transcription_id,
                            )
                            if (current !== epoch.current) return
                            if (
                              value.document_id !== documentId ||
                              value.source_sha256 !== sourceSha256 ||
                              value.preview_id !== preview.id ||
                              value.page !== currentPage.page ||
                              value.image_sha256 !== currentPage.image_sha256 ||
                              value.text !== draft
                            )
                              throw new Error(
                                'Transcription receipt does not match the reviewed page and text',
                              )
                            setTranscription(value)
                            setDraft('')
                            setTranscriptionAttested(false)
                            setSelected([])
                            setAttested(false)
                            setContext(null)
                            setPreview({ ...preview, source_current: false })
                            setStatus(
                              `Reviewed page transcription retained. Semantic indexing: ${done.result.embeddings || 'inspect job'}. Generate a new distillation explicitly when ready.`,
                            )
                            await onReviewed()
                          })
                        }
                      >
                        Save reviewed page transcription
                      </Button>
                    </Stack>
                  </Box>
                  {currentPage.error && <Alert severity="warning">{currentPage.error}</Alert>}
                  {!currentPage.fragments.length && (
                    <Typography>
                      No readable OCR fragments on this page. Native extraction status is unchanged.
                    </Typography>
                  )}
                  {preview.mode === 'words' && (
                    <TextField
                      label="Find recognized word (exact)"
                      value={wordFilter}
                      onChange={(e) => setWordFilter(e.target.value)}
                      helperText="Filters this list locally. Hidden selections remain counted below."
                    />
                  )}
                  <Stack spacing={1} sx={{ maxHeight: '75vh', overflow: 'auto' }}>
                    {currentPage.fragments
                      .filter(
                        (f) =>
                          preview.mode !== 'words' ||
                          !wordFilter.trim() ||
                          f.text.toLowerCase() === wordFilter.trim().toLowerCase(),
                      )
                      .map((f) => {
                        const checked = selected.some(
                          (s) => s.page === currentPage.page && s.fragment_id === f.id,
                        )
                        return (
                          <Box key={f.id}>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={checked}
                                  disabled={
                                    disabled ||
                                    !image ||
                                    !preview.source_current ||
                                    Boolean(currentPage.error) ||
                                    (!checked && selected.length >= 100)
                                  }
                                  onChange={() => {
                                    setAttested(false)
                                    setSelected(
                                      checked
                                        ? selected.filter(
                                            (s) =>
                                              !(
                                                s.page === currentPage.page &&
                                                s.fragment_id === f.id
                                              ),
                                          )
                                        : [
                                            ...selected,
                                            { page: currentPage.page, fragment_id: f.id },
                                          ],
                                    )
                                  }}
                                />
                              }
                              label={
                                <Typography
                                  sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                                >
                                  {f.text}
                                </Typography>
                              }
                            />
                            <Typography variant="caption" display="block">
                              Recognition confidence {f.confidence.toFixed(1)}%; image box{' '}
                              {f.bbox.join(', ')}
                            </Typography>
                          </Box>
                        )
                      })}
                  </Stack>
                </Stack>
              </Box>
            )}
            <Typography>
              {selected.length} fragments selected across this preview (maximum 100).
            </Typography>
            <TextField
              label="OCR reviewer name"
              value={reviewer}
              disabled={disabled || !preview.source_current}
              inputProps={{ maxLength: 200 }}
              onChange={(e) => {
                setReviewer(e.target.value)
                setAttested(false)
              }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={attested}
                  disabled={disabled || !selected.length || !preview.source_current}
                  onChange={(e) => setAttested(e.target.checked)}
                />
              }
              label="I compared every selected fragment with its original page image and confirm the selected OCR text matches."
            />
            <Button
              disabled={
                disabled ||
                !preview.source_current ||
                !selected.length ||
                !reviewer.trim() ||
                !attested
              }
              onClick={() =>
                void run(async (current) => {
                  const queued = await client.apply(documentId, {
                    expected_sha256: preview.source_sha256,
                    expected_index_identity: preview.index_identity,
                    preview_id: preview.id,
                    preview_integrity_sha256: preview.integrity_sha256,
                    selections: selected,
                    reviewer,
                    attest_matches_image: true,
                  })
                  if (current !== epoch.current) return
                  const done = await waitForJob(queued, current)
                  if (!done) return
                  if (!done.result?.review_id)
                    throw new Error(
                      'OCR review result is unavailable; inspect the job before retrying',
                    )
                  const value = await client.review(documentId, done.result.review_id)
                  if (current !== epoch.current) return
                  setReview(value)
                  setSelected([])
                  setWordFilter('')
                  setAttested(false)
                  setContext(null)
                  setPreview({ ...preview, source_current: false })
                  setStatus(
                    `Selected OCR retained. Semantic indexing: ${done.result.embeddings || 'inspect job'}. Generate a new distillation explicitly when ready.`,
                  )
                  await onReviewed()
                })
              }
            >
              Apply selected OCR fragments
            </Button>
          </Stack>
        )}
        {history && (
          <Stack spacing={1}>
            {history.items.map((item) => (
              <Button
                key={item.id}
                disabled={disabled}
                onClick={() =>
                  void run(async (current) => {
                    if (historyKind === 'transcriptions') {
                      const value = await client.transcription(documentId, item.id)
                      if (current !== epoch.current) return
                      if (value.document_id !== documentId)
                        throw new Error('Transcription document changed')
                      setTranscription(value)
                    } else if (historyKind === 'source-limits') {
                      const value = await client.sourceLimit(documentId, item.id)
                      if (current === epoch.current) setSourceReview(value)
                    } else if (historyKind === 'ocr-previews') await loadPreview(item.id, current)
                    else {
                      const value = await client.review(documentId, item.id)
                      if (current === epoch.current) setReview(value)
                    }
                  })
                }
              >
                Inspect{' '}
                {historyKind === 'transcriptions'
                  ? 'transcription'
                  : historyKind === 'source-limits'
                    ? 'source-use review'
                    : historyKind === 'ocr-previews'
                      ? 'preview'
                      : 'review'}{' '}
                · {item.created_at}
              </Button>
            ))}
            {!history.items.length && (
              <Typography>
                No retained{' '}
                {historyKind === 'transcriptions'
                  ? 'transcriptions'
                  : historyKind === 'source-limits'
                    ? 'source-use reviews'
                    : historyKind === 'ocr-previews'
                      ? 'previews'
                      : 'reviews'}
                .
              </Typography>
            )}
            {history.next_offset !== null && (
              <Button
                disabled={disabled}
                onClick={() => void run((e) => loadHistory(historyKind, e, history.next_offset!))}
              >
                {historyKind === 'source-limits' ? 'More source-use history' : 'More OCR history'}
              </Button>
            )}
          </Stack>
        )}
        {sourceReview && (
          <Stack spacing={1}>
            <Typography>
              Source-use review ·{' '}
              {sourceReview.active
                ? 'Active original-image-only restriction'
                : sourceReview.current
                  ? 'Native text re-enabled'
                  : 'Historical decision'}
            </Typography>
            <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
              PDF page {sourceReview.page} · reviewed by {sourceReview.reviewer} ·{' '}
              {sourceReview.created_at}. This review does not approve generated interpretations or
              performance data.
            </Typography>
            <Button
              disabled={disabled}
              onClick={() =>
                void run((e) => loadPreview(sourceReview.preview_id, e, sourceReview.page))
              }
            >
              Compare source-use review with original page image
            </Button>
          </Stack>
        )}
        {transcription && (
          <Stack spacing={1}>
            <Typography>
              Operator transcription ·{' '}
              {transcription.active ? 'Active supplement' : 'Historical review'} · reviewed by{' '}
              {transcription.reviewer} · {transcription.created_at}
            </Typography>
            <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
              PDF page {transcription.page} (label {transcription.label}). Original SHA-256{' '}
              {transcription.source_sha256}. Source association:{' '}
              {String(transcription.source_metadata.icao || 'unknown type')}, variant{' '}
              {String(transcription.source_metadata.variant || 'unknown')}, revision{' '}
              {String(transcription.source_metadata.revision || 'unknown')}.
            </Typography>
            {!transcription.source_current && (
              <Alert severity="info">
                The source index has changed since this review. Inspect its active status and
                original image before reuse.
              </Alert>
            )}
            <Typography
              sx={{
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                maxHeight: '40vh',
                overflow: 'auto',
              }}
            >
              {transcription.text}
            </Typography>
            <Button
              disabled={disabled}
              onClick={() =>
                void run((e) => loadPreview(transcription.preview_id, e, transcription.page))
              }
            >
              Compare transcription with original page image
            </Button>
            <Button
              disabled={disabled || !transcription.active}
              onClick={() =>
                void run(async (current) => {
                  const value = await client.context(documentId)
                  if (current !== epoch.current) return
                  if (value.source_sha256 !== sourceSha256)
                    throw new Error('Transcription source changed')
                  const queued = await client.embedTranscription(documentId, transcription.id, {
                    expected_sha256: value.source_sha256,
                    expected_index_identity: value.index_identity,
                  })
                  if (current !== epoch.current) return
                  const done = await waitForJob(queued, current, 'Transcription')
                  if (done && done.result?.embeddings !== 'indexed')
                    throw new Error('Inspect transcription indexing job result before retrying')
                  if (done) {
                    setStatus('Semantic indexing completed for this transcription.')
                    await onReviewed()
                  }
                })
              }
            >
              Retry semantic indexing for this transcription
            </Button>
          </Stack>
        )}
        {review && (
          <Box>
            <Typography>
              Reviewed by {review.reviewer} · {review.created_at} ·{' '}
              {review.active ? 'Active supplement' : 'Historical review'}
            </Typography>
            <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
              Retained source association: {String(review.source_metadata?.icao || 'unknown type')},
              variant {String(review.source_metadata?.variant || 'unknown')}, revision{' '}
              {String(review.source_metadata?.revision || 'unknown')}. Original SHA-256{' '}
              {review.source_sha256 || sourceSha256}.
            </Typography>
            {review.fragments.map((f) => (
              <Typography
                key={`${f.page}-${f.id}`}
                sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
              >
                PDF page {f.page} (label {f.label}): {f.text}
              </Typography>
            ))}
            <Button
              disabled={disabled}
              onClick={() => void run((e) => loadPreview(review.preview_id, e))}
            >
              Compare retained review with page image
            </Button>
            <Button
              disabled={disabled || !review.active}
              onClick={() =>
                void run(async (current) => {
                  const value = await client.context(documentId)
                  if (current !== epoch.current) return
                  const queued = await client.embed(documentId, review.id, {
                    expected_sha256: value.source_sha256,
                    expected_index_identity: value.index_identity,
                  })
                  if (current !== epoch.current) return
                  const done = await waitForJob(queued, current)
                  if (done) setStatus('Semantic indexing completed for these reviewed fragments.')
                })
              }
            >
              Retry semantic indexing for these fragments
            </Button>
          </Box>
        )}
      </Stack>
    </Box>
  )
}
