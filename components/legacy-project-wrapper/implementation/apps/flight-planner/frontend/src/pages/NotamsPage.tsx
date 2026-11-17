import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import {
  NotamReportsClient,
  type NotamBriefing,
  type NotamNotice,
  type NotamSourceDetail,
} from '@aviation/shared-sdk/aviation/notam-reports'

export default function NotamsPage() {
  const client = useMemo(
    () => new NotamReportsClient({ baseUrl: window.location.origin + '/api/notams' }),
    [],
  )
  const [locations, setLocations] = useState('KPAO')
  const [report, setReport] = useState<NotamBriefing | null>(null)
  const [detail, setDetail] = useState<NotamSourceDetail | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())
  const [pageIndex, setPageIndex] = useState(0)
  const request = useRef<AbortController | null>(null)
  const downloads = useRef(new Set<string>())
  useEffect(
    () => () => {
      request.current?.abort()
      request.current = null
      downloads.current.forEach((url) => URL.revokeObjectURL(url))
      downloads.current.clear()
    },
    [],
  )
  useEffect(() => {
    if (!report) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(timer)
  }, [report])

  function clear() {
    request.current?.abort()
    request.current = null
    setBusy(false)
    setReport(null)
    setDetail(null)
    setError('')
    setPageIndex(0)
  }
  async function load() {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setReport(null)
    setDetail(null)
    setError('')
    setPageIndex(0)
    try {
      const result = await client.fetch(
        locations.split(',').map((s) => s.trim()),
        { signal: controller.signal, fullText: false },
      )
      if (request.current === controller) setReport(result)
    } catch (e) {
      if (request.current === controller && !controller.signal.aborted)
        setError(e instanceof Error ? e.message : 'NOTAM request failed')
    } finally {
      if (request.current === controller) setBusy(false)
    }
  }
  async function read(notice: NotamNotice) {
    if (!report?.snapshot_id) return
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setDetail(null)
    setError('')
    try {
      const result = await client.detail(notice.id, report.snapshot_id, controller.signal)
      if (result.environment !== report.environment)
        throw new Error('Source environment changed; reload the reports')
      if (request.current === controller) setDetail(result)
    } catch (e) {
      if (request.current === controller && !controller.signal.aborted) {
        setReport(null)
        setError(e instanceof Error ? e.message : 'Source detail failed')
      }
    } finally {
      if (request.current === controller) setBusy(false)
    }
  }
  function download() {
    if (!detail) return
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(detail.source_feature, null, 2)], { type: 'application/geo+json' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = 'notam-' + detail.notice.id.replace(/[^A-Za-z0-9_-]/g, '_') + '.json'
    downloads.current.add(url)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => {
      URL.revokeObjectURL(url)
      downloads.current.delete(url)
    }, 1000)
  }
  const age = report?.synchronized_at ? now - Date.parse(report.synchronized_at) : NaN
  const stale =
    !!report &&
    report.complete_snapshot &&
    (!Number.isFinite(age) || age < 0 || age > 240000 || report.status === 'stale')

  function noticeContent(n: NotamNotice, full = false) {
    return (
      <Stack spacing={1}>
        <Typography variant="h6" sx={{ overflowWrap: 'anywhere' }}>
          {n.number ? `NOTAM ${n.number}` : 'NOTAM source notice'} · {n.icao_location ?? n.location}
        </Typography>
        <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
          Source ID: {n.id}
          {n.series ? ` · Series ${n.series}` : ''}
          {n.year ? ` · Year ${n.year}` : ''}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip label={n.activity.replace(/_/g, ' ')} />
          <Chip label={n.severity ? `Text hint: ${n.severity}` : 'No text hint'} />
          <Chip label={n.classification} variant="outlined" />
        </Stack>
        <Typography>
          Effective: {n.effective_start_utc ?? 'Unknown'} →{' '}
          {n.permanent ? 'PERM' : (n.effective_end_utc ?? 'Unknown')}
          {n.estimated ? ' (estimated)' : ''}
        </Typography>
        {n.cancelled_at_utc && <Typography>Cancellation: {n.cancelled_at_utc}</Typography>}
        {n.schedule && <Typography>Schedule: {n.schedule}</Typography>}
        {n.missing_fields.length > 0 && (
          <Alert severity="warning">Source fields missing: {n.missing_fields.join(', ')}</Alert>
        )}
        <Typography component="div" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          {n.text ?? 'Source text unavailable'}
        </Typography>
        {n.text_truncated && (
          <Typography color="text.secondary">
            Preview: {Array.from(n.text ?? '').length} of {n.text_length} characters. Read the full
            source.
          </Typography>
        )}
        <Typography variant="caption">Last source modification: {n.last_updated_utc}</Typography>
        {!full && (
          <Button disabled={busy} onClick={() => void read(n)}>
            {n.text_truncated ? 'Read full source' : 'Source details'}
          </Button>
        )}
      </Stack>
    )
  }
  return (
    <Stack spacing={2}>
      <Typography variant="h4">NOTAMs</Typography>
      <Typography>
        Read cached source notices for airports or FAA location identifiers. Location matching does
        not assess every notice along a route.
      </Typography>
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault()
          void load()
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="stretch">
          <TextField
            fullWidth
            label="Airports / source locations"
            value={locations}
            onChange={(e) => {
              clear()
              setLocations(e.target.value)
            }}
            helperText="Comma-separated identifiers, for example KPAO, KSFO"
          />
          <Button
            type="submit"
            sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            variant="contained"
            disabled={busy || !locations.trim()}
          >
            Read NOTAMs
          </Button>
        </Stack>
      </Box>
      {busy && (
        <Box role="status">
          <CircularProgress size={24} /> Reading source…
        </Box>
      )}
      {error && <Alert severity="error">{error}</Alert>}
      {report && (
        <>
          {!report.production_data && (
            <Alert severity="error">
              {report.environment && report.environment !== 'production'
                ? 'Non-production NOTAM data: may include test notices.'
                : 'Production NOTAM data is unavailable.'}
            </Alert>
          )}
          <Alert
            severity={
              stale || report.status === 'unavailable'
                ? 'error'
                : report.status === 'partial'
                  ? 'warning'
                  : 'info'
            }
          >
            {stale ? 'Stale source' : report.status.replace(/_/g, ' ')} · {report.total} matching
            cached records · {report.incomplete_records} with missing source fields
          </Alert>
          <Typography>
            Source: {report.source.provider} · Environment: {report.environment ?? 'not configured'}{' '}
            · Synchronized: {report.synchronized_at ?? 'Unknown'}
          </Typography>
          <Typography variant="body2">
            Requested: {report.requested_locations.join(', ')} · Matched source identifiers:{' '}
            {report.matched_locations.join(', ')}
          </Typography>
          {report.error && <Alert severity="warning">{report.error}</Alert>}
          {report.warnings.map((w) => (
            <Typography key={w} variant="body2" color="text.secondary">
              {w}
            </Typography>
          ))}
          {report.status === 'no_reports' && (
            <Typography>
              No matching records in this cached snapshot. This is not confirmation that no
              applicable NOTAM exists.
            </Typography>
          )}
          {detail && (
            <Card variant="outlined" component="section" aria-label="Original NOTAM source">
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h5">Full source notice</Typography>
                  {noticeContent(detail.notice, true)}
                  <Button onClick={download}>Download original GeoJSON</Button>
                  <Button onClick={() => setDetail(null)}>Close source details</Button>
                </Stack>
              </CardContent>
            </Card>
          )}
          {report.notams.length > 25 && (
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Button
                disabled={busy || pageIndex === 0}
                onClick={() => {
                  setPageIndex((p) => p - 1)
                  setDetail(null)
                }}
              >
                Previous notices
              </Button>
              <Typography>
                {pageIndex * 25 + 1}–{Math.min((pageIndex + 1) * 25, report.notams.length)} of{' '}
                {report.notams.length} loaded notices
              </Typography>
              <Button
                disabled={busy || (pageIndex + 1) * 25 >= report.notams.length}
                onClick={() => {
                  setPageIndex((p) => p + 1)
                  setDetail(null)
                }}
              >
                Next notices
              </Button>
            </Stack>
          )}
          {report.notams.slice(pageIndex * 25, (pageIndex + 1) * 25).map((n) => (
            <Card key={n.id} variant="outlined">
              <CardContent>{noticeContent(n)}</CardContent>
            </Card>
          ))}
        </>
      )}
    </Stack>
  )
}
