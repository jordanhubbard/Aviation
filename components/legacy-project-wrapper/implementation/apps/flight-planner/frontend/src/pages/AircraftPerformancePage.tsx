import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  FormControlLabel,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import type {
  Capabilities,
  Catalog,
  Citation,
  Condition,
  Dataset,
  PerformanceResult,
  SourceTable,
} from './performanceTypes'
import { conditionLabel } from './performanceTypes'
import { performanceHandoff, returnPerformanceReference } from '../utils/performanceReference'

const API = '/api/aircraft-performance'
const PAGE_SIZE = 25
const MAX_IMPORT = 1_000_000
const fixedUnits = { headwind_kt: 'kt', runway_slope_pct: '%', flaps_pct: '%', flaps_deg: 'deg' }
const identifier = /^[A-Z0-9]{2,4}$/
class AccessRejected extends Error {}

type Requester = (path: string, init?: RequestInit) => Promise<Response>

function Evidence({ citations }: { citations: Citation[] }) {
  return (
    <Stack spacing={1}>
      {citations.map((citation, index) => (
        <Box key={index}>
          <Typography variant="caption">Physical PDF page {citation.page}</Typography>
          <Typography
            component="blockquote"
            variant="body2"
            sx={{
              m: 0,
              pl: 1,
              borderLeft: '2px solid',
              borderColor: 'divider',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
            }}
          >
            {citation.quote}
          </Typography>
        </Box>
      ))}
    </Stack>
  )
}

export default function AircraftPerformancePage() {
  const [handoff] = useState(performanceHandoff)
  const [handoffStatus, setHandoffStatus] = useState('')
  const [keyInput, setKeyInput] = useState('')
  const key = useRef('')
  const [connected, setConnected] = useState(false)
  const [icao, setIcao] = useState('')
  const [registration, setRegistration] = useState('')
  const [caps, setCaps] = useState<Capabilities | null>(null)
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [tableId, setTableId] = useState('')
  const [conditions, setConditions] = useState<Record<string, string>>({})
  const [result, setResult] = useState<PerformanceResult | null>(null)
  const [draft, setDraft] = useState('')
  const [reviewer, setReviewer] = useState('')
  const [attested, setAttested] = useState(false)
  const [retirementReason, setRetirementReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const scope = useRef(0)
  const requests = useRef(new Set<AbortController>())
  const urls = useRef(new Set<string>())

  useEffect(() => {
    if (!handoff || !window.opener) return
    const opener = window.opener
    let accepted = false
    const receive = (event: MessageEvent) => {
      const value = event.data
      if (
        accepted ||
        key.current ||
        event.source !== opener ||
        event.origin !== handoff.origin ||
        value?.type !== 'aviation.performance.context' ||
        value?.session !== handoff.session ||
        typeof value.icao !== 'string' ||
        !/^[A-Z0-9]{2,4}$/.test(value.icao) ||
        typeof value.registration !== 'string' ||
        !/^[A-Z0-9-]{0,16}$/.test(value.registration)
      )
        return
      accepted = true
      setIcao(value.icao)
      setRegistration(value.registration)
    }
    window.addEventListener('message', receive)
    opener.postMessage(
      { type: 'aviation.performance.ready', session: handoff.session },
      handoff.origin,
    )
    return () => window.removeEventListener('message', receive)
  }, [handoff])

  const invalidate = useCallback(() => {
    scope.current += 1
    requests.current.forEach((request) => request.abort())
    requests.current.clear()
    urls.current.forEach((url) => URL.revokeObjectURL(url))
    urls.current.clear()
    setBusy(false)
    setError('')
    setResult(null)
    setHandoffStatus('')
  }, [])
  useEffect(
    () => () => {
      scope.current += 1
      requests.current.forEach((request) => request.abort())
      requests.current.clear()
      urls.current.forEach((url) => URL.revokeObjectURL(url))
      urls.current.clear()
      key.current = ''
    },
    [],
  )

  function clearSelection() {
    invalidate()
    setDataset(null)
    setTableId('')
    setConditions({})
    setReviewer('')
    setAttested(false)
    setRetirementReason('')
  }
  function lock() {
    clearSelection()
    key.current = ''
    setConnected(false)
    setCaps(null)
    setCatalog(null)
    setDraft('')
  }

  async function run<T>(action: (request: Requester) => Promise<T>, accept: (value: T) => void) {
    const version = scope.current
    const credential = key.current
    const controller = new AbortController()
    requests.current.add(controller)
    setBusy(true)
    setError('')
    try {
      const request: Requester = async (path, init = {}) => {
        const response = await fetch(path, {
          ...init,
          signal: controller.signal,
          cache: 'no-store',
          headers: { ...init.headers, Authorization: 'Bearer ' + credential },
        })
        if (!response.ok) {
          let message = `Request failed (HTTP ${response.status})`
          try {
            const body = await response.json()
            if (typeof body.detail === 'string') message = body.detail
            else if (Array.isArray(body.detail))
              message = body.detail
                .map((detail: { msg?: string }) => detail.msg ?? 'Invalid request field')
                .join('; ')
          } catch {
            /* Keep the bounded status description for non-JSON failures. */
          }
          throw response.status === 401 || response.status === 403
            ? new AccessRejected(message)
            : new Error(message)
        }
        return response
      }
      const value = await action(request)
      if (scope.current === version && !controller.signal.aborted) accept(value)
    } catch (failure) {
      if (scope.current === version && !controller.signal.aborted) {
        if (failure instanceof AccessRejected) {
          lock()
          setKeyInput('')
        }
        setError(failure instanceof Error ? failure.message : 'Performance request failed')
      }
    } finally {
      requests.current.delete(controller)
      if (scope.current === version) setBusy(false)
    }
  }

  function listPath(offset = 0) {
    const query = new URLSearchParams({ icao, limit: String(PAGE_SIZE), offset: String(offset) })
    if (registration.trim()) query.set('registration', registration.trim())
    return API + '/datasets?' + query
  }
  function load(offset = 0, connect = false) {
    clearSelection()
    setCatalog(null)
    if (!identifier.test(icao)) {
      setError('Enter an ICAO type designator with 2 to 4 letters or digits.')
      return
    }
    if (connect) {
      if (keyInput.length < 32 || keyInput.length > 512 || /[\r\n]/.test(keyInput)) {
        setError('Enter the configured library access key.')
        return
      }
      key.current = keyInput
    }
    void run(
      async (request) => {
        const capabilities: Capabilities = await (await request(API + '/capabilities')).json()
        const listing: Catalog = await (await request(listPath(offset))).json()
        if (!Array.isArray(listing.datasets)) throw new Error('Dataset list is unavailable')
        return { capabilities, listing }
      },
      ({ capabilities, listing }) => {
        setCaps(capabilities)
        setCatalog(listing)
        setConnected(true)
      },
    )
  }

  function applyDataset(value: Dataset) {
    if (!value.content?.tables?.length || value.content.icao !== icao)
      throw new Error('Dataset does not match the selected type')
    setDataset(value)
    setReviewer('')
    setAttested(false)
    setRetirementReason('')
    chooseTable(value.content.tables[0])
  }
  function chooseTable(table: SourceTable) {
    invalidate()
    setTableId(table.id)
    setConditions(
      Object.fromEntries([
        ...table.axes.map((axis) => [axis, '']),
        ...Object.entries(table.fixed_conditions).map(([name, value]) => [name, String(value)]),
      ]),
    )
  }
  function select(id: string) {
    clearSelection()
    void run(
      async (request): Promise<Dataset> =>
        (await request(API + '/datasets/' + encodeURIComponent(id))).json(),
      applyDataset,
    )
  }
  const table = dataset?.content.tables.find((candidate) => candidate.id === tableId)
  const units = { ...caps?.axes, ...fixedUnits }

  function calculate() {
    invalidate()
    if (!dataset || !table) return
    const values: Record<string, Condition> = {}
    for (const name of [...table.axes, ...Object.keys(table.fixed_conditions)]) {
      const input = conditions[name]?.trim()
      if (!input) {
        setError('Enter every required condition; missing values are not zero.')
        return
      }
      const numeric = table.axes.includes(name) || typeof table.fixed_conditions[name] === 'number'
      if (numeric && !Number.isFinite(Number(input))) {
        setError('Enter finite numeric conditions in the displayed units.')
        return
      }
      values[name] = numeric ? Number(input) : input
    }
    const body = {
      icao,
      registration: registration.trim() || null,
      variant: dataset.content.variant,
      configuration: dataset.content.configuration,
      table_id: table.id,
      conditions: values,
    }
    void run(async (request): Promise<PerformanceResult> => {
      const value: PerformanceResult = await (
        await request(API + '/datasets/' + encodeURIComponent(dataset.id) + '/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      ).json()
      if (
        !Number.isFinite(value.value) ||
        value.dataset_id !== dataset.id ||
        value.content_sha256 !== dataset.content_sha256 ||
        value.table_id !== table.id ||
        value.approved_for_flight !== false ||
        value.metric !== table.metric ||
        value.units !== caps?.metrics[table.metric] ||
        value.source?.sha256 !== dataset.content.source_sha256 ||
        value.source?.document_id !== dataset.content.source_document_id ||
        Object.keys(value.conditions ?? {}).length !== Object.keys(values).length ||
        Object.entries(values).some(([name, condition]) => value.conditions[name] !== condition)
      )
        throw new Error('Calculation identity or numeric result is invalid')
      return value
    }, setResult)
  }

  async function importFile(file?: File) {
    invalidate()
    setDraft('')
    if (!file) return
    if (file.size > MAX_IMPORT) {
      setError('Import a dataset JSON file of at most 1 MB (1,000,000 bytes).')
      return
    }
    const version = scope.current
    try {
      const content = await file.text()
      JSON.parse(content)
      if (version === scope.current) setDraft(content)
    } catch {
      if (version === scope.current) setError('The selected file is not valid dataset JSON.')
    }
  }
  function importDraft() {
    clearSelection()
    void run(
      async (request): Promise<Dataset> => {
        const content = JSON.parse(draft)
        if (typeof content.icao !== 'string' || content.icao.trim().toUpperCase() !== icao)
          throw new Error('The draft ICAO type must match the selected filter.')
        return (
          await request(API + '/datasets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: draft,
          })
        ).json()
      },
      (value) => {
        applyDataset(value)
        setDraft('')
        setCatalog(null)
      },
    )
  }
  function review() {
    if (!dataset) return
    invalidate()
    void run(
      async (request): Promise<Dataset> =>
        (
          await request(API + '/datasets/' + encodeURIComponent(dataset.id) + '/review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              expected_content_sha256: dataset.content_sha256,
              reviewer: reviewer.trim(),
              attest_source_and_applicability: attested,
            }),
          })
        ).json(),
      (value) => {
        applyDataset(value)
        setCatalog(null)
      },
    )
  }
  function retire() {
    if (!dataset) return
    invalidate()
    void run(
      async (request): Promise<Dataset> =>
        (
          await request(API + '/datasets/' + encodeURIComponent(dataset.id) + '/retire', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              expected_content_sha256: dataset.content_sha256,
              reason: retirementReason.trim(),
            }),
          })
        ).json(),
      (value) => {
        applyDataset(value)
        setCatalog(null)
      },
    )
  }
  function original() {
    if (!dataset) return
    invalidate()
    void run(
      async (request) => {
        const response = await request(
          '/api/aircraft-library/documents/' +
            encodeURIComponent(dataset.content.source_document_id) +
            '/original',
        )
        const blob = await response.blob()
        if (blob.size > 100 * 1024 * 1024)
          throw new Error('Original exceeds the document size limit')
        const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
        const hex = Array.from(new Uint8Array(digest), (byte) =>
          byte.toString(16).padStart(2, '0'),
        ).join('')
        if (hex !== dataset.content.source_sha256)
          throw new Error('Original PDF identity does not match the dataset')
        return blob
      },
      (blob) => {
        const url = URL.createObjectURL(blob)
        urls.current.add(url)
        const link = document.createElement('a')
        link.href = url
        link.download = dataset.content.icao + '-original.pdf'
        link.click()
        window.setTimeout(() => {
          URL.revokeObjectURL(url)
          urls.current.delete(url)
        }, 1000)
      },
    )
  }

  return (
    <Stack spacing={3} sx={{ py: 3, overflowWrap: 'anywhere' }}>
      <Box>
        <Typography variant="h4" component="h1">
          Sourced aircraft performance
        </Typography>
        <Typography>
          Research calculations from reviewed original-manual tables. Select the exact source
          applicability and conditions; user-entered aircraft settings are not replaced.
        </Typography>
      </Box>
      <Alert severity="info">
        The access key and private results stay in this page only. Performance data is excluded from
        general AI explanations, saved plans and offline exports.
      </Alert>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField
          label="Library access key"
          type="password"
          value={keyInput}
          autoComplete="off"
          onChange={(event) => {
            lock()
            setKeyInput(event.target.value)
          }}
          inputProps={{ maxLength: 512 }}
        />
        <TextField
          label="ICAO type"
          value={icao}
          onChange={(event) => {
            clearSelection()
            setCatalog(null)
            setIcao(event.target.value.trim().toUpperCase())
          }}
          inputProps={{ maxLength: 4 }}
        />
        <TextField
          label="Registration (optional)"
          value={registration}
          onChange={(event) => {
            clearSelection()
            setCatalog(null)
            setRegistration(event.target.value.toUpperCase())
          }}
          inputProps={{ maxLength: 20 }}
        />
        <Button variant="contained" disabled={busy} onClick={() => load(0, true)}>
          Connect and list datasets
        </Button>
        <Button
          onClick={() => {
            lock()
            setKeyInput('')
          }}
        >
          Lock and clear
        </Button>
      </Stack>
      {busy && <Typography role="status">Loading private performance data…</Typography>}
      {error && (
        <Alert severity="error" role="alert">
          {error}
        </Alert>
      )}
      {caps && (
        <Alert severity="warning">
          {caps.limitations}. {caps.correction_scope}.
        </Alert>
      )}
      {connected && (
        <Box component="details">
          <Typography component="summary">Import a transcribed dataset draft</Typography>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <Typography>
              Import the bounded dataset JSON with original-page quotes, conditions and table
              values. Importing creates a draft; review is a separate deliberate action.
            </Typography>
            <Button component="label" variant="outlined">
              Choose dataset JSON
              <input
                hidden
                type="file"
                accept=".json,application/json"
                aria-label="Dataset JSON file"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  void importFile(file)
                }}
              />
            </Button>
            {draft && (
              <>
                <Typography>
                  JSON loaded ({new Blob([draft]).size.toLocaleString()} bytes); source validation
                  occurs on import.
                </Typography>
                <Button disabled={busy} onClick={importDraft}>
                  Import draft
                </Button>
              </>
            )}
          </Stack>
        </Box>
      )}
      {connected && (
        <Button disabled={busy} onClick={() => load()}>
          Refresh datasets
        </Button>
      )}
      {catalog && (
        <Box component="details" open={!dataset}>
          <Typography component="summary">Datasets ({catalog.total})</Typography>
          <Stack spacing={2}>
            <Typography>
              {catalog.total} datasets · showing {catalog.total ? catalog.offset + 1 : 0}–
              {Math.min(catalog.offset + catalog.datasets.length, catalog.total)}
            </Typography>
            {catalog.datasets.map((item) => (
              <Card key={item.id}>
                <CardContent>
                  <Stack spacing={1}>
                    <Typography variant="h6">{item.title}</Typography>
                    <Chip label={item.state} sx={{ alignSelf: 'flex-start' }} />
                    <Typography>
                      {item.icao} · {item.variant} · revision {item.source_revision}
                    </Typography>
                    <Typography>{item.configuration}</Typography>
                    <Typography>
                      {item.metrics.map((metric) => conditionLabel(metric)).join(', ')}
                    </Typography>
                    {item.unavailable_reason && (
                      <Alert severity="warning">{item.unavailable_reason}</Alert>
                    )}
                    <Button
                      disabled={busy}
                      aria-label={'Inspect dataset ' + item.title}
                      onClick={() => select(item.id)}
                    >
                      Inspect dataset
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            ))}
            <Stack direction="row" spacing={2}>
              <Button
                disabled={busy || !catalog.offset}
                onClick={() => load(Math.max(0, catalog.offset - PAGE_SIZE))}
              >
                Previous datasets
              </Button>
              <Button
                disabled={busy || catalog.offset + catalog.limit >= catalog.total}
                onClick={() => load(catalog.offset + catalog.limit)}
              >
                Next datasets
              </Button>
            </Stack>
          </Stack>
        </Box>
      )}
      {dataset && (
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h5" component="h2">
                {dataset.content.title}
              </Typography>
              <Chip label={dataset.state} sx={{ alignSelf: 'flex-start' }} />
              {dataset.unavailable_reason && (
                <Alert severity="warning">{dataset.unavailable_reason}</Alert>
              )}
              <Typography>
                {dataset.content.icao} · {dataset.content.variant} · revision{' '}
                {dataset.content.source_revision}
              </Typography>
              <Typography>{dataset.content.configuration}</Typography>
              <Typography variant="body2">Content SHA-256: {dataset.content_sha256}</Typography>
              <Typography variant="body2">
                Original SHA-256: {dataset.content.source_sha256}
              </Typography>
              <Typography variant="body2">
                Review:{' '}
                {dataset.reviewer ? `${dataset.reviewer} · ${dataset.reviewed_at}` : 'Not reviewed'}
              </Typography>
              {dataset.retirement_reason && (
                <Typography>Retirement: {dataset.retirement_reason}</Typography>
              )}
              <Button disabled={busy} onClick={original}>
                Download and verify original PDF
              </Button>
              <TextField
                select
                label="Source table"
                value={tableId}
                onChange={(event) => {
                  const selected = dataset.content.tables.find(
                    (candidate) => candidate.id === event.target.value,
                  )
                  if (selected) chooseTable(selected)
                }}
              >
                {dataset.content.tables.map((candidate) => (
                  <MenuItem key={candidate.id} value={candidate.id}>
                    {candidate.source_table} · {conditionLabel(candidate.metric)}
                  </MenuItem>
                ))}
              </TextField>
              {table && (
                <>
                  <Typography>
                    Interpolated axes:{' '}
                    {table.interpolation_axes.join(', ') || 'None; exact source coordinates only'}.
                    All other axes require exact source coordinates.
                  </Typography>
                  <Box component="details">
                    <Typography component="summary">
                      Original table rows and evidence ({table.points.length})
                    </Typography>
                    <Box
                      sx={{ overflowX: 'auto' }}
                      tabIndex={0}
                      role="region"
                      aria-label="Original table evidence"
                    >
                      <Table size="small" sx={{ minWidth: 650 }}>
                        <TableHead>
                          <TableRow>
                            <TableCell>Coordinates</TableCell>
                            <TableCell>Value</TableCell>
                            <TableCell>Page evidence</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {table.points.map((point, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                {Object.entries(point.coordinates)
                                  .map(
                                    ([name, value]) => `${conditionLabel(name, units)}: ${value}`,
                                  )
                                  .join('; ')}
                              </TableCell>
                              <TableCell>
                                {point.value} {caps?.metrics[table.metric]}
                              </TableCell>
                              <TableCell>
                                <Evidence citations={point.citations} />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Box>
                    <Evidence citations={table.interpolation_citations} />
                  </Box>
                  {table.notes.map((note, index) => (
                    <Typography key={index} variant="body2">
                      {note}
                    </Typography>
                  ))}
                  <Box component="details">
                    <Typography component="summary">
                      Correction coverage ({table.corrections.length})
                    </Typography>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                      {table.corrections.map((rule) => (
                        <Box key={rule.name}>
                          <Typography>
                            {rule.name}: {rule.direction} {rule.percent}% per{' '}
                            {rule.per_units ?? 'matching surface'}{' '}
                            {conditionLabel(rule.variable, units)}; reference{' '}
                            {String(rule.reference)}; coverage{' '}
                            {rule.kind === 'linear_percent'
                              ? `${rule.minimum} to ${rule.maximum}`
                              : rule.match_value}
                            . Basis: this metric’s current result.
                          </Typography>
                          <Evidence citations={rule.citations} />
                        </Box>
                      ))}
                      <Typography>
                        Combination order:{' '}
                        {table.correction_order.join(' → ') ||
                          'No combined-correction authority declared'}
                      </Typography>
                      <Evidence citations={table.combination_citations} />
                    </Stack>
                  </Box>
                  <Typography variant="h6" component="h3">
                    Required scenario conditions
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                      gap: 2,
                    }}
                  >
                    {[...table.axes, ...Object.keys(table.fixed_conditions)].map((name) => (
                      <TextField
                        key={name}
                        label={conditionLabel(name, units)}
                        value={conditions[name] ?? ''}
                        type={
                          table.axes.includes(name) ||
                          typeof table.fixed_conditions[name] === 'number'
                            ? 'number'
                            : 'text'
                        }
                        required
                        onChange={(event) => {
                          invalidate()
                          setConditions((previous) => ({ ...previous, [name]: event.target.value }))
                        }}
                        helperText={
                          table.axes.includes(name)
                            ? table.interpolation_axes.includes(name)
                              ? 'Inside the reviewed grid only'
                              : 'Exact source coordinate required'
                            : 'Explicit source condition; edit only within declared correction coverage'
                        }
                      />
                    ))}
                  </Box>
                  <Button
                    variant="contained"
                    disabled={busy || !dataset.usable || dataset.state !== 'reviewed'}
                    onClick={calculate}
                  >
                    Calculate from reviewed table
                  </Button>
                </>
              )}
              {dataset.state === 'draft' && (
                <Box component="details">
                  <Typography component="summary">Review source transcription</Typography>
                  <Stack spacing={2} sx={{ mt: 2 }}>
                    <TextField
                      label="Reviewer"
                      value={reviewer}
                      onChange={(event) => {
                        invalidate()
                        setReviewer(event.target.value)
                        setAttested(false)
                      }}
                      inputProps={{ maxLength: 200 }}
                    />
                    <FormControlLabel
                      label="I checked the original values, units, conditions and aircraft applicability"
                      control={
                        <Checkbox
                          checked={attested}
                          onChange={(event) => {
                            invalidate()
                            setAttested(event.target.checked)
                          }}
                        />
                      }
                    />
                    <Button disabled={busy || !reviewer.trim() || !attested} onClick={review}>
                      Attest review of this content identity
                    </Button>
                  </Stack>
                </Box>
              )}
              {dataset.state !== 'retired' && (
                <Box component="details">
                  <Typography component="summary">Retire this dataset</Typography>
                  <Stack spacing={2} sx={{ mt: 2 }}>
                    <TextField
                      label="Retirement reason"
                      value={retirementReason}
                      onChange={(event) => {
                        invalidate()
                        setRetirementReason(event.target.value)
                      }}
                      inputProps={{ maxLength: 1000 }}
                    />
                    <Button
                      color="warning"
                      disabled={busy || retirementReason.trim().length < 5}
                      onClick={retire}
                    >
                      Retire current dataset identity
                    </Button>
                  </Stack>
                </Box>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}
      {result && (
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h5" component="h2">
                Calculated research result
              </Typography>
              <Typography component="output" aria-live="polite" variant="h4">
                {Number(result.value.toPrecision(12))} {result.units}
              </Typography>
              <Typography>
                {conditionLabel(result.metric)} · uncorrected {result.uncorrected_value}{' '}
                {result.units}
              </Typography>
              <Box component="details">
                <Typography component="summary">Unrounded numerical value</Typography>
                <Typography>
                  Unrounded value: {result.value} {result.units}
                </Typography>
              </Box>
              {handoff && dataset && (
                <Box>
                  <Alert severity="info">
                    Return this calculation-time source reference to {handoff.origin}. The access
                    key and source quotations stay here. The receiving application must check
                    applicability.
                  </Alert>
                  <Button
                    onClick={() => {
                      try {
                        returnPerformanceReference(handoff, result, dataset)
                        setHandoffStatus(
                          'Reference returned. Review conditions in the receiving application.',
                        )
                      } catch (failure) {
                        setHandoffStatus(
                          failure instanceof Error
                            ? failure.message
                            : 'Reference could not be returned.',
                        )
                      }
                    }}
                  >
                    Return reference to application
                  </Button>
                  {handoffStatus && <Typography role="status">{handoffStatus}</Typography>}
                </Box>
              )}
              <Alert severity="warning">{result.limitations}</Alert>
              {result.warnings.map((warning, index) => (
                <Alert key={index} severity="warning">
                  {warning}
                </Alert>
              ))}
              <Typography>
                {result.variant} · {result.configuration} · registration{' '}
                {result.registration ?? 'not specified'}
              </Typography>
              <Typography>
                Source: {result.source_table} · revision {result.source.revision}
              </Typography>
              <Typography variant="body2">
                Dataset {result.dataset_id} · {result.content_sha256}
              </Typography>
              <Typography>
                Method: {result.method}. Reviewed by {result.reviewer} at {result.reviewed_at}.
                Calculated {result.calculated_at}.
              </Typography>
              <Typography>
                Conditions:{' '}
                {Object.entries(result.conditions)
                  .map(([name, value]) => `${conditionLabel(name, units)}: ${value}`)
                  .join('; ')}
              </Typography>
              <Typography variant="h6" component="h3">
                Contributing source rows
              </Typography>
              {result.contributions.map((point, index) => (
                <Box key={index}>
                  <Typography>
                    {Object.entries(point.coordinates)
                      .map(([name, value]) => `${conditionLabel(name, units)}: ${value}`)
                      .join('; ')}{' '}
                    · value {point.value} {result.units} · weight {point.weight}
                  </Typography>
                  <Evidence citations={point.citations} />
                </Box>
              ))}
              {result.corrections.map((step, index) => (
                <Box key={index}>
                  <Typography>
                    {step.rule.name}: condition {String(step.requested_value)}, multiplier{' '}
                    {step.factor}
                  </Typography>
                  <Evidence citations={step.rule.citations} />
                </Box>
              ))}
              <Evidence citations={result.interpolation_citations} />
              <Evidence citations={result.combination_citations} />
              {result.notes.map((note, index) => (
                <Typography key={index}>{note}</Typography>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  )
}
