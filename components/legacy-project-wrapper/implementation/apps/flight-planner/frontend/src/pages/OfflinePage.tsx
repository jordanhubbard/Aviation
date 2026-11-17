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
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import {
  deletePackage,
  installPackage,
  listPackages,
  openPackage,
  packageBlob,
  validateManifest,
  type Asset,
  type ChartPackage,
  type Manifest,
  type StoredPackage,
} from '../offline/packages'
import { ensureOfflineShell } from '../offline/shell'

type CatalogChart = {
  id: string
  name: string
  cycle: string
  cached: { members: { name: string; sha256: string; format: string }[] } | null
}
type Choice = {
  chart_id: string
  member: number
  sha256: string
  coverage: 'full-chart' | 'route-area'
  zoom: number
  pdf_pages?: number[]
}
const size = (bytes: number) => `${(bytes / 1024 ** 2).toFixed(2)} MiB`
const stamp = (value: string | null) => (value ? new Date(value).toUTCString() : 'Unknown')
async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'omit', cache: 'no-store', ...init })
  const data = await response.json()
  if (!response.ok)
    throw new Error(
      typeof data.detail === 'string' ? data.detail : `Request failed (HTTP ${response.status})`,
    )
  return data as T
}
function RouteSketch({ route }: { route: Manifest['route'] }) {
  const supplied = route.points as number[][] | undefined
  const waypoints = route.waypoints as
    { latitude: number; longitude: number; name: string }[] | undefined
  const points = supplied ?? waypoints?.map((w) => [w.latitude, w.longitude]) ?? []
  if (points.length < 2) return null
  const longitudes: number[] = []
  points.forEach((p, i) => {
    let longitude = p[1]
    if (i) {
      while (longitude - longitudes[i - 1] > 180) longitude -= 360
      while (longitude - longitudes[i - 1] < -180) longitude += 360
    }
    longitudes.push(longitude)
  })
  const west = Math.min(...longitudes),
    east = Math.max(...longitudes),
    south = Math.min(...points.map((p) => p[0])),
    north = Math.max(...points.map((p) => p[0]))
  const xy = points.map(
    (p, i) =>
      `${20 + ((longitudes[i] - west) / (east - west || 1)) * 560},${180 - ((p[0] - south) / (north - south || 1)) * 160}`,
  )
  return (
    <Box>
      <Typography variant="body2">Route schematic — no terrain or navigation guidance</Typography>
      <svg
        viewBox="0 0 600 210"
        role="img"
        aria-label="Saved route schematic"
        style={{ width: '100%', maxHeight: 240 }}
      >
        <polyline points={xy.join(' ')} fill="none" stroke="#1976d2" strokeWidth="3" />
        {xy.map((p, i) => {
          const [x, y] = p.split(',')
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="5" fill="#1976d2" />
              <text x={x} y={Number(y) + 18} fontSize="12" textAnchor="middle">
                {(route.airports as string[] | undefined)?.[i] ?? waypoints?.[i]?.name ?? i + 1}
              </text>
            </g>
          )
        })}
      </svg>
    </Box>
  )
}
type SourceProduct = {
  status: string
  reports: {
    rawTAF?: string
    rawOb?: string
    issueTime?: number | string
    obsTime?: number | string
    validTimeFrom?: number
    validTimeTo?: number
  }[]
  source?: { retrieved_at_utc?: string; provider?: string }
  error?: string
}
type WeatherSnapshot = {
  status?: string
  error?: string
  stations?: { station_id: string; taf?: SourceProduct; metar?: SourceProduct }[]
}
function JsonSnapshot({ manifest, asset }: { manifest: Manifest; asset: Asset }) {
  const [text, setText] = useState(''),
    [error, setError] = useState('')
  useEffect(() => {
    let current = true
    void packageBlob(manifest.id, asset)
      .then((b) => b.text())
      .then((t) => {
        if (current) setText(t)
      })
      .catch((e) => {
        if (current) setError(String(e))
      })
    return () => {
      current = false
    }
  }, [manifest.id, asset])
  if (error) return <Alert severity="error">{error}</Alert>
  if (!text) return <Typography>Loading verified snapshot…</Typography>
  const data = JSON.parse(text)
  const details = (
    <details>
      <summary>Retained source details</summary>
      <Box
        component="pre"
        sx={{
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          fontSize: 12,
          maxHeight: 500,
          overflow: 'auto',
        }}
      >
        {JSON.stringify(data, null, 2)}
      </Box>
    </details>
  )
  if (asset.role === 'weather') {
    const weather = data as WeatherSnapshot
    return (
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={1}>
            <Typography variant="h6">Saved TAF / METAR briefing</Typography>
            <Typography variant="body2">
              Captured {stamp(asset.retrieved_at)}. Original UTC times remain in each report.
            </Typography>
            {weather.status === 'unavailable' && (
              <Alert severity="warning">Weather unavailable: {weather.error}</Alert>
            )}
            {!weather.stations?.length && (
              <Alert severity="warning">
                No reporting stations retained. This does not establish safe conditions.
              </Alert>
            )}
            {weather.stations?.map((station) => (
              <Box key={station.station_id}>
                <Typography variant="subtitle1">{station.station_id}</Typography>
                {(['metar', 'taf'] as const).map((product) => {
                  const value = station[product]
                  return (
                    <Box key={product}>
                      <Typography variant="subtitle2">
                        {product.toUpperCase()} ·{' '}
                        {value?.status === 'no_reports'
                          ? 'No reports'
                          : value?.status === 'available'
                            ? 'Available'
                            : value?.status === 'unavailable'
                              ? 'Unavailable'
                              : 'Not included'}
                      </Typography>
                      {value?.source?.retrieved_at_utc && (
                        <Typography variant="caption">
                          Source retrieved {stamp(value.source.retrieved_at_utc)}
                        </Typography>
                      )}
                      {value?.error && <Typography>{value.error}</Typography>}
                      {value?.reports.map((report, i) => (
                        <Box
                          component="pre"
                          key={i}
                          sx={{
                            whiteSpace: 'pre-wrap',
                            overflowWrap: 'anywhere',
                            fontFamily: 'monospace',
                          }}
                        >
                          {report.rawTAF ??
                            report.rawOb ??
                            'Raw report text unavailable; inspect retained source details.'}
                        </Box>
                      ))}
                    </Box>
                  )
                })}
              </Box>
            ))}
            {details}
          </Stack>
        </CardContent>
      </Card>
    )
  }
  if (asset.role === 'airports')
    return (
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6">Saved airport references</Typography>
          {(data.airports as Record<string, unknown>[]).map((airport, i) => (
            <Typography key={i}>
              {String(airport.icao ?? airport.code ?? airport.ident ?? '')} ·{' '}
              {String(airport.name ?? '')} · {String(airport.latitude)}°,{' '}
              {String(airport.longitude)}°
            </Typography>
          ))}
          <Typography variant="body2">
            {String(data.source)}. Captured {stamp(asset.retrieved_at)}.
          </Typography>
          {details}
        </CardContent>
      </Card>
    )
  if (data.metadata)
    return (
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={1}>
            <Typography variant="h6">Saved flight plan: {String(data.metadata.name)}</Typography>
            {data.metadata.description && (
              <Typography>{String(data.metadata.description)}</Typography>
            )}
            {data.metadata.aircraft_type && (
              <Typography>Aircraft: {String(data.metadata.aircraft_type)}</Typography>
            )}
            {data.metadata.pilot_name && (
              <Typography>Pilot: {String(data.metadata.pilot_name)}</Typography>
            )}
            {data.notes && (
              <Box component="p" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {String(data.notes)}
              </Box>
            )}
            {details}
          </Stack>
        </CardContent>
      </Card>
    )
  return (
    <Box>
      <Typography variant="h6">Saved route</Typography>
      {details}
    </Box>
  )
}
function ChartView({ manifest, chart }: { manifest: Manifest; chart: ChartPackage }) {
  const [urls, setUrls] = useState<Record<string, string>>({}),
    [error, setError] = useState(''),
    [page, setPage] = useState(0)
  const previews = manifest.assets.filter(
    (a) =>
      a.chart_id === chart.chart_id &&
      a.source_sha256 === chart.source_sha256 &&
      (a.role === 'chart_preview' || a.role === 'chart_tile'),
  )
  const original = manifest.assets.find(
    (a) =>
      a.chart_id === chart.chart_id &&
      a.source_sha256 === chart.source_sha256 &&
      a.role === 'chart_original',
  )
  useEffect(() => {
    let current = true
    const created: string[] = []
    setUrls({})
    setError('')
    setPage(0)
    void (async () => {
      const values: Record<string, string> = {}
      for (const asset of manifest.assets.filter(
        (a) => a.chart_id === chart.chart_id && a.source_sha256 === chart.source_sha256,
      )) {
        const blob = await packageBlob(manifest.id, asset)
        if (!current) return
        const url = URL.createObjectURL(blob)
        created.push(url)
        values[asset.id] = url
      }
      if (current) setUrls(values)
    })().catch((e) => {
      if (current) setError(String(e))
    })
    return () => {
      current = false
      created.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [manifest, chart])
  const expired = chart.effective_until !== null && Date.now() >= Date.parse(chart.effective_until)
  const future = chart.effective_from !== null && Date.now() < Date.parse(chart.effective_from)
  const xs = previews.map((a) => a.x ?? 0),
    ys = previews.map((a) => a.y ?? 0)
  const left = Math.min(...xs),
    top = Math.min(...ys),
    columns = Math.max(...xs) - left + 1,
    rows = Math.max(...ys) - top + 1
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1}>
          <Typography variant="h6">
            {chart.name}
            {original ? ` · ${original.label}` : ''} · cycle {chart.cycle}
          </Typography>
          <Typography variant="body2">
            Effective {stamp(chart.effective_from)} through {stamp(chart.effective_until)}{' '}
            (exclusive). Catalog checked {stamp(chart.source_checked_at)}.
          </Typography>
          {(expired ||
            future ||
            !chart.effective_until ||
            chart.verification_state !== 'verified' ||
            !chart.source_checked_at ||
            Date.now() - Date.parse(chart.source_checked_at) > 86400000) && (
            <Alert severity="warning">
              {expired
                ? 'Expired chart.'
                : future
                  ? 'Chart is not yet effective.'
                  : 'Chart currency needs verification.'}{' '}
              Saved catalog status: {chart.verification_state}. Offline opening does not recheck the
              source.
            </Alert>
          )}
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
            Source SHA-256: {chart.source_sha256}
          </Typography>
          {original && urls[original.id] && (
            <Button component="a" href={urls[original.id]} download={original.label}>
              Download saved original
            </Button>
          )}
          {error && <Alert severity="error">{error}</Alert>}
          {!Object.keys(urls).length && !error && <Typography>Loading saved chart…</Typography>}
          {chart.coverage === 'pdf-pages' ? (
            <>
              <Stack direction="row" spacing={1} alignItems="center">
                <Button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  Previous page
                </Button>
                <Typography>
                  Saved page {previews[page]?.page} ({page + 1} of {previews.length})
                </Typography>
                <Button
                  disabled={page >= previews.length - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next page
                </Button>
              </Stack>
              {previews[page] && urls[previews[page].id] && (
                <Box
                  component="img"
                  src={urls[previews[page].id]}
                  alt={`${chart.name}, saved page ${previews[page].page}`}
                  sx={{ width: '100%', height: 'auto' }}
                />
              )}
              <Typography variant="body2">
                Included pages: {chart.pages?.join(', ')}. Other pages are unavailable offline
                unless included in a new package.
              </Typography>
            </>
          ) : (
            <>
              <Typography variant="body2">
                {chart.coverage} · zoom {chart.zoom} · {chart.tile_count} tiles · bounds
                west/south/east/north: {chart.bounds_wgs84?.map((n) => n.toFixed(4)).join(', ')}.
                Tile grid extent: {chart.tile_bounds_wgs84?.map((n) => n.toFixed(4)).join(', ')}
              </Typography>
              <Box
                role="img"
                aria-label={`${chart.name}, saved georeferenced chart tiles`}
                sx={{
                  width: '100%',
                  position: 'relative',
                  aspectRatio: `${columns} / ${rows}`,
                  background: '#ddd',
                }}
              >
                {previews.map(
                  (a) =>
                    urls[a.id] && (
                      <img
                        key={a.id}
                        src={urls[a.id]}
                        alt=""
                        style={{
                          position: 'absolute',
                          left: `${(((a.x ?? 0) - left) / columns) * 100}%`,
                          top: `${(((a.y ?? 0) - top) / rows) * 100}%`,
                          width: `${100 / columns}%`,
                          height: `${100 / rows}%`,
                        }}
                      />
                    ),
                )}
              </Box>
              <Alert severity="info">
                Tiles outside the saved coverage and zoom are unavailable offline.{' '}
                {chart.limitations}
              </Alert>
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
}
export default function OfflinePage() {
  const query = new URLSearchParams(window.location.search)
  const [online, setOnline] = useState(navigator.onLine),
    [name, setName] = useState('Flight package'),
    [route, setRoute] = useState(query.get('route')?.replace(/,/g, ' ') ?? 'KSFO KSQL')
  const [savedPlans, setSavedPlans] = useState<{ id: string; name: string }[]>([]),
    [planId, setPlanId] = useState('')
  const [catalogQuery, setCatalogQuery] = useState('KSFO'),
    [catalog, setCatalog] = useState<CatalogChart[]>([]),
    [choices, setChoices] = useState<Choice[]>([])
  const [revisionOf, setRevisionOf] = useState<string | null>(null),
    [pageInputs, setPageInputs] = useState<Record<string, string>>({}),
    [formOpen, setFormOpen] = useState(navigator.onLine)
  const [prepared, setPrepared] = useState<Manifest | null>(null),
    [packages, setPackages] = useState<StoredPackage[]>([]),
    [opened, setOpened] = useState<Manifest | null>(null)
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [progress, setProgress] = useState({ done: 0, total: 0, label: '' }),
    [estimate, setEstimate] = useState('')
  const controller = useRef<AbortController | null>(null)
  const refresh = useCallback(async () => {
    setPackages(await listPackages())
    const e = await navigator.storage?.estimate()
    if (e?.quota !== undefined)
      setEstimate(`${size(e.usage ?? 0)} used of browser quota ${size(e.quota)}`)
  }, [])
  const showProgress = (done: number, total: number, label: string) =>
    setProgress({ done, total, label })
  const work = useCallback(async (operation: () => Promise<void>) => {
    setBusy(true)
    setError('')
    setProgress({ done: 0, total: 0, label: '' })
    try {
      await operation()
    } catch (e) {
      setError(
        e instanceof DOMException && e.name === 'AbortError'
          ? 'Download cancelled. Previous packages are unchanged.'
          : e instanceof Error
            ? e.message
            : String(e),
      )
    } finally {
      controller.current = null
      setBusy(false)
    }
  }, [])
  useEffect(() => {
    const changed = () => setOnline(navigator.onLine)
    window.addEventListener('online', changed)
    window.addEventListener('offline', changed)
    void refresh().catch((e) => setError(String(e)))
    return () => {
      window.removeEventListener('online', changed)
      window.removeEventListener('offline', changed)
      controller.current?.abort()
    }
  }, [refresh])
  const prepare = () =>
    work(async () => {
      setPrepared(null)
      const manifest = await json<Manifest>('/api/offline/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          ...(planId
            ? { saved_plan_id: planId }
            : {
                airports: route
                  .trim()
                  .toUpperCase()
                  .split(/[\s,]+/),
              }),
          charts: choices.map((c) => ({
            ...c,
            ...(pageInputs[`${c.chart_id}/${c.member}`]?.trim()
              ? {
                  pdf_pages: pageInputs[`${c.chart_id}/${c.member}`]
                    .split(',')
                    .map((s) => Number(s.trim())),
                }
              : {}),
          })),
          revision_of: revisionOf,
        }),
      })
      setPrepared(validateManifest(manifest))
    })
  const download = () =>
    work(async () => {
      if (!prepared) return
      controller.current = new AbortController()
      await ensureOfflineShell()
      await installPackage(prepared, controller.current.signal, showProgress)
      setPrepared(null)
      setFormOpen(false)
      await refresh()
    })
  const open = (id: string) =>
    work(async () => {
      setOpened(null)
      setOpened(await openPackage(id, showProgress))
    })
  const selection = (c: CatalogChart, member: number) =>
    choices.find((s) => s.chart_id === c.id && s.member === member)
  return (
    <Stack spacing={2} sx={{ minWidth: 0 }}>
      <Typography variant="h4">Offline flight packages</Typography>
      <Chip
        label={online ? 'Online' : 'Offline — saved material only'}
        color={online ? 'success' : 'warning'}
        sx={{ alignSelf: 'flex-start' }}
      />
      <Alert severity="info">
        Packages stay in this browser. Browser data clearing or eviction can remove them. Check the
        saved package before departure; charts and weather continue to age offline. Private aircraft
        documents and credentials are excluded.
      </Alert>
      {error && (
        <Alert severity="error" role="alert">
          {error}
        </Alert>
      )}
      {busy && (
        <Box>
          <LinearProgress
            variant={progress.total ? 'determinate' : 'indeterminate'}
            value={progress.total ? (progress.done / progress.total) * 100 : 0}
          />
          <Typography role="status">
            {progress.label || 'Preparing package…'}{' '}
            {progress.total ? `${size(progress.done)} / ${size(progress.total)}` : ''}
          </Typography>
          <Button onClick={() => controller.current?.abort()} disabled={!controller.current}>
            Cancel download
          </Button>
        </Box>
      )}
      <details
        id="offline-preparation"
        open={formOpen}
        onToggle={(e) => setFormOpen(e.currentTarget.open)}
      >
        <summary>Prepare or update a flight package (online)</summary>
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">Prepare a new package</Typography>
              <TextField
                label="Package name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setPrepared(null)
                }}
                inputProps={{ maxLength: 100 }}
                disabled={busy}
              />
              <Button
                disabled={busy || !online}
                onClick={() => void work(async () => setSavedPlans(await json('/flight-plans/')))}
              >
                Load saved routes
              </Button>
              {savedPlans.length > 0 && (
                <TextField
                  select
                  label="Saved route"
                  helperText="The selected plan’s metadata and notes are included in this browser’s package."
                  value={planId}
                  onChange={(e) => {
                    setPlanId(e.target.value)
                    setPrepared(null)
                  }}
                >
                  <MenuItem value="">Use airport route below</MenuItem>
                  {savedPlans.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
              <TextField
                label="Route airport codes"
                helperText="2–20 airport codes in route order, separated by spaces"
                value={route}
                disabled={!!planId || busy}
                onChange={(e) => {
                  setRoute(e.target.value)
                  setPrepared(null)
                }}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <TextField
                  label="Find acquired charts"
                  value={catalogQuery}
                  onChange={(e) => setCatalogQuery(e.target.value)}
                />
                <Button
                  disabled={busy || !online}
                  onClick={() =>
                    void work(async () => {
                      const result = await json<{ charts: CatalogChart[] }>(
                        `/api/charts/catalog?${/^[A-Za-z0-9]{3,4}$/.test(catalogQuery.trim()) ? 'airport' : 'query'}=${encodeURIComponent(catalogQuery.trim())}&limit=100`,
                      )
                      setCatalog(result.charts.filter((c) => c.cached))
                    })
                  }
                >
                  Find downloaded charts
                </Button>
                <Button href="/charts" disabled={!online}>
                  Acquire charts
                </Button>
              </Stack>
              <Typography variant="body2">
                Only charts already acquired by the chart service can be packaged. Up to four
                members, 128 PDF preview pages and 512 map tiles. No charts selected means a
                route/airport/weather package only.
              </Typography>
              {catalog.map((c) =>
                c.cached?.members.map((member, i) => {
                  const picked = selection(c, i)
                  return (
                    <Box key={`${c.id}/${i}`} sx={{ borderBottom: '1px solid #ddd', pb: 1 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={!!picked}
                            disabled={busy || (!picked && choices.length >= 4)}
                            onChange={(e) => {
                              setChoices((v) =>
                                e.target.checked
                                  ? [
                                      ...v,
                                      {
                                        chart_id: c.id,
                                        member: i,
                                        sha256: member.sha256,
                                        coverage: 'full-chart',
                                        zoom: 8,
                                      },
                                    ]
                                  : v.filter((s) => !(s.chart_id === c.id && s.member === i)),
                              )
                              setPrepared(null)
                            }}
                          />
                        }
                        label={`${c.name} · ${c.cycle} · ${member.name}`}
                      />
                      {picked && member.format === 'geotiff' && (
                        <Stack direction="row" spacing={1}>
                          <TextField
                            select
                            label="Tile coverage"
                            value={picked.coverage}
                            onChange={(e) => {
                              setChoices((v) =>
                                v.map((s) =>
                                  s === picked
                                    ? { ...s, coverage: e.target.value as Choice['coverage'] }
                                    : s,
                                ),
                              )
                              setPrepared(null)
                            }}
                          >
                            <MenuItem value="full-chart">Full chart</MenuItem>
                            <MenuItem value="route-area">Route area (clipped rectangle)</MenuItem>
                          </TextField>
                          <TextField
                            type="number"
                            label="Tile zoom"
                            value={picked.zoom}
                            inputProps={{ min: 0, max: 12 }}
                            onChange={(e) => {
                              setChoices((v) =>
                                v.map((s) =>
                                  s === picked ? { ...s, zoom: Number(e.target.value) } : s,
                                ),
                              )
                              setPrepared(null)
                            }}
                          />
                        </Stack>
                      )}
                    </Box>
                  )
                }),
              )}
              <Typography variant="body2">
                Selected members: {choices.length}.{' '}
                {revisionOf
                  ? 'A new revision will be created; the old package remains until deleted.'
                  : ''}
              </Typography>
              {choices.map((c) => (
                <Stack
                  key={`${c.chart_id}/${c.member}`}
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  alignItems="center"
                >
                  <Typography sx={{ overflowWrap: 'anywhere' }}>
                    Member {c.member}: {c.chart_id}
                  </Typography>
                  <TextField
                    label={`PDF pages for selected member ${c.member}`}
                    helperText="Blank = all PDF pages; otherwise comma-separated page numbers. Ignored for raster charts."
                    value={pageInputs[`${c.chart_id}/${c.member}`] ?? ''}
                    onChange={(e) => {
                      setPageInputs((v) => ({
                        ...v,
                        [`${c.chart_id}/${c.member}`]: e.target.value,
                      }))
                      setPrepared(null)
                    }}
                  />
                  <Button
                    onClick={() => {
                      setChoices((v) => v.filter((x) => x !== c))
                      setPrepared(null)
                    }}
                  >
                    Remove member {c.member}
                  </Button>
                </Stack>
              ))}
              {revisionOf && (
                <Button
                  onClick={() => {
                    setRevisionOf(null)
                    setPrepared(null)
                  }}
                >
                  Create a separate package instead
                </Button>
              )}
              <Button
                variant="outlined"
                disabled={busy || !online || !name.trim()}
                onClick={() => void prepare()}
              >
                Prepare package and review size
              </Button>
              {prepared && (
                <Box>
                  <Typography>
                    Prepared {prepared.name}: {size(prepared.total_bytes)}, {prepared.assets.length}{' '}
                    assets.{' '}
                    {prepared.charts
                      .map(
                        (c) =>
                          `${c.name}: ${c.coverage}${c.zoom !== null ? ` zoom ${c.zoom}, ${c.tile_count} tiles; bounds ${c.bounds_wgs84?.map((n) => n.toFixed(3)).join(', ')}` : `; pages ${c.pages?.join(', ')}`}`,
                      )
                      .join(' · ')}
                  </Typography>
                  {prepared.warnings.map((w) => (
                    <Alert key={w} severity="warning">
                      {w}
                    </Alert>
                  ))}
                  <Button
                    variant="contained"
                    disabled={busy || !online}
                    onClick={() => void download()}
                  >
                    Download verified package
                  </Button>
                </Box>
              )}
            </Stack>
          </CardContent>
        </Card>
      </details>
      <Typography variant="h5">Saved packages</Typography>
      <Typography variant="body2">
        {packages.length} / 32 packages ·{' '}
        {size(packages.reduce((sum, p) => sum + p.storage_bytes, 0))} / 512 MiB package limit.{' '}
        {estimate}
      </Typography>
      {packages.length === 0 && <Typography>No complete packages saved.</Typography>}
      {packages.map((p) => (
        <Stack
          key={p.id}
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ sm: 'center' }}
        >
          <Typography sx={{ flex: 1 }}>
            {p.name} · {stamp(p.created_at)} · {size(p.bytes)}
          </Typography>
          <Button disabled={busy} onClick={() => void open(p.id)}>
            Open and verify {p.name}
          </Button>
          <Button
            color="error"
            disabled={busy}
            onClick={() =>
              void work(async () => {
                await deletePackage(p.id)
                if (opened?.id === p.id) setOpened(null)
                await refresh()
              })
            }
          >
            Delete {p.name}
          </Button>
        </Stack>
      ))}
      {opened && (
        <Stack spacing={2}>
          <Typography variant="h5">{opened.name}</Typography>
          <Typography>
            Verified saved bytes · captured {stamp(opened.created_at)} · source snapshot age{' '}
            {Math.max(0, Math.floor((Date.now() - Date.parse(opened.created_at)) / 60000))} minutes.
          </Typography>
          <Alert severity="warning">
            Saved weather is a historical snapshot. Read original observation, issue and validity
            times in the source briefing; obtain a current briefing before flight.
          </Alert>
          {opened.warnings.map((w) => (
            <Alert severity="warning" key={w}>
              {w}
            </Alert>
          ))}
          <Button
            disabled={busy || !online}
            onClick={() => {
              setRevisionOf(opened.id)
              setName(opened.name)
              setPrepared(null)
              setFormOpen(true)
              setPlanId(
                typeof opened.route.saved_plan_id === 'string' ? opened.route.saved_plan_id : '',
              )
              if (Array.isArray(opened.route.airports)) setRoute(opened.route.airports.join(' '))
              setChoices(
                opened.assets
                  .filter((a) => a.role === 'chart_original')
                  .map((a) => {
                    const member = Number(/\/members\/(\d+)/.exec(a.url ?? '')?.[1] ?? 0)
                    const chart = opened.charts.find(
                      (c) => c.chart_id === a.chart_id && c.source_sha256 === a.sha256,
                    )!
                    return {
                      chart_id: a.chart_id!,
                      member,
                      sha256: a.sha256,
                      coverage: chart.coverage === 'route-area' ? 'route-area' : 'full-chart',
                      zoom: chart.zoom ?? 8,
                      ...(chart.pages ? { pdf_pages: chart.pages } : {}),
                    }
                  }),
              )
              document.getElementById('offline-preparation')?.scrollIntoView()
            }}
          >
            Prepare refreshed revision with pinned chart editions
          </Button>
          <Typography variant="body2">
            To change chart editions, acquire the desired edition in Charts, then replace the
            selected member before preparing a revision.
          </Typography>
          <RouteSketch route={opened.route} />
          {opened.charts.map((c, i) => (
            <ChartView key={`${c.chart_id}/${i}`} manifest={opened} chart={c} />
          ))}
          {opened.assets
            .filter((a) => ['route', 'airports', 'weather'].includes(a.role))
            .map((a) => (
              <JsonSnapshot key={a.id} manifest={opened} asset={a} />
            ))}
        </Stack>
      )}
    </Stack>
  )
}
