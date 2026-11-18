import BlankPageReview from '../components/BlankPageReview'
import OCRReview from '../components/OCRReview'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'

type Metadata = {
  icao: string
  title: string
  kind: string
  manufacturer: string
  model: string
  variant: string
  revision: string
  serial_applicability: string
  tails: string[]
  scope: string
  notes: string
}
type Citation = {
  document_id: string
  page: number
  label: string
  quote: string
  method: string
  ocr_review?: { reviewer: string; reviewed_at: string } | null
}
type Claim = { text: string; citations: Citation[] }
type Answer = {
  insufficient_evidence: boolean
  reason: string
  claims: Claim[]
  model?: string
  applicability?: string
  warnings?: string[]
}
type Document = {
  id: string
  icao: string
  sha256: string
  metadata: Metadata
  status: string
  error: string | null
  original_url: string
  extraction: { page_count: number; incomplete_pages: number[] } | null
  sources: { filename: string; url: string | null; retrieved_at: string }[]
  artifacts: {
    section_index?: {
      sections: Record<
        string,
        { status: string; pages: { page: number; label: string; excerpt: string }[] }
      >
    }
    distillation?: {
      status: string
      sections: (Answer & { pages: number[] })[]
      recovery?: {
        kind?: string
        recovered_batches: number
        recovered_claims: number
      }
    }
  }
}
type Job = {
  id: string
  state: string
  kind: string
  error: string | null
  updated_at: string
  result?: unknown
  has_result: boolean
  subject: { document_id: string | null; icao: string; title: string } | null
}
type DistillationRevision = {
  revision_id: string
  archived_at: string
  reason: string
  model: string | null
  status: string | null
  completed_batches: number | null
  source_sha256: string
}
type HistoryPage = { items: DistillationRevision[]; next_offset: number | null }
type HistoricalDistillation = {
  document_id: string
  revision_id: string
  source_sha256: string
  source_metadata: Metadata
  historical: true
  eligible_for_resume: false
  artifact: { status: string; sections: (Answer & { pages: number[] })[] }
}
type Capabilities = {
  search: { configured: boolean; provider: string | null }
  llm: boolean
  model: string | null
  embeddings: boolean
  ocr: boolean
  types: { icao: string; documents: number }[]
}
const base = '/api/aircraft-library'
const jobKinds = new Map<string, string>([
  ['index', 'Process manual'],
  ['embed', 'Build semantic index'],
  ['distill', 'Distill manual'],
  ['discover', 'Find web examples'],
  ['acquire', 'Acquire manuals'],
  ['ocr_preview', 'Preview diagram OCR'],
  ['ocr_apply', 'Apply reviewed OCR'],
  ['ocr_embed', 'Index reviewed OCR'],
])
const activeJob = (job: Job) => job.state === 'queued' || job.state === 'running'
const validJob = (job: Job) =>
  typeof job?.id === 'string' &&
  typeof job.kind === 'string' &&
  ['queued', 'running', 'completed', 'failed'].includes(job.state) &&
  typeof job.updated_at === 'string' &&
  typeof job.has_result === 'boolean' &&
  (job.error === null || typeof job.error === 'string') &&
  (job.subject === null ||
    (typeof job.subject === 'object' &&
      typeof job.subject.icao === 'string' &&
      typeof job.subject.title === 'string' &&
      (job.subject.document_id === null || typeof job.subject.document_id === 'string')))
const initial = {
  title: '',
  kind: 'POH',
  manufacturer: '',
  model: '',
  variant: '',
  revision: '',
  serial_applicability: '',
  notes: '',
}

export default function AircraftLibraryPage() {
  const [token, setToken] = useState('')
  const [caps, setCaps] = useState<Capabilities | null>(null)
  const [code, setCode] = useState('C172')
  const [registration, setRegistration] = useState('')
  const [draft, setDraft] = useState(initial)
  const [editing, setEditing] = useState<string | null>(null)
  const [tails, setTails] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [urls, setUrls] = useState('')
  const [documents, setDocuments] = useState<Document[]>([])
  const [histories, setHistories] = useState<Record<string, HistoryPage>>({})
  const [historical, setHistorical] = useState<HistoricalDistillation | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobsRead, setJobsRead] = useState(false)
  const [jobNextOffset, setJobNextOffset] = useState<number | null>(null)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [passages, setPassages] = useState<{ document_id: string; page: number; text: string }[]>(
    [],
  )
  const [page, setPage] = useState<{
    document_id: string
    page: number
    label: string
    text: string
    method: string
  } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const generation = useRef(0)
  const requests = useRef(new Set<AbortController>())
  const invalidateScope = useCallback(() => {
    generation.current++
  }, [])

  useEffect(() => {
    const ownedRequests = requests.current
    invalidateScope()
    ownedRequests.forEach((c) => c.abort())
    setBusy(false)
    setError('')
    setDocuments([])
    setHistories({})
    setHistorical(null)
    setAnswer(null)
    setPassages([])
    setPage(null)
    return () => {
      invalidateScope()
      ownedRequests.forEach((c) => c.abort())
      ownedRequests.clear()
    }
  }, [code, registration, token, invalidateScope])

  async function request(
    path: string,
    options: RequestInit = {},
    binary = false,
  ): Promise<unknown> {
    const controller = new AbortController()
    requests.current.add(controller)
    try {
      const response = await fetch(base + path, {
        ...options,
        signal: controller.signal,
        headers: { Authorization: 'Bearer ' + token, ...options.headers },
      })
      if (!response.ok) {
        let message = `Library request failed (${response.status})`
        try {
          const body = await response.json()
          if (typeof body.detail === 'string') message = body.detail
        } catch {
          /* generic status remains visible */
        }
        throw new Error(message)
      }
      const value = binary ? await response.blob() : await response.json()
      if (controller.signal.aborted)
        throw new DOMException('Library request abandoned', 'AbortError')
      return value
    } finally {
      requests.current.delete(controller)
    }
  }

  async function act(action: () => Promise<void>) {
    const current = generation.current
    setError('')
    setBusy(true)
    try {
      await action()
    } catch (e) {
      if (current === generation.current && !(e instanceof DOMException && e.name === 'AbortError'))
        setError(e instanceof Error ? e.message : 'Library request failed')
    } finally {
      if (current === generation.current) setBusy(false)
    }
  }

  function filters() {
    return { icao: code, ...(registration.trim() ? { registration: registration.trim() } : {}) }
  }
  function metadata() {
    return {
      ...draft,
      icao: code,
      tails: tails.split(/[,\s]+/).filter(Boolean),
      scope: tails.trim() ? 'aircraft' : 'type',
    }
  }
  function post(body: unknown): RequestInit {
    return {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  }
  async function refresh() {
    const current = generation.current
    const result = (await request('/documents?' + new URLSearchParams(filters()))) as {
      documents: Document[]
    }
    if (current === generation.current) setDocuments(result.documents)
  }
  async function loadHistory(id: string, offset = 0) {
    const current = generation.current
    const value = (await request(
      `/documents/${id}/distillations?limit=20&offset=${offset}`,
    )) as HistoryPage
    if (
      !Array.isArray(value.items) ||
      !value.items.every((item) => /^[a-f0-9]{64}$/.test(item.revision_id)) ||
      !(
        value.next_offset === null ||
        (Number.isInteger(value.next_offset) && value.next_offset > offset)
      )
    )
      throw new Error('Invalid distillation history response')
    if (current === generation.current)
      setHistories((previous) => ({
        ...previous,
        [id]: {
          ...value,
          items: offset
            ? [
                ...new Map(
                  [...(previous[id]?.items ?? []), ...value.items].map((item) => [
                    item.revision_id,
                    item,
                  ]),
                ).values(),
              ]
            : value.items,
        },
      }))
  }
  async function inspectHistory(id: string, revision: string) {
    const current = generation.current
    const value = (await request(
      `/documents/${id}/distillations/${revision}`,
    )) as HistoricalDistillation
    if (
      value.document_id !== id ||
      value.revision_id !== revision ||
      value.historical !== true ||
      value.eligible_for_resume !== false
    )
      throw new Error('Invalid historical distillation response')
    if (current === generation.current) setHistorical(value)
  }
  function addJob(job: Job) {
    setJobs((previous) => [job, ...previous.filter((j) => j.id !== job.id)])
  }
  function clearJobs() {
    setJobs([])
    setJobsRead(false)
    setJobNextOffset(null)
  }
  async function loadJobs(offset = 0) {
    const current = generation.current
    const result = (await request(`/jobs?limit=20&offset=${offset}`)) as {
      jobs: Job[]
      next_offset: number | null
    }
    if (
      !result ||
      !Array.isArray(result.jobs) ||
      !result.jobs.every(validJob) ||
      !(
        result.next_offset === null ||
        (Number.isInteger(result.next_offset) && result.next_offset > offset)
      )
    )
      throw new Error('Library processing jobs response is invalid')
    if (current === generation.current) {
      setJobs((previous) =>
        offset
          ? [
              ...new Map<string, Job>(
                [...previous, ...result.jobs].map((job) => [job.id, job]),
              ).values(),
            ]
          : result.jobs,
      )
      setJobNextOffset(result.next_offset)
      setJobsRead(true)
    }
  }
  async function refreshCapabilities() {
    const current = generation.current
    const value = (await request('/capabilities')) as Capabilities
    if (current === generation.current) setCaps(value)
  }
  async function refreshJobs() {
    await Promise.all([loadJobs(), refresh(), refreshCapabilities()])
  }
  function processingJobs(items: Job[]) {
    return items.map((job) => (
      <Box key={job.id}>
        <Typography sx={{ overflowWrap: 'anywhere' }}>
          {jobKinds.get(job.kind) ?? 'Document processing'}: {job.state}
          {job.subject && ` · ${job.subject.icao} · ${job.subject.title}`}
        </Typography>
        <Typography variant="caption">Updated: {job.updated_at}</Typography>
        {job.error && <Alert severity="error">{job.error}</Alert>}
        {job.has_result && job.result == null && (
          <Button
            disabled={busy}
            aria-label={`Read processing result: ${job.subject?.title ?? job.kind}`}
            onClick={() =>
              void act(async () => {
                const current = generation.current
                const result = (await request('/jobs/' + job.id)) as Job
                if (current === generation.current) addJob(result)
              })
            }
          >
            Read processing result
          </Button>
        )}
        {job.result != null && (
          <details>
            <summary>Acquisition / processing results</summary>
            <Box component="pre" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {JSON.stringify(job.result, null, 2)}
            </Box>
          </details>
        )}
      </Box>
    ))
  }
  async function download(doc: Document) {
    const blob = (await request('/documents/' + doc.id + '/original', {}, true)) as Blob
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${doc.icao}-${doc.sha256.slice(0, 12)}.pdf`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  async function showPage(id: string, number: number) {
    const current = generation.current
    const result = (await request(`/documents/${id}/pages/${number}`)) as NonNullable<typeof page>
    if (current === generation.current) setPage(result)
  }
  function claims(value: Answer, historicalQuotes = false) {
    return (
      <Stack spacing={2}>
        {value.insufficient_evidence && (
          <Alert severity="info">Insufficient evidence: {value.reason}</Alert>
        )}
        {value.claims.map((claim, index) => (
          <Box key={index}>
            <Typography>{claim.text}</Typography>
            {claim.citations.map((citation, i) => (
              <Box key={i} sx={{ mt: 1, pl: 2, borderLeft: '3px solid', borderColor: 'divider' }}>
                <Button
                  size="small"
                  onClick={() => void act(() => showPage(citation.document_id, citation.page))}
                >
                  Source {citation.document_id.slice(-8)}, PDF page {citation.page} (label{' '}
                  {citation.label})
                </Button>
                <Box component={historicalQuotes ? 'details' : 'div'}>
                  {historicalQuotes && <summary>Retained source quotation</summary>}
                  <Typography
                    variant="body2"
                    sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                  >
                    {citation.quote}
                  </Typography>
                </Box>
                {citation.method === 'ocr' && <Chip size="small" label="OCR — check original" />}
                {citation.ocr_review && (
                  <Typography variant="caption" display="block">
                    Supplemental OCR reviewed by {citation.ocr_review.reviewer} ·{' '}
                    {citation.ocr_review.reviewed_at}. Retained page images are available in the
                    document’s OCR review history.
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        ))}
        {value.warnings?.map((w) => (
          <Alert severity="warning" key={w}>
            {w}
          </Alert>
        ))}
        {value.applicability && <Typography variant="caption">{value.applicability}</Typography>}
      </Stack>
    )
  }

  return (
    <Stack data-aviation-private spacing={3} sx={{ overflowWrap: 'anywhere' }}>
      <Box>
        <Typography variant="h4" component="h2">
          Aircraft document library
        </Typography>
        <Typography>
          Keep POH, AFM, maintenance manuals and supplements together. Search original pages or ask
          a question with source citations.
        </Typography>
      </Box>
      <Alert severity="info">
        Match the aircraft variant, serial number, revision and supplements before using a
        reference. Type references and aircraft-specific documents stay separate. Generated answers
        are research aids; extracted figures do not automatically become flight-planning data.
      </Alert>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <TextField
              label="Library access key"
              type="password"
              value={token}
              onChange={(e) => {
                setToken(e.target.value)
                setCaps(null)
                clearJobs()
              }}
              autoComplete="off"
              helperText="Kept in this page’s memory only. It is cleared when you leave."
            />
            <Stack direction="row" spacing={2}>
              <Button
                disabled={!token || busy}
                variant="contained"
                onClick={() =>
                  void act(async () => {
                    await refreshCapabilities()
                    await Promise.all([refresh(), loadJobs()])
                  })
                }
              >
                Open library
              </Button>
              <Button
                onClick={() => {
                  setToken('')
                  setCaps(null)
                  clearJobs()
                }}
              >
                Lock library
              </Button>
            </Stack>
            {caps && (
              <Typography variant="body2">
                Question answering: {caps.llm ? caps.model : 'model not configured'}. Semantic
                retrieval: {caps.embeddings ? 'configured' : 'full-text search available'}. Web
                discovery:{' '}
                {caps.search.configured
                  ? caps.search.provider
                  : 'not configured; public URLs can still be acquired'}
                . OCR: {caps.ocr ? 'available' : 'unavailable; scanned pages may be incomplete'}.
              </Typography>
            )}
          </Stack>
        </CardContent>
      </Card>
      {error && (
        <Alert severity="error" role="alert">
          {error}
        </Alert>
      )}
      {busy && (
        <Box role="status">
          <CircularProgress size={20} /> Working…
        </Box>
      )}
      {caps && (
        <>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="ICAO aircraft type"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              inputProps={{ maxLength: 4 }}
              helperText="For example C172, C182, SR22"
            />
            <TextField
              label="Aircraft registration (optional)"
              value={registration}
              onChange={(e) => setRegistration(e.target.value.toUpperCase())}
              helperText="Includes this aircraft’s documents plus general type references"
            />
            <Button disabled={busy} onClick={() => void act(refresh)}>
              Load documents
            </Button>
          </Stack>
          <Typography variant="body2">
            Types in this library:{' '}
            {caps.types.map((t) => `${t.icao} (${t.documents})`).join(', ') || 'none yet'}
          </Typography>
          <Card>
            <CardContent>
              <Stack spacing={2} id="library-manual-form">
                <Typography variant="h6" component="h3">
                  Add manuals
                </Typography>
                <Typography variant="body2">
                  Original PDFs are retained unchanged. Web discovery looks for several
                  editions/examples and records each source; a search match does not verify aircraft
                  applicability.
                </Typography>
                <TextField
                  label="Document title"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="Manufacturer"
                    value={draft.manufacturer}
                    onChange={(e) => setDraft({ ...draft, manufacturer: e.target.value })}
                  />
                  <TextField
                    label="Model"
                    value={draft.model}
                    onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                  />
                  <TextField
                    label="Variant"
                    value={draft.variant}
                    onChange={(e) => setDraft({ ...draft, variant: e.target.value })}
                  />
                  <TextField
                    label="Revision / edition"
                    value={draft.revision}
                    onChange={(e) => setDraft({ ...draft, revision: e.target.value })}
                  />
                </Stack>
                <TextField
                  label="Serial-number applicability"
                  value={draft.serial_applicability}
                  onChange={(e) => setDraft({ ...draft, serial_applicability: e.target.value })}
                />
                <TextField
                  label="Associated registrations"
                  value={tails}
                  onChange={(e) => setTails(e.target.value)}
                  helperText="Separate registrations with spaces or commas. Leave empty for a general type reference."
                />
                <FormControl>
                  <InputLabel id="document-kind-label">Document kind</InputLabel>
                  <Select
                    labelId="document-kind-label"
                    label="Document kind"
                    value={draft.kind}
                    onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
                  >
                    {['POH', 'AFM', 'PIM', 'MAINTENANCE', 'SUPPLEMENT', 'OTHER'].map((k) => (
                      <MenuItem value={k} key={k}>
                        {k}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Notes / source applicability"
                  multiline
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                />
                <TextField
                  label="Public PDF or manual-library URLs"
                  multiline
                  value={urls}
                  onChange={(e) => setUrls(e.target.value)}
                  helperText="One public URL per line. Originals and source provenance are retained."
                />
                <Button
                  disabled={busy || !urls.trim()}
                  onClick={() =>
                    void act(async () =>
                      addJob(
                        (await request(
                          '/acquisitions',
                          post({ metadata: metadata(), urls: urls.split(/\s+/).filter(Boolean) }),
                        )) as Job,
                      ),
                    )
                  }
                >
                  Acquire provided URLs
                </Button>
                {editing && (
                  <Stack direction="row" spacing={2}>
                    <Button
                      variant="contained"
                      disabled={busy}
                      onClick={() =>
                        void act(async () => {
                          await request(`/documents/${editing}/metadata`, {
                            ...post(metadata()),
                            method: 'PUT',
                          })
                          setEditing(null)
                          await refresh()
                        })
                      }
                    >
                      Save document associations
                    </Button>
                    <Button onClick={() => setEditing(null)}>Cancel metadata edit</Button>
                  </Stack>
                )}
                <input
                  aria-label="PDF manuals"
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  onChange={(e) => setFiles(Array.from(e.target.files || []))}
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <Button
                    variant="contained"
                    disabled={busy || !files.length}
                    onClick={() =>
                      void act(async () => {
                        for (const file of files) {
                          const form = new FormData()
                          form.set('file', file)
                          form.set('metadata_json', JSON.stringify(metadata()))
                          const value = (await request('/documents', {
                            method: 'POST',
                            body: form,
                          })) as { job: Job }
                          addJob(value.job)
                        }
                        await refresh()
                      })
                    }
                  >
                    Upload {files.length || ''} PDF{files.length === 1 ? '' : 's'}
                  </Button>
                  <Button
                    disabled={busy || !caps.search.configured}
                    onClick={() =>
                      void act(async () =>
                        addJob(
                          (await request(
                            '/discovery',
                            post({ metadata: metadata(), maximum: 30 }),
                          )) as Job,
                        ),
                      )
                    }
                  >
                    Find and acquire web examples
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Stack spacing={1}>
                <Typography variant="h6" component="h3">
                  Document processing
                </Typography>
                <Button disabled={busy} onClick={() => void act(refreshJobs)}>
                  Refresh jobs and documents
                </Button>
                {jobs.some(activeJob) ? (
                  processingJobs(jobs.filter(activeJob))
                ) : (
                  <Typography>
                    {jobsRead
                      ? 'The last read found no active processing jobs.'
                      : 'Processing job status has not been read.'}
                  </Typography>
                )}
                {jobs.some((job) => !activeJob(job)) && (
                  <details>
                    <summary>
                      Recent completed or failed jobs (
                      {jobs.filter((job) => !activeJob(job)).length})
                    </summary>
                    {processingJobs(jobs.filter((job) => !activeJob(job)))}
                  </details>
                )}
                {jobNextOffset !== null && (
                  <Button disabled={busy} onClick={() => void act(() => loadJobs(jobNextOffset))}>
                    Load more jobs
                  </Button>
                )}
              </Stack>
            </CardContent>
          </Card>
          <Box>
            <Typography variant="h5" component="h3">
              Documents ({documents.length})
            </Typography>
            {documents.map((doc) => (
              <Card key={doc.id} sx={{ mt: 2 }}>
                <CardContent>
                  <Stack spacing={1}>
                    <Typography variant="h6">
                      {doc.metadata.title || doc.sources[0]?.filename || doc.id}
                    </Typography>
                    <Typography>
                      {doc.icao} · {doc.metadata.variant || 'variant unknown'} · revision{' '}
                      {doc.metadata.revision || 'unknown'} · {doc.metadata.kind}
                    </Typography>
                    <Typography>
                      {doc.metadata.scope === 'aircraft'
                        ? 'Aircraft: ' + doc.metadata.tails.join(', ')
                        : 'General type reference'}{' '}
                      · {doc.status} · {doc.extraction?.page_count ?? '?'} pages
                    </Typography>
                    {doc.error && (
                      <Alert severity="error">{doc.error}. The original is retained.</Alert>
                    )}
                    {!!doc.extraction?.incomplete_pages.length && (
                      <Alert severity="warning">
                        Incomplete pages: {doc.extraction.incomplete_pages.join(', ')}
                      </Alert>
                    )}
                    <Stack direction="row" flexWrap="wrap" gap={1}>
                      <Button
                        onClick={() => {
                          setEditing(doc.id)
                          setDraft({ ...initial, ...doc.metadata })
                          setTails(doc.metadata.tails.join(', '))
                          document
                            .getElementById('library-manual-form')
                            ?.scrollIntoView({ block: 'start' })
                        }}
                      >
                        Edit metadata and associations
                      </Button>
                      <Button onClick={() => void act(() => download(doc))}>
                        Download original PDF
                      </Button>
                      {['index', 'distill', 'embed'].map((kind) => (
                        <Button
                          key={kind}
                          disabled={
                            busy ||
                            jobs.some(
                              (job) => activeJob(job) && job.subject?.document_id === doc.id,
                            ) ||
                            (kind === 'distill' && !caps.llm) ||
                            (kind === 'embed' && !caps.embeddings)
                          }
                          onClick={() =>
                            void act(async () =>
                              addJob(
                                (await request(`/documents/${doc.id}/jobs/${kind}`, {
                                  method: 'POST',
                                })) as Job,
                              ),
                            )
                          }
                        >
                          {kind === 'index'
                            ? 'Re-index'
                            : kind === 'distill'
                              ? 'Distill with LLM'
                              : 'Build semantic index'}
                        </Button>
                      ))}
                    </Stack>
                    <BlankPageReview
                      documentId={doc.id}
                      sourceSha256={doc.sha256}
                      locked={
                        busy ||
                        jobs.some((job) => activeJob(job) && job.subject?.document_id === doc.id)
                      }
                      request={request}
                      download={() => download(doc)}
                      onReviewed={refresh}
                    />
                    <OCRReview
                      documentId={doc.id}
                      sourceSha256={doc.sha256}
                      locked={
                        busy ||
                        jobs.some((job) => activeJob(job) && job.subject?.document_id === doc.id)
                      }
                      request={request}
                      download={() => download(doc)}
                      onReviewed={refresh}
                    />
                    <details>
                      <summary>Source history and applicability</summary>
                      <Typography variant="body2">
                        {doc.metadata.serial_applicability || 'Serial applicability unknown'}.{' '}
                        {doc.metadata.notes}
                      </Typography>
                      {doc.sources.map((s, i) => (
                        <Typography variant="body2" key={i}>
                          {s.filename} · {s.url || 'Uploaded original'} · retrieved {s.retrieved_at}
                        </Typography>
                      ))}
                      <Typography variant="caption">SHA-256 {doc.sha256}</Typography>
                    </details>
                    {doc.artifacts.section_index && (
                      <details>
                        <summary>Extracted section index</summary>
                        <Typography variant="caption">
                          Keyword index of recovered pages, separate from an LLM distillation.
                        </Typography>
                        {Object.entries(doc.artifacts.section_index.sections).map(
                          ([key, value]) => (
                            <Box key={key}>
                              <Typography>
                                {key.replace(/_/g, ' ')}: {value.status}
                              </Typography>
                              {value.pages.map((p) => (
                                <Button
                                  key={p.page}
                                  size="small"
                                  onClick={() => void act(() => showPage(doc.id, p.page))}
                                >
                                  Page {p.page}
                                </Button>
                              ))}
                            </Box>
                          ),
                        )}
                      </details>
                    )}
                    {doc.artifacts.distillation && (
                      <details>
                        <summary>LLM distillation ({doc.artifacts.distillation.status})</summary>
                        {doc.artifacts.distillation.recovery?.kind === 'reviewed_ocr_prefix' && (
                          <Alert severity="info">
                            Previously validated sections reused after source review:{' '}
                            {doc.artifacts.distillation.recovery.recovered_batches} batches and{' '}
                            {doc.artifacts.distillation.recovery.recovered_claims} claims.
                            {doc.artifacts.distillation.status === 'partial' &&
                              ' Additional evidence remains unresolved until further distillation.'}
                          </Alert>
                        )}
                        {doc.artifacts.distillation.sections.map((s, i) => (
                          <Box key={i} sx={{ my: 2 }}>
                            <Typography variant="subtitle2">
                              Reviewed PDF pages {s.pages.join(', ')}
                            </Typography>
                            {claims(s)}
                          </Box>
                        ))}
                      </details>
                    )}
                    <Box>
                      <Button disabled={busy} onClick={() => void act(() => loadHistory(doc.id))}>
                        Load summary history for {doc.metadata.title || doc.icao}
                      </Button>
                      {histories[doc.id] && (
                        <Stack spacing={1}>
                          {histories[doc.id].items.length === 0 && (
                            <Typography>No historical distillations.</Typography>
                          )}
                          {histories[doc.id].items.map((item) => (
                            <Box key={item.revision_id}>
                              <Typography variant="body2">
                                {item.archived_at} · {item.status ?? 'unknown'} ·{' '}
                                {item.completed_batches ?? 'unknown'} batches ·{' '}
                                {item.model ?? 'unknown model'}
                              </Typography>
                              <Button
                                disabled={busy}
                                onClick={() =>
                                  void act(() => inspectHistory(doc.id, item.revision_id))
                                }
                              >
                                Inspect historical summary {item.revision_id.slice(0, 12)}
                              </Button>
                            </Box>
                          ))}
                          {histories[doc.id].next_offset !== null && (
                            <Button
                              disabled={busy}
                              onClick={() =>
                                void act(() => loadHistory(doc.id, histories[doc.id].next_offset!))
                              }
                            >
                              Load older summaries
                            </Button>
                          )}
                        </Stack>
                      )}
                      {historical?.document_id === doc.id && (
                        <Stack
                          data-history-revision={historical.revision_id}
                          spacing={2}
                          sx={{ my: 2 }}
                        >
                          <Alert severity="warning">
                            Historical summary. Its source metadata and extraction may differ from
                            the current document. It is ineligible for current-generation resume and
                            does not establish current applicability. Page links open the current
                            extraction; retained quotations below are historical. Historical claims
                            are retained as generated and may fail current evidence checks.
                          </Alert>
                          <Typography>
                            Retained source: {historical.source_metadata.title} ·{' '}
                            {historical.source_metadata.variant || 'unknown variant'} ·{' '}
                            {historical.source_metadata.revision || 'unknown revision'}
                          </Typography>
                          <Typography variant="caption">
                            Original SHA-256: {historical.source_sha256}
                          </Typography>
                          {historical.artifact.sections.map((section, i) => (
                            <details key={i}>
                              <summary>
                                Historical PDF pages {section.pages.join(', ')} (
                                {section.claims.length} claims)
                              </summary>
                              {claims(section, true)}
                            </details>
                          ))}
                          <Button onClick={() => setHistorical(null)}>
                            Close historical summary
                          </Button>
                        </Stack>
                      )}
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Box>
          <Divider />
          <Stack spacing={2}>
            <Typography variant="h5" component="h3">
              Ask the manuals
            </Typography>
            <TextField
              multiline
              minRows={2}
              label="Performance, systems, maintenance or procedure question"
              value={question}
              onChange={(e) => {
                generation.current++
                requests.current.forEach((c) => c.abort())
                setBusy(false)
                setError('')
                setQuestion(e.target.value)
                setAnswer(null)
                setPassages([])
              }}
            />
            <Stack direction="row" spacing={2}>
              <Button
                disabled={busy || !question.trim()}
                onClick={() =>
                  void act(async () => {
                    const current = generation.current
                    const value = (await request('/search', post({ ...filters(), question }))) as {
                      passages: typeof passages
                    }
                    if (current === generation.current) setPassages(value.passages)
                  })
                }
              >
                Search original pages
              </Button>
              <Button
                variant="contained"
                disabled={busy || !question.trim() || !caps.llm}
                onClick={() =>
                  void act(async () => {
                    const current = generation.current
                    const value = (await request(
                      '/ask',
                      post({ ...filters(), question }),
                    )) as Answer
                    if (current === generation.current) setAnswer(value)
                  })
                }
              >
                Ask with citations
              </Button>
            </Stack>
            {answer && (
              <Card>
                <CardContent>{claims(answer)}</CardContent>
              </Card>
            )}
            {passages.map((p, i) => (
              <Card key={i}>
                <CardContent>
                  <Button onClick={() => void act(() => showPage(p.document_id, p.page))}>
                    PDF page {p.page} · {p.document_id.slice(-8)}
                  </Button>
                  <Typography sx={{ whiteSpace: 'pre-wrap' }}>{p.text}</Typography>
                </CardContent>
              </Card>
            ))}
          </Stack>
          {page && (
            <Card>
              <CardContent>
                <Typography variant="h6">
                  Original extraction · PDF page {page.page} (label {page.label})
                </Typography>
                <Typography variant="caption">
                  {page.method} · {page.document_id}
                </Typography>
                <Box component="pre" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {page.text}
                </Box>
                <Button onClick={() => setPage(null)}>Close page text</Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Stack>
  )
}
