import { peekFilingInputs, consumeFilingInputs } from '../utils/filingInputs'
import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'

type Value = string | number | boolean | null
type Plan = Record<string, Value>
type Action = 'file' | 'amend' | 'activate' | 'cancel' | 'close'
type Draft = { id: string; revision: number; account: string; plan: Plan }
type Filing = {
  id: string
  draft_id: string
  provider_id: string
  environment: string
  snapshot: { currentState: string } | null
}
type Operation = {
  id: string
  action: Action
  environment: string
  status: string
  filing_id: string | null
  response: {
    returnMessage?: string[]
    returnCodedMessage?: { code: string; message: string }[]
    local_error?: string
    flightIdentifier?: string
    versionStamp?: string
    attestation?: { resolution: string; reference: string }
  } | null
}
type Review = {
  confirmation_token: string
  expires_at: string
  action: Action
  environment: string
  plan: Plan
  warnings: string[]
  provider_state: string | null
  changed_fields: string[]
  provider_fields: Record<string, string>
}
type Capabilities = {
  environment: string | null
  configured: boolean
  private_api_configured: boolean
  production_approval_attested: boolean
}
type Field = {
  key: string
  label: string
  numeric?: boolean
  options?: string[]
  multiline?: boolean
  time?: boolean
  hint?: string
}
const fields: Field[] = [
  { key: 'flight_rules', label: 'Flight rules', options: ['VFR', 'IFR'] },
  { key: 'aircraft_identifier', label: 'Aircraft callsign' },
  { key: 'aircraft_type', label: 'ICAO aircraft type' },
  { key: 'departure', label: 'Departure identifier' },
  { key: 'destination', label: 'Destination identifier' },
  { key: 'departure_instant', label: 'Departure (UTC)', time: true },
  { key: 'flight_duration_minutes', label: 'Flight duration (minutes)', numeric: true },
  { key: 'route', label: 'ICAO route', multiline: true },
  { key: 'aircraft_equipment', label: 'ICAO aircraft equipment codes' },
  { key: 'surveillance_equipment', label: 'ICAO surveillance codes' },
  {
    key: 'speed_knots',
    label: 'Cruise speed (knots)',
    hint: 'Provide speed in knots or Mach.',
    numeric: true,
  },
  {
    key: 'speed_mach',
    label: 'Cruise speed (Mach)',
    hint: 'Provide speed in knots or Mach.',
    numeric: true,
  },
  { key: 'altitude_type', label: 'Altitude type', options: ['A', 'F', 'S', 'M', 'VFR', 'VFRFL'] },
  {
    key: 'altitude_value',
    label: 'Altitude value',
    hint: 'A/F/VFRFL: hundreds of feet. S/M: tens of metres. Non-specific VFR: leave blank.',
    numeric: true,
  },
  { key: 'fuel_minutes', label: 'Actual fuel endurance (minutes)', numeric: true },
  { key: 'pilot_data', label: 'Pilot contact information', multiline: true },
  { key: 'people_on_board', label: 'Persons on board' },
  { key: 'aircraft_color', label: 'Aircraft colours / markings' },
  { key: 'alternate1', label: 'First alternate' },
  { key: 'alternate2', label: 'Second alternate' },
  { key: 'other_info', label: 'ICAO other information', multiline: true },
  { key: 'pilot_in_command', label: 'Pilot in command' },
  { key: 'type_of_flight', label: 'Type of flight', options: ['S', 'N', 'G', 'M', 'X'] },
  { key: 'number_of_aircraft', label: 'Number of aircraft', numeric: true },
  { key: 'wake_turbulence', label: 'Wake category', options: ['LIGHT', 'MEDIUM', 'HEAVY'] },
  { key: 'departure_lat_long', label: 'Departure coordinates (DDMMNDDDMME)' },
  { key: 'destination_lat_long', label: 'Destination coordinates (DDMMNDDDMME)' },
  {
    key: 'estimated_arrival',
    label: 'Extended VFR ETA (UTC; zero-duration plans only)',
    time: true,
  },
  { key: 'radios', label: 'Emergency radio codes' },
  { key: 'survival', label: 'Survival equipment codes' },
  { key: 'jackets', label: 'Life jacket codes' },
  { key: 'number_of_dinghies', label: 'Number of dinghies', numeric: true },
  { key: 'capacity_of_dinghies', label: 'Dinghy capacity', numeric: true },
  { key: 'color_of_dinghies', label: 'Dinghy colour' },
  { key: 'supplemental_remarks', label: 'Supplemental remarks', multiline: true },
]
const API = '/api/filing'
const PAGE = 50

export default function FilingPage() {
  const [planningInputs, setPlanningInputs] = useState(peekFilingInputs)
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null)
  const [key, setKey] = useState('')
  const [account, setAccount] = useState('')
  const [connected, setConnected] = useState(false)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [filings, setFilings] = useState<Filing[]>([])
  const [linkedFiling, setLinkedFiling] = useState<Filing | null>(null)
  const [operations, setOperations] = useState<Operation[]>([])
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Draft | null>(null)
  const [plan, setPlan] = useState<Plan>({})
  const [dirty, setDirty] = useState(false)
  const [issues, setIssues] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [review, setReview] = useState<Review | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [action, setAction] = useState<Action>('file')
  const [actualDeparture, setActualDeparture] = useState('')
  const [closeInfo, setCloseInfo] = useState('')
  const [receipt, setReceipt] = useState<Operation | null>(null)
  const [audit, setAudit] = useState<{ sequence: number; event: string; recorded_at: string }[]>([])
  const [resolution, setResolution] = useState('not_applied')
  const [reference, setReference] = useState('')
  const [providerId, setProviderId] = useState('')
  const [attested, setAttested] = useState(false)
  const epoch = useRef(0)
  const controllers = useRef(new Set<AbortController>())

  useEffect(() => {
    consumeFilingInputs(planningInputs)
  }, [planningInputs])

  useEffect(() => {
    const controller = new AbortController()
    const sessionEpoch = epoch
    const pendingControllers = controllers.current
    fetch(API + '/capabilities', { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Flight Service status unavailable')
        return response.json()
      })
      .then(setCapabilities)
      .catch((error) => {
        if (!controller.signal.aborted) setMessage(error.message)
      })
    return () => {
      controller.abort()
      sessionEpoch.current++
      pendingControllers.forEach((value) => value.abort())
    }
  }, [])

  function resetReview() {
    setReview(null)
    setConfirmed(false)
  }
  function clearPrivate() {
    epoch.current++
    controllers.current.forEach((value) => value.abort())
    controllers.current.clear()
    setConnected(false)
    setDrafts([])
    setFilings([])
    setOperations([])
    setSelected(null)
    setPlan({})
    setDirty(false)
    setIssues({})
    setMessage('')
    setBusy(false)
    setPage(0)
    setReceipt(null)
    setLinkedFiling(null)
    setAudit([])
    setReference('')
    setProviderId('')
    setAttested(false)
    setActualDeparture('')
    setCloseInfo('')
    resetReview()
  }
  async function request<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
    const controller = new AbortController()
    controllers.current.add(controller)
    const generation = epoch.current
    try {
      const result = await fetch(API + path, {
        method: body === undefined && method === 'POST' ? 'GET' : method,
        signal: controller.signal,
        cache: 'no-store',
        credentials: 'omit',
        headers: {
          Authorization: 'Bearer ' + key,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
      const value = await result.json()
      if (generation !== epoch.current) throw new DOMException('Context changed', 'AbortError')
      if (!result.ok) {
        if (Array.isArray(value.detail)) {
          setIssues(
            Object.fromEntries(
              value.detail.map((item: { loc: string[]; msg: string }) => [
                item.loc.at(-1),
                item.msg,
              ]),
            ),
          )
          throw new Error('Correct the highlighted input fields.')
        }
        throw new Error(
          typeof value.detail === 'string'
            ? value.detail
            : 'Flight Service request failed. Check saved receipts before retrying an action.',
        )
      }
      return value as T
    } finally {
      controllers.current.delete(controller)
    }
  }
  async function run(work: () => Promise<void>) {
    const generation = epoch.current
    setBusy(true)
    setMessage('')
    try {
      await work()
    } catch (error) {
      if (generation === epoch.current && (error as Error).name !== 'AbortError')
        setMessage((error as Error).message)
    } finally {
      if (generation === epoch.current) setBusy(false)
    }
  }
  async function load(offset = page * PAGE) {
    const [nextDrafts, nextFilings, nextOperations] = await Promise.all([
      request<Draft[]>('/drafts?limit=50&offset=' + offset),
      request<Filing[]>('/filings?limit=50&offset=' + offset),
      request<Operation[]>('/operations?limit=50&offset=' + offset),
    ])
    setDrafts(nextDrafts)
    setFilings(nextFilings)
    setOperations(nextOperations)
    setConnected(true)
    if (selected && nextDrafts.some((value) => value.id === selected.id))
      setLinkedFiling(await request<Filing | null>('/drafts/' + selected.id + '/filing'))
  }
  function edit(field: string, value: Value) {
    setPlan((previous) => ({ ...previous, [field]: value }))
    setDirty(true)
    resetReview()
  }
  const filing =
    linkedFiling?.draft_id === selected?.id
      ? linkedFiling
      : filings.find((value) => value.draft_id === selected?.id)
  const available =
    capabilities?.configured &&
    (capabilities.environment !== 'production' || capabilities.production_approval_attested)

  function renderField(field: Field) {
    return (
      <TextField
        key={field.key}
        fullWidth
        label={field.label}
        select={!!field.options}
        type={field.time ? 'datetime-local' : field.numeric ? 'number' : 'text'}
        InputLabelProps={field.time ? { shrink: true } : undefined}
        inputProps={field.numeric ? { step: 'any' } : undefined}
        multiline={field.multiline}
        minRows={field.multiline ? 2 : undefined}
        value={field.time ? String(plan[field.key] ?? '').slice(0, 16) : (plan[field.key] ?? '')}
        error={!!(issues[field.key] || (field.key.startsWith('speed_') && issues.speed))}
        helperText={
          issues[field.key] || (field.key.startsWith('speed_') && issues.speed) || field.hint
        }
        onChange={(event) => {
          const value = event.target.value
          edit(
            field.key,
            value === ''
              ? null
              : field.numeric
                ? Number(value)
                : field.time
                  ? new Date(value + 'Z').toISOString()
                  : value,
          )
        }}
      >
        {field.options && [
          <MenuItem key="empty" value="">
            Select explicitly
          </MenuItem>,
          ...field.options.map((value) => (
            <MenuItem key={value} value={value}>
              {value}
            </MenuItem>
          )),
        ]}
      </TextField>
    )
  }

  return (
    <Stack spacing={3} data-aviation-private="true" sx={{ overflowWrap: 'anywhere' }}>
      <Typography variant="h4" component="h1">
        Flight Service filing
      </Typography>
      <Alert severity="info">
        Saved drafts and route exports are separate from provider-acknowledged filing. Verify
        aircraft equipment, actual fuel, pilot details and a complete briefing before any action.
      </Alert>
      <Alert severity={available ? 'info' : 'warning'}>
        Environment: {capabilities?.environment ?? 'not selected'}. Vendor configuration:{' '}
        {capabilities?.configured ? 'present; access not verified' : 'unavailable'}. Production
        approval:{' '}
        {capabilities?.production_approval_attested ? 'operator attested' : 'not attested'}. Pilot
        authorization is established by provider responses.
      </Alert>
      <TextField
        type="password"
        label="Private Flight Service access key"
        value={key}
        autoComplete="off"
        onChange={(event) => {
          clearPrivate()
          setKey(event.target.value)
        }}
      />
      <TextField
        label="Pilot Flight Service account"
        value={account}
        autoComplete="off"
        onChange={(event) => {
          clearPrivate()
          setAccount(event.target.value)
        }}
      />
      <Typography variant="caption">
        Private information stays in this page's memory until you explicitly save it to the private
        service. Changing the key or account clears the page.
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={1}>
        <Button
          disabled={busy || key.length < 32 || !account.trim()}
          onClick={() =>
            void run(async () => {
              await load(0)
              setPage(0)
            })
          }
        >
          Load private records
        </Button>
        <Button
          disabled={busy || !connected}
          onClick={() =>
            void run(async () => {
              const result = await request<{ read_access: string }>('/account/check', { account })
              setMessage(
                'Pilot account read access: ' +
                  result.read_access +
                  '. This does not establish permission for every filing action.',
              )
            })
          }
        >
          Check pilot account access
        </Button>
        <Button
          onClick={() => {
            clearPrivate()
            setKey('')
            setAccount('')
          }}
        >
          Clear private session
        </Button>
      </Stack>
      {message && (
        <Alert severity="warning" role="status">
          {message}
        </Alert>
      )}
      {connected && (
        <>
          {planningInputs && (
            <Alert severity="info">
              A selected planning result supplied{' '}
              {Object.keys(planningInputs)
                .map((key) => fields.find((field) => field.key === key)?.label ?? key)
                .join(', ')}
              . Review the route and time; aircraft, equipment, fuel and pilot details remain unset.
              <Button
                disabled={busy || !!selected || dirty}
                onClick={() => {
                  setPlan(planningInputs)
                  setDirty(true)
                  setPlanningInputs(null)
                  resetReview()
                }}
              >
                Use selected planning inputs in a new draft
              </Button>
            </Alert>
          )}
          <Stack direction="row" flexWrap="wrap" gap={1}>
            <Button
              disabled={busy}
              onClick={() => {
                setSelected(null)
                setLinkedFiling(null)
                setPlan({})
                setDirty(false)
                setIssues({})
                resetReview()
              }}
            >
              New ICAO draft
            </Button>
            <Button
              disabled={busy || page === 0}
              onClick={() =>
                void run(async () => {
                  await load((page - 1) * PAGE)
                  setPage(page - 1)
                  setSelected(null)
                  setPlan({})
                  resetReview()
                })
              }
            >
              Previous records
            </Button>
            <Button
              disabled={busy || Math.max(drafts.length, filings.length, operations.length) < PAGE}
              onClick={() =>
                void run(async () => {
                  await load((page + 1) * PAGE)
                  setPage(page + 1)
                  setSelected(null)
                  setPlan({})
                  resetReview()
                })
              }
            >
              Next records
            </Button>
            <Typography>Records page {page + 1}</Typography>
          </Stack>
          <TextField
            select
            label="Saved draft"
            value={selected?.id ?? ''}
            disabled={busy}
            onChange={(event) => {
              const next = drafts.find((value) => value.id === event.target.value) ?? null
              setSelected(next)
              setLinkedFiling(null)
              setPlan(next?.plan ?? {})
              setDirty(false)
              setIssues({})
              resetReview()
              if (next)
                void run(async () => {
                  setLinkedFiling(await request<Filing | null>('/drafts/' + next.id + '/filing'))
                })
            }}
          >
            <MenuItem value="">New draft</MenuItem>
            {drafts
              .filter((value) => value.account === account)
              .map((value) => (
                <MenuItem key={value.id} value={value.id}>
                  {String(value.plan.aircraft_identifier ?? 'Incomplete draft')} ·{' '}
                  {String(value.plan.departure ?? '?')} → {String(value.plan.destination ?? '?')} ·
                  revision {value.revision}
                </MenuItem>
              ))}
          </TextField>
          <Box component="fieldset" disabled={busy} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
            <Stack spacing={2}>
              {fields.slice(0, 17).map(renderField)}
              <Box component="details">
                <Typography component="summary" sx={{ cursor: 'pointer', mb: 2 }}>
                  Optional ICAO and survival information
                </Typography>
                <Stack spacing={2}>{fields.slice(17).map(renderField)}</Stack>
              </Box>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={plan.people_unknown === true}
                    onChange={(event) => edit('people_unknown', event.target.checked)}
                  />
                }
                label="Persons on board to be notified (leave explicit persons field blank)"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={plan.covered_dinghies === true}
                    onChange={(event) => edit('covered_dinghies', event.target.checked)}
                  />
                }
                label="Dinghies covered"
              />
            </Stack>
          </Box>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            <Button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const result = await request<{
                    format_valid: boolean
                    issues: { field: string; message: string }[]
                  }>('/validate', plan)
                  setIssues(
                    Object.fromEntries(result.issues.map((value) => [value.field, value.message])),
                  )
                  setMessage(
                    result.format_valid
                      ? 'Format valid. Provider eligibility and briefing completeness remain unverified.'
                      : 'Resolve the highlighted filing fields.',
                  )
                })
              }
            >
              Validate ICAO fields
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const saved = await request<Draft>(
                    selected ? '/drafts/' + selected.id : '/drafts',
                    { account, plan, ...(selected ? { revision: selected.revision } : {}) },
                    selected ? 'PUT' : 'POST',
                  )
                  setSelected(saved)
                  setPlan(saved.plan)
                  setDirty(false)
                  resetReview()
                  await load()
                  setMessage('Draft saved. No provider filing was sent.')
                })
              }
            >
              Save private draft
            </Button>
            <Button
              disabled={busy || !selected || !!filing}
              onClick={() =>
                void run(async () => {
                  await request(
                    '/drafts/' + selected!.id + '?revision=' + selected!.revision,
                    undefined,
                    'DELETE',
                  )
                  setSelected(null)
                  setPlan({})
                  setDirty(false)
                  resetReview()
                  await load()
                })
              }
            >
              Delete draft
            </Button>
          </Stack>
          {filing && (
            <Alert severity="info">
              Provider identifier: {filing.provider_id}. Environment: {filing.environment}. Current
              state:{' '}
              {filing.snapshot?.currentState ??
                'refresh required; acknowledgement alone does not establish current state'}
              .
              <Button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await request('/filings/' + filing.id + '/refresh', {})
                    resetReview()
                    await load()
                  })
                }
              >
                Refresh provider state
              </Button>
            </Alert>
          )}
          <TextField
            select
            label="Flight Service action"
            value={action}
            disabled={busy}
            onChange={(event) => {
              setAction(event.target.value as Action)
              resetReview()
            }}
          >
            {(['file', 'amend', 'activate', 'cancel', 'close'] as const).map((value) => (
              <MenuItem key={value} value={value}>
                {value}
              </MenuItem>
            ))}
          </TextField>
          {action === 'activate' && (
            <TextField
              type="datetime-local"
              label="Actual departure (UTC)"
              InputLabelProps={{ shrink: true }}
              value={actualDeparture}
              disabled={busy}
              onChange={(event) => {
                setActualDeparture(event.target.value)
                resetReview()
              }}
            />
          )}
          {action === 'close' && (
            <TextField
              label="Closure destination information (required when overdue)"
              value={closeInfo}
              disabled={busy}
              onChange={(event) => {
                setCloseInfo(event.target.value)
                resetReview()
              }}
            />
          )}
          <Button
            variant="outlined"
            disabled={busy || !selected || dirty || !available}
            onClick={() =>
              void run(async () => {
                const prepared = await request<Review>('/actions/prepare', {
                  draft_id: selected!.id,
                  revision: selected!.revision,
                  action,
                  filing_id: action === 'file' ? null : (filing?.id ?? null),
                  inputs:
                    action === 'activate' && actualDeparture
                      ? { actual_departure: new Date(actualDeparture + 'Z').toISOString() }
                      : action === 'close' && closeInfo
                        ? { close_destination_info: closeInfo }
                        : {},
                })
                setReview(prepared)
                setConfirmed(false)
              })
            }
          >
            Review {action} action
          </Button>
          {dirty && <Typography>Save changes before reviewing a provider action.</Typography>}
          {review && (
            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h5" component="h2">
                    Confirm {review.action} in {review.environment}
                  </Typography>
                  <Typography>
                    Review expires {review.expires_at}. Current provider state:{' '}
                    {review.provider_state ?? 'not established'}.
                  </Typography>
                  {review.action === 'amend' && (
                    <Typography>
                      Only changed fields will be sent:{' '}
                      {(review.changed_fields ?? [])
                        .map((key) => fields.find((field) => field.key === key)?.label ?? key)
                        .join(', ')}
                      .
                    </Typography>
                  )}
                  {review.provider_fields.actualDepartureInstant && (
                    <Typography>
                      Actual departure (UTC): {review.provider_fields.actualDepartureInstant}
                    </Typography>
                  )}
                  {review.provider_fields.closeDestinationInfo && (
                    <Typography>
                      Closure destination: {review.provider_fields.closeDestinationInfo}
                    </Typography>
                  )}
                  <Typography>
                    Persons to be notified: {review.plan.people_unknown ? 'yes' : 'no'}. Dinghies
                    covered:{' '}
                    {review.plan.covered_dinghies == null
                      ? 'not specified'
                      : review.plan.covered_dinghies
                        ? 'yes'
                        : 'no'}
                    .
                  </Typography>
                  {fields
                    .filter(
                      (field) =>
                        review.plan[field.key] !== null && review.plan[field.key] !== undefined,
                    )
                    .map((field) => (
                      <Typography key={field.key} sx={{ whiteSpace: 'pre-wrap' }}>
                        {field.label}: {String(review.plan[field.key])}
                      </Typography>
                    ))}
                  {review.warnings.map((value) => (
                    <Alert key={value} severity="warning">
                      {value}
                    </Alert>
                  ))}
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={confirmed}
                        disabled={busy}
                        onChange={(event) => setConfirmed(event.target.checked)}
                      />
                    }
                    label={`I confirm this ${review.action} action in ${review.environment} using the exact reviewed information.`}
                  />
                  <Button
                    variant="contained"
                    disabled={!confirmed || busy}
                    onClick={() =>
                      void run(async () => {
                        const executing = review
                        resetReview()
                        const value = await request<Operation>('/actions/execute', {
                          confirmation_token: executing.confirmation_token,
                          idempotency_key: crypto.randomUUID(),
                          action: executing.action,
                          environment: executing.environment,
                        })
                        setReceipt(value)
                        setAudit([])
                        resetReview()
                        await load()
                      })
                    }
                  >
                    Confirm {review.action} in {review.environment}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          )}
          <Typography variant="h5" component="h2">
            Operation receipts
          </Typography>
          <Button disabled={busy} onClick={() => void run(() => load())}>
            Reload saved receipts
          </Button>
          {operations.map((value) => (
            <Button
              key={value.id}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  setReceipt(value)
                  setReference('')
                  setProviderId('')
                  setAttested(false)
                  setAudit(await request('/audit/' + value.id))
                })
              }
            >
              {value.action} · {value.environment} · {value.status} · {value.id}
            </Button>
          ))}
          {receipt && (
            <Stack spacing={2}>
              <Alert severity={receipt.status === 'unknown' ? 'warning' : 'info'}>
                Action: {receipt.action}. Environment: {receipt.environment}. Outcome:{' '}
                {receipt.status}.
              </Alert>
              {receipt.response?.returnMessage?.map((value, index) => (
                <Typography key={index}>{value}</Typography>
              ))}
              {receipt.response?.returnCodedMessage?.map((value, index) => (
                <Typography key={index}>
                  {value.code}: {value.message}
                </Typography>
              ))}
              {receipt.response?.local_error && (
                <Alert severity="warning">{receipt.response.local_error}</Alert>
              )}
              {receipt.response?.flightIdentifier && (
                <Typography>
                  Provider flight identifier: {receipt.response.flightIdentifier}
                </Typography>
              )}
              {receipt.response?.versionStamp && (
                <Typography>Provider version stamp: {receipt.response.versionStamp}</Typography>
              )}
              {receipt.response?.attestation && (
                <Typography>
                  Operator-attested resolution: {receipt.response.attestation.resolution}.
                  Reference: {receipt.response.attestation.reference}. This is distinct from a
                  provider action receipt.
                </Typography>
              )}
              {audit.map((value) => (
                <Typography key={value.sequence}>
                  {value.recorded_at} · {value.event}
                </Typography>
              ))}
              {receipt.status === 'unknown' && (
                <>
                  <Alert severity="warning">
                    The action may have reached Flight Service. Do not resend it. Check provider
                    records or contact Flight Service before recording an explicit resolution. An
                    empty account list cannot prove the action was not applied.
                  </Alert>
                  <TextField
                    select
                    label="Provider-confirmed resolution"
                    value={resolution}
                    disabled={busy}
                    onChange={(event) => {
                      setResolution(event.target.value)
                      setAttested(false)
                    }}
                  >
                    <MenuItem value="not_applied">Action was not applied</MenuItem>
                    <MenuItem value="applied">Action was applied</MenuItem>
                  </TextField>
                  <TextField
                    label="Provider-resolution reference"
                    value={reference}
                    disabled={busy}
                    onChange={(event) => {
                      setReference(event.target.value)
                      setAttested(false)
                    }}
                  />
                  {resolution === 'applied' && receipt.action === 'file' && (
                    <TextField
                      label="Matching provider flight identifier"
                      value={providerId}
                      disabled={busy}
                      onChange={(event) => {
                        setProviderId(event.target.value)
                        setAttested(false)
                      }}
                    />
                  )}
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={attested}
                        disabled={busy}
                        onChange={(event) => setAttested(event.target.checked)}
                      />
                    }
                    label="I verified this resolution with Flight Service and attest to the reference above."
                  />
                  <Button
                    disabled={busy || !attested || reference.trim().length < 8}
                    onClick={() =>
                      void run(async () => {
                        setReceipt(
                          await request('/operations/' + receipt.id + '/reconcile', {
                            resolution,
                            reference,
                            operator_attestation: true,
                            provider_id:
                              resolution === 'applied' && receipt.action === 'file'
                                ? providerId
                                : null,
                          }),
                        )
                        setAttested(false)
                        await load()
                      })
                    }
                  >
                    Record verified resolution
                  </Button>
                </>
              )}
            </Stack>
          )}
        </>
      )}
    </Stack>
  )
}
