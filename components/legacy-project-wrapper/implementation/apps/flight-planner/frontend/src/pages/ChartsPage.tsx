import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ChartMap from '../components/ChartMap'

type Member = { name: string; sha256: string; format: string }
type Chart = {
  id: string
  name: string
  family: string
  kind: string
  format: string
  url: string
  airport: string | null
  source: string
  cycle: string
  effective_from: string | null
  effective_to: string | null
  freshness: string
  edition_freshness: string
  verification_state: string
  source_checked_at: string | null
  cached: { sha256: string; at: string; members: Member[] } | null
}
type Catalog = {
  charts: Chart[]
  total: number
  page: number
  limit: number
  source_status: Record<
    string,
    {
      status: string
      at?: string
      error?: string
      verification_state?: string
      source_checked_at?: string | null
    }
  >
}
type Info = Member & { pages?: number; bounds_wgs84?: number[]; crs?: string; limitation?: string }
type Procedure = {
  record: {
    identifier: string
    procedure_type: string
    transitions: string[]
    legs: {
      fix: string
      path_type: string | null
      altitude_ft: number | null
      altitude_constraint: string | null
      course_deg: number | null
    }[]
  }
  provider: {
    id: string
    route_type: string
    omitted_from_common_legs: number
    records: { raw: string; fields: Record<string, string> }[]
  }
}
type Nav = {
  airport: string
  procedures: Procedure[]
  total: number
  page: number
  limit: number
  source: {
    cycle: string
    effective_from: string
    effective_to: string
    url: string
    archive_sha256: string
  }
  limitations: string
  parse_receipt: { rejected: unknown[] }
}
const base = '/api/charts'

export default function ChartsPage() {
  const [airport, setAirport] = useState(() => {
    const supplied = new URLSearchParams(window.location.search).get('airport')
    return supplied === null
      ? 'KSFO'
      : /^[A-Za-z0-9]{3,4}$/.test(supplied)
        ? supplied.toUpperCase()
        : ''
  })
  const [query, setQuery] = useState('')
  const [family, setFamily] = useState('terminal')
  const [freshness, setFreshness] = useState('current')
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [chart, setChart] = useState<Chart | null>(null)
  const [member, setMember] = useState(0)
  const [info, setInfo] = useState<Info | null>(null)
  const [pdfPage, setPdfPage] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [key, setKey] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [nav, setNav] = useState<Nav | null>(null)
  const generation = useRef(0)
  const controllers = useRef(new Set<AbortController>())
  useEffect(() => {
    const active = controllers.current
    generation.current++
    active.forEach((c) => c.abort())
    setCatalog(null)
    setChart(null)
    setInfo(null)
    setNav(null)
    return () => {
      active.forEach((c) => c.abort())
      active.clear()
    }
  }, [airport, query, family, freshness])

  async function request<T>(path: string, body?: unknown): Promise<T> {
    const controller = new AbortController()
    controllers.current.add(controller)
    try {
      const response = await fetch(path, {
        signal: controller.signal,
        ...(body !== undefined
          ? {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
              body: JSON.stringify(body),
            }
          : {}),
      })
      if (!response.ok) {
        const value = await response.json()
        throw new Error(
          typeof value.detail === 'string'
            ? value.detail
            : `Chart request failed (${response.status})`,
        )
      }
      return (await response.json()) as T
    } finally {
      controllers.current.delete(controller)
    }
  }
  async function action(fn: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError'))
        setError(e instanceof Error ? e.message : 'Chart request failed')
    } finally {
      setBusy(false)
    }
  }
  async function load(page = 1) {
    const current = generation.current
    const params = new URLSearchParams({
      query,
      page: String(page),
      limit: '30',
      ...(family ? { family } : {}),
      ...(freshness ? { freshness } : {}),
      ...(family === 'terminal' && airport ? { airport } : {}),
    })
    const result = await request<Catalog>(base + '/catalog?' + params)
    if (current === generation.current) setCatalog(result)
  }
  async function open(value: Chart, index = 0) {
    generation.current++
    controllers.current.forEach((c) => c.abort())
    const current = generation.current
    setChart(value)
    setMember(index)
    setInfo(null)
    setPdfPage(1)
    setZoom(1)
    if (value.cached) {
      const result = await request<Info>(
        `${base}/${value.id}/members/${index}/info?sha256=${value.cached.members[index].sha256}`,
      )
      if (current === generation.current) setInfo(result)
    }
  }
  async function navigation(page = 1) {
    const current = generation.current
    const result = await request<Nav>(
      `/api/navigation/${encodeURIComponent(airport)}?page=${page}&limit=20`,
    )
    if (current === generation.current) setNav(result)
  }

  return (
    <Stack spacing={3} sx={{ overflowWrap: 'anywhere' }}>
      <Box>
        <Typography component="h2" variant="h4">
          Charts and navigation
        </Typography>
        <Typography>
          FAA terminal procedures, airport diagrams, sectional/enroute charts and real CIFP records.
        </Typography>
        <Button
          component="a"
          href={`https://g1000-simulator.jordanhubbard.net/procedures${/^[A-Z0-9]{3,4}$/.test(airport.trim()) ? '?airport=' + encodeURIComponent(airport.trim()) : ''}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open G1000 procedure browser
        </Button>
      </Box>
      <Alert severity="info">
        Check the source, effective dates and FAA chart notices. This suite is for reference and
        simulation. Raw navigation records do not constitute certified avionics guidance.
      </Alert>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="Chart family"
          select
          value={family}
          disabled={busy}
          onChange={(e) => setFamily(e.target.value)}
        >
          {[
            ['terminal', 'Terminal / airport diagrams'],
            ['vfr', 'VFR sectional / visual'],
            ['ifr', 'IFR enroute'],
            ['', 'All families'],
          ].map(([v, label]) => (
            <MenuItem key={v} value={v}>
              {label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Airport identifier"
          value={airport}
          disabled={busy}
          onChange={(e) => setAirport(e.target.value.toUpperCase())}
          helperText="ICAO or published FAA identifier; terminal charts and navigation"
          inputProps={{ maxLength: 4 }}
        />
        <TextField
          label="Chart name"
          value={query}
          disabled={busy}
          onChange={(e) => setQuery(e.target.value)}
        />
        <TextField
          label="Chart status"
          select
          value={freshness}
          disabled={busy}
          onChange={(e) => setFreshness(e.target.value)}
        >
          {[
            'current',
            'future',
            'expired',
            'undated',
            'withdrawn',
            'cached-unverified',
            'source-unavailable',
            '',
          ].map((v) => (
            <MenuItem key={v} value={v}>
              {v || 'All editions'}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      <Stack direction="row" gap={1} flexWrap="wrap">
        <Button variant="contained" disabled={busy} onClick={() => void action(() => load())}>
          Find charts
        </Button>
        <Button disabled={busy || !airport} onClick={() => void action(() => navigation())}>
          Browse current navigation records
        </Button>
        <Button
          href="https://www.faa.gov/air_traffic/flight_info/aeronav/safety_alerts/"
          target="_blank"
          rel="noreferrer"
        >
          FAA chart notices
        </Button>
      </Stack>
      {busy && <Typography role="status">Loading source data…</Typography>}
      {error && <Alert severity="error">{error}</Alert>}
      <details>
        <summary>Manage source catalog and downloaded copies</summary>
        <Stack spacing={2} sx={{ mt: 2 }}>
          <Typography>
            Catalog synchronization and large downloads require the operator key. The key remains in
            this page’s memory. Cached FAA charts are public reference data.
          </Typography>
          <TextField
            label="Chart operator key"
            type="password"
            autoComplete="off"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <Button
            disabled={busy || !key}
            onClick={() =>
              void action(async () => {
                const result = await request<{ partial: boolean }>(base + '/refresh', {})
                if (result.partial)
                  setError(
                    'Some FAA sources failed. Previous copies remain available; inspect source status.',
                  )
                await load()
              })
            }
          >
            Refresh FAA catalogs
          </Button>
        </Stack>
      </details>
      {chart && (
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h5" component="h3">
                {chart.name}
              </Typography>
              <Typography>
                {chart.source} · cycle {chart.cycle} · {chart.freshness}
              </Typography>
              <Typography variant="body2">
                Edition: {chart.edition_freshness} · Catalog: {chart.verification_state} · Checked{' '}
                {chart.source_checked_at || 'unknown'}
              </Typography>
              <Typography>
                Effective {chart.effective_from || 'unknown'} → {chart.effective_to || 'unknown'}{' '}
                UTC
              </Typography>
              {!chart.cached ? (
                <Alert severity="info">
                  This original is not cached. Open the FAA original or download it using the
                  operator key to enable previews and offline handoff.
                </Alert>
              ) : (
                <>
                  <Typography variant="body2">
                    Acquired {chart.cached.at} · SHA-256 {chart.cached.sha256}
                  </Typography>
                  <Button component="a" href={`${base}/${chart.id}/original`}>
                    Download unmodified original
                  </Button>
                  <TextField
                    label="Chart file"
                    select
                    value={member}
                    onChange={(e) => void action(() => open(chart, Number(e.target.value)))}
                  >
                    {chart.cached.members.map((m, i) => (
                      <MenuItem key={m.sha256} value={i}>
                        {m.name}
                      </MenuItem>
                    ))}
                  </TextField>
                  {info?.format === 'pdf' && (
                    <>
                      <Stack direction="row" gap={1} flexWrap="wrap">
                        <Button disabled={pdfPage <= 1} onClick={() => setPdfPage((p) => p - 1)}>
                          Previous PDF page
                        </Button>
                        <Typography>
                          PDF page {pdfPage} / {info.pages}
                        </Typography>
                        <Button
                          disabled={pdfPage >= (info.pages || 1)}
                          onClick={() => setPdfPage((p) => p + 1)}
                        >
                          Next PDF page
                        </Button>
                        <Button disabled={zoom <= 1} onClick={() => setZoom((z) => z - 0.5)}>
                          Zoom out
                        </Button>
                        <Button disabled={zoom >= 4} onClick={() => setZoom((z) => z + 0.5)}>
                          Zoom in
                        </Button>
                      </Stack>
                      <Box sx={{ overflow: 'auto', maxHeight: '75vh', width: '100%' }}>
                        <img
                          alt={`${chart.name}, PDF page ${pdfPage}`}
                          src={`${base}/${chart.id}/members/${member}/preview/${pdfPage}.png?sha256=${info.sha256}`}
                          style={{ width: `${zoom * 100}%`, maxWidth: 'none', display: 'block' }}
                          onError={() =>
                            setError('Chart preview failed; the original is retained.')
                          }
                        />
                      </Box>
                    </>
                  )}
                  {info?.format === 'geotiff' && info.bounds_wgs84 && (
                    <>
                      <Typography>{info.limitation}</Typography>
                      <details>
                        <summary>Coordinate reference system</summary>
                        <Typography variant="body2">{info.crs}</Typography>
                      </details>
                      <ChartMap
                        key={info.sha256}
                        bounds={info.bounds_wgs84}
                        url={`${base}/${chart.id}/members/${member}/tiles/{z}/{x}/{y}.png?sha256=${info.sha256}`}
                      />
                    </>
                  )}
                  <Button
                    disabled={busy || !key}
                    onClick={() =>
                      void action(async () => {
                        const updated = await request<Chart>(`${base}/${chart.id}/download`, {
                          force: true,
                        })
                        await open(updated)
                      })
                    }
                  >
                    Fetch a fresh source copy
                  </Button>
                </>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}
      {nav && (
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h5" component="h3">
                {nav.airport} navigation · cycle {nav.source.cycle}
              </Typography>
              <Typography>
                {nav.source.effective_from} → {nav.source.effective_to} UTC
              </Typography>
              <Alert severity="info">{nav.limitations}</Alert>
              {!!nav.parse_receipt.rejected.length && (
                <Alert severity="warning">
                  Some source records could not be normalized; original records remain retained.
                </Alert>
              )}
              <Typography>
                {nav.total} procedure/transition groups · page {nav.page}
              </Typography>
              {nav.procedures.map((p) => (
                <Box key={p.provider.id}>
                  <Typography variant="h6">
                    {p.record.identifier} · {p.record.procedure_type} ·{' '}
                    {p.record.transitions.join(', ') || 'common route'}
                  </Typography>
                  {p.provider.omitted_from_common_legs > 0 && (
                    <Alert severity="warning">
                      {p.provider.omitted_from_common_legs} special legs are available in the source
                      fields below.
                    </Alert>
                  )}
                  {p.record.legs.map((l, i) => (
                    <Typography variant="body2" key={i}>
                      {l.fix} · {l.path_type || 'path unknown'} · altitude{' '}
                      {l.altitude_constraint || 'unknown'} · course{' '}
                      {l.course_deg == null ? 'unknown' : `${l.course_deg}° magnetic`}
                    </Typography>
                  ))}
                  <details>
                    <summary>Original ARINC records and fields</summary>
                    <Box component="pre" sx={{ overflow: 'auto', maxHeight: 500, fontSize: 12 }}>
                      {JSON.stringify(p.provider.records, null, 2)}
                    </Box>
                  </details>
                </Box>
              ))}
              <Stack direction="row" spacing={2}>
                <Button
                  disabled={busy || nav.page <= 1}
                  onClick={() => void action(() => navigation(nav.page - 1))}
                >
                  Previous procedures
                </Button>
                <Button
                  disabled={busy || nav.page * nav.limit >= nav.total}
                  onClick={() => void action(() => navigation(nav.page + 1))}
                >
                  Next procedures
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}
      {catalog && (
        <>
          {Object.entries(catalog.source_status).map(([name, state]) =>
            state.status !== 'available' || state.verification_state !== 'verified' ? (
              <Alert key={name} severity="warning">
                {name}: {state.verification_state || state.status}. {state.error} Previous copies
                have not been revalidated.
              </Alert>
            ) : null,
          )}
          {!Object.keys(catalog.source_status).length && (
            <Alert severity="info">
              The source catalog has not been downloaded. An operator can refresh the FAA catalogs
              above.
            </Alert>
          )}
          <Typography>
            {catalog.total} matching charts · page {catalog.page}
          </Typography>
          <Stack spacing={1}>
            {catalog.charts.map((c) => (
              <Card key={c.id}>
                <CardContent>
                  <Stack spacing={1}>
                    <Typography variant="h6">{c.name}</Typography>
                    <Typography>
                      {c.airport || c.family} · {c.kind} · {c.format} · cycle {c.cycle}
                    </Typography>
                    <Typography variant="body2">
                      Effective {c.effective_from || 'unknown'} → {c.effective_to || 'unknown'} UTC
                    </Typography>
                    <Box>
                      <Typography variant="caption" component="p">
                        Edition: {c.edition_freshness} · Catalog: {c.verification_state} · Checked{' '}
                        {c.source_checked_at || 'unknown'}
                      </Typography>
                      <Chip
                        label={c.freshness}
                        color={c.freshness === 'current' ? 'success' : 'warning'}
                        size="small"
                      />
                    </Box>
                    <Stack direction="row" gap={1} flexWrap="wrap">
                      <Button disabled={busy} onClick={() => void action(() => open(c))}>
                        View chart details
                      </Button>
                      <Button href={c.url} target="_blank" rel="noreferrer">
                        FAA original
                      </Button>
                      <Button
                        disabled={busy || !key || c.freshness === 'withdrawn'}
                        onClick={() =>
                          void action(async () => {
                            const updated = await request<Chart>(`${base}/${c.id}/download`, {
                              force: false,
                            })
                            await open(updated)
                            await load(catalog.page)
                          })
                        }
                      >
                        Download for viewing / offline
                      </Button>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
          <Stack direction="row" spacing={2}>
            <Button
              disabled={busy || catalog.page <= 1}
              onClick={() => void action(() => load(catalog.page - 1))}
            >
              Previous charts
            </Button>
            <Button
              disabled={busy || catalog.page * catalog.limit >= catalog.total}
              onClick={() => void action(() => load(catalog.page + 1))}
            >
              Next charts
            </Button>
          </Stack>
        </>
      )}
    </Stack>
  )
}
