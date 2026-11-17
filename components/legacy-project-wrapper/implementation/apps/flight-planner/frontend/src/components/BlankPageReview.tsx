import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material'

type Candidate = {
  page: number
  label: string
  method: string
  error: string | null
  reviewable: boolean
  verification: { kind: string; reviewer?: string | null; renderer?: string | null } | null
}
type CandidatePage = {
  extraction_status: string
  document_id: string
  source_sha256: string
  index_identity: string
  page_count: number
  items: Candidate[]
  total: number
  offset: number
  limit: number
  next_offset: number | null
}
type ReviewSummary = {
  review_id: string
  pages: number[]
  reviewer: string
  recorded_at: string
  integrity_sha256: string
}
type ReviewPage = { document_id: string; items: ReviewSummary[]; next_offset: number | null }
type Review = ReviewSummary & {
  document_id: string
  source_sha256: string
  before_index_identity: string
  after_index_identity: string
  attest_no_text_or_graphics: true
  source_metadata: { title: string; variant: string; revision: string }
}
type Props = {
  documentId: string
  sourceSha256: string
  locked: boolean
  request: (path: string, options?: RequestInit) => Promise<unknown>
  download: () => Promise<void>
  onReviewed: () => Promise<void>
}
const digest = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)
const reviewId = (v: unknown) => typeof v === 'string' && /^review_[a-f0-9]{32}$/.test(v)
const validSummary = (v: ReviewSummary) =>
  reviewId(v?.review_id) &&
  digest(v.integrity_sha256) &&
  Array.isArray(v.pages) &&
  v.pages.length > 0 &&
  v.pages.every((p) => Number.isInteger(p) && p > 0) &&
  typeof v.reviewer === 'string' &&
  typeof v.recorded_at === 'string'

export default function BlankPageReview({
  documentId,
  sourceSha256,
  locked,
  request,
  download,
  onReviewed,
}: Props) {
  const [preview, setPreview] = useState<CandidatePage | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [reviewer, setReviewer] = useState('')
  const [attested, setAttested] = useState(false)
  const [history, setHistory] = useState<ReviewPage | null>(null)
  const [record, setRecord] = useState<Review | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const epoch = useRef(0)
  const invalidate = useCallback(() => {
    epoch.current++
  }, [])
  useEffect(() => {
    invalidate()
    setPreview(null)
    setSelected([])
    setReviewer('')
    setAttested(false)
    setHistory(null)
    setRecord(null)
    setBusy(false)
    setError('')
    return invalidate
  }, [documentId, sourceSha256, invalidate])
  const path = `/documents/${documentId}`
  async function run(action: (current: number) => Promise<void>) {
    const current = ++epoch.current
    setBusy(true)
    setError('')
    try {
      await action(current)
    } catch (e) {
      if (current === epoch.current && !(e instanceof DOMException && e.name === 'AbortError'))
        setError(e instanceof Error ? e.message : 'Blank-page review failed')
    } finally {
      if (current === epoch.current) setBusy(false)
    }
  }
  async function load(current: number, offset = 0) {
    const value = (await request(path + `/blank-pages?limit=100&offset=${offset}`)) as CandidatePage
    if (current !== epoch.current) return
    if (
      !['stored', 'indexed', 'partial', 'failed'].includes(value.extraction_status) ||
      value.document_id !== documentId ||
      value.source_sha256 !== sourceSha256 ||
      !digest(value.index_identity) ||
      value.offset !== offset ||
      value.limit !== 100 ||
      !Number.isInteger(value.total) ||
      value.total < 0 ||
      !Array.isArray(value.items) ||
      value.items.length > 100 ||
      offset + value.items.length > value.total ||
      (offset + value.items.length < value.total && value.next_offset === null) ||
      !value.items.every(
        (v) =>
          Number.isInteger(v.page) &&
          v.page > 0 &&
          typeof v.label === 'string' &&
          ['text', 'ocr', 'missing', 'blank'].includes(v.method) &&
          typeof v.reviewable === 'boolean',
      ) ||
      new Set(value.items.map((v) => v.page)).size !== value.items.length ||
      !(
        value.next_offset === null ||
        (value.next_offset === offset + value.items.length &&
          value.items.length > 0 &&
          value.next_offset < value.total)
      )
    )
      throw new Error('Invalid blank-page review response')
    if (
      offset &&
      (!preview || value.index_identity !== preview.index_identity || value.total !== preview.total)
    ) {
      setPreview(null)
      setSelected([])
      setAttested(false)
      throw new Error('Extraction changed; reload the blank-page review')
    }
    if (offset) {
      const items = [...(preview?.items ?? []), ...value.items]
      if (new Set(items.map((v) => v.page)).size !== items.length)
        throw new Error('Duplicate page in review response')
      setPreview({ ...value, items })
    } else {
      setPreview(value)
      setSelected([])
      setAttested(false)
      setRecord(null)
    }
  }
  async function loadHistory(current: number, offset = 0) {
    const value = (await request(
      path + `/blank-page-reviews?limit=20&offset=${offset}`,
    )) as ReviewPage
    if (current !== epoch.current) return
    if (
      value.document_id !== documentId ||
      !Array.isArray(value.items) ||
      !value.items.every(validSummary) ||
      !(
        value.next_offset === null ||
        (Number.isInteger(value.next_offset) && value.next_offset > offset)
      )
    )
      throw new Error('Invalid blank-page audit history')
    setHistory({
      ...value,
      items: offset ? [...(history?.items ?? []), ...value.items] : value.items,
    })
  }
  function checkedRecord(value: Review) {
    if (
      !validSummary(value) ||
      value.document_id !== documentId ||
      value.source_sha256 !== sourceSha256 ||
      !digest(value.before_index_identity) ||
      !digest(value.after_index_identity) ||
      value.attest_no_text_or_graphics !== true ||
      !value.source_metadata ||
      typeof value.source_metadata.title !== 'string'
    )
      throw new Error('Invalid blank-page audit record')
    return value
  }
  async function save(current: number) {
    if (!preview || !selected.length || !reviewer.trim() || !attested || locked) return
    const pages = [...selected].sort((a, b) => a - b)
    let response: unknown
    try {
      response = await request(path + '/blank-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pages,
          reviewer: reviewer.trim(),
          attest_no_text_or_graphics: true,
          expected_sha256: preview.source_sha256,
          expected_index_identity: preview.index_identity,
        }),
      })
    } catch (e) {
      if (current === epoch.current) {
        setPreview(null)
        setSelected([])
        setAttested(false)
      }
      throw e
    }
    if (current !== epoch.current) return
    const value = checkedRecord(response as Review)
    if (
      JSON.stringify(value.pages) !== JSON.stringify(pages) ||
      value.before_index_identity !== preview.index_identity
    )
      throw new Error('Saved review does not match the selected pages')
    setRecord(value)
    setPreview(null)
    setSelected([])
    setAttested(false)
    setHistory(null)
    await onReviewed()
  }
  return (
    <details data-aviation-private>
      <summary>Blank and unreadable page review</summary>
      <Stack spacing={1} sx={{ mt: 1, overflowWrap: 'anywhere' }}>
        <Typography>
          Empty extracted text is unknown. Inspect the retained original before marking any scanned
          page blank. Pages with text, diagrams or faint markings must remain unresolved.
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          <Button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await download()
              })
            }
          >
            Download original for blank-page review
          </Button>
          <Button disabled={busy} onClick={() => void run((current) => load(current))}>
            Load blank and unreadable pages
          </Button>
          <Button disabled={busy} onClick={() => void run((current) => loadHistory(current))}>
            Load blank-page audit history
          </Button>
        </Stack>
        {error && <Alert severity="error">{error}</Alert>}
        {locked && (
          <Alert severity="info">
            Document work is active. Save a blank-page review after it finishes.
          </Alert>
        )}
        {preview && (
          <>
            <Typography variant="body2">Original SHA-256 {preview.source_sha256}</Typography>
            <Typography>
              Extraction: {preview.extraction_status}.{' '}
              {preview.page_count === 0
                ? 'No extraction is available; process the manual before reviewing pages.'
                : `${preview.total} blank or unresolved pages in this extraction.`}{' '}
              No pages are selected automatically.
            </Typography>
            {preview.items.map((item) => (
              <Box key={item.page}>
                {item.reviewable ? (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={selected.includes(item.page)}
                        disabled={busy || locked}
                        onChange={(_, checked) => {
                          setSelected((old) =>
                            checked ? [...old, item.page] : old.filter((p) => p !== item.page),
                          )
                          setAttested(false)
                        }}
                      />
                    }
                    label={`Review page ${item.page} (label ${item.label}) as blank`}
                  />
                ) : (
                  <Typography>
                    Page {item.page} (label {item.label}) ·{' '}
                    {item.method === 'blank'
                      ? 'Verified blank'
                      : 'Unresolved; recovered text cannot be dismissed'}
                  </Typography>
                )}
                <Typography variant="body2">
                  {item.method === 'blank'
                    ? `${item.verification?.kind === 'rendered_pure_white' ? 'Entire rendered page is white' : 'Operator-attested blank'}${item.verification?.reviewer ? ' · ' + item.verification.reviewer : ''}`
                    : item.error || 'Unknown extraction'}
                </Typography>
              </Box>
            ))}
            {preview.next_offset !== null && (
              <Button
                disabled={busy}
                onClick={() => void run((current) => load(current, preview.next_offset!))}
              >
                Load more review pages
              </Button>
            )}
            <TextField
              label="Blank-page reviewer"
              value={reviewer}
              inputProps={{ maxLength: 200 }}
              onChange={(e) => {
                setReviewer(e.target.value)
                setAttested(false)
              }}
              disabled={busy || locked}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={attested}
                  disabled={busy || locked || !selected.length}
                  onChange={(_, checked) => setAttested(checked)}
                />
              }
              label="I inspected every selected original page and attest that it contains no text or graphics"
            />
            <Button
              disabled={busy || locked || !selected.length || !reviewer.trim() || !attested}
              onClick={() => void run(save)}
            >
              Save selected blank-page review
            </Button>
            <Typography variant="caption">
              Saving changes extraction coverage only. Existing summaries keep their original status
              until an explicit validated distillation.
            </Typography>
          </>
        )}
        {history && (
          <>
            {!history.items.length && <Typography>No blank-page reviews saved.</Typography>}
            {history.items.map((item) => (
              <Box key={item.review_id}>
                <Typography>
                  Pages {item.pages.join(', ')} · {item.reviewer} · {item.recorded_at}
                </Typography>
                <Button
                  disabled={busy}
                  onClick={() =>
                    void run(async (current) => {
                      const value = checkedRecord(
                        (await request(path + '/blank-page-reviews/' + item.review_id)) as Review,
                      )
                      if (current === epoch.current) setRecord(value)
                    })
                  }
                >
                  Inspect blank-page audit {item.review_id}
                </Button>
              </Box>
            ))}
            {history.next_offset !== null && (
              <Button
                disabled={busy}
                onClick={() => void run((current) => loadHistory(current, history.next_offset!))}
              >
                Load more blank-page reviews
              </Button>
            )}
          </>
        )}
        {record && (
          <Box role="region" aria-label="Saved blank-page audit">
            <Typography variant="h6">Saved blank-page audit</Typography>
            <Typography>
              {record.source_metadata.title} · variant {record.source_metadata.variant || 'unknown'}{' '}
              · revision {record.source_metadata.revision || 'unknown'}
            </Typography>
            <Typography>
              Pages {record.pages.join(', ')} · {record.reviewer} · {record.recorded_at}
            </Typography>
            <Typography>Attestation: original pages inspected; no text or graphics.</Typography>
            <Typography variant="body2">
              Review {record.review_id} · Original SHA-256 {record.source_sha256}
            </Typography>
            <Typography variant="body2">
              Before extraction {record.before_index_identity} · After extraction{' '}
              {record.after_index_identity}
            </Typography>
            <Typography variant="caption">
              Audit SHA-256 {record.integrity_sha256}. This retained review is not automatic
              approval for a later extraction.
            </Typography>
          </Box>
        )}
      </Stack>
    </details>
  )
}
