import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { distanceNM } from '@aviation/shared-sdk/aviation/navigation'
import type { Geometry } from 'geojson'
import type { FlightPlan } from '../types'
import AssessmentMap from './AssessmentMap'

type Row = { lat: string; lon: string; altitude_ft_msl: string; at: string }
type Position = {
  lat: number
  lon: number
  altitude_ft_msl: number
  at: string
  leg: number
  along_route_nm: number
}
type Source = {
  provider: string
  url?: string | null
  retrieved_at_utc?: string | null
  served_at_utc?: string | null
}
type Finding = {
  id: string
  name: string
  kind: string
  geometry_id: string
  mode: string
  applicability: string
  uncertainties: string[]
  source: Source
  raw: Record<string, unknown>
  entry: Position
  exit: Position
}
type Result = {
  assessed_at_utc: string
  route_geometry: Geometry
  geometries: Record<string, Geometry>
  distance_nm: number
  findings: Finding[]
  total_findings: number
  findings_truncated: boolean
  unassessed: { id: string; name: string; reason: string; source: Source }[]
  unassessed_count: number
  terrain: (Position & {
    elevation_ft_msl: number | null
    clearance_ft: number | null
    below_margin: boolean | null
  })[]
  terrain_source: Source | null
  sources: {
    name: string
    status: string
    error: string | null
    truncated: boolean
    sources: Source[]
    missing_geometry_ids: string[]
  }[]
  coverage_gaps: string[]
  geometry_method: {
    route_max_spacing_nm: number
    terrain_max_spacing_nm: number
    corridor: string
  }
  limitations: string
}
const empty = (): Row => ({ lat: '', lon: '', altitude_ft_msl: '4500', at: '' })

export default function RouteAssessmentPanel({ plan }: { plan?: FlightPlan }) {
  const [rows, setRows] = useState<Row[]>([empty(), empty()])
  const [airports, setAirports] = useState(() => {
    const context = new URLSearchParams(window.location.search).get('airports') || ''
    const codes = context
      .trim()
      .toUpperCase()
      .split(/[\s,;→]+/)
      .filter(Boolean)
    return codes.length >= 2 &&
      codes.length <= 50 &&
      codes.every((code) => /^[A-Z0-9]{3,4}$/.test(code))
      ? codes.join(' ')
      : 'KSAT KAUS'
  })
  const [departure, setDeparture] = useState(new Date().toISOString().slice(0, 16) + 'Z')
  const [speed, setSpeed] = useState(String(plan?.groundspeed_kt || 120))
  const [altitude, setAltitude] = useState(String(plan?.altitude || 4500))
  const [corridor, setCorridor] = useState('5'),
    [margin, setMargin] = useState('1000')
  const [result, setResult] = useState<Result | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const generation = useRef(0),
    controller = useRef<AbortController | null>(null)
  const currentPlan = useRef(plan)
  const invalidate = () => {
    generation.current++
    controller.current?.abort()
    setBusy(false)
    setResult(null)
    setError('')
  }
  useEffect(() => {
    if (currentPlan.current !== plan) {
      currentPlan.current = plan
      generation.current++
      controller.current?.abort()
      setResult(null)
      setRows([empty(), empty()])
      setBusy(false)
    }
  }, [plan])
  useEffect(
    () => () => {
      generation.current++
      controller.current?.abort()
    },
    [],
  )
  function edit(index: number, key: keyof Row, value: string) {
    invalidate()
    setRows((old) => old.map((r, i) => (i === index ? { ...r, [key]: value } : r)))
  }
  function prepare(points: [number, number][]) {
    const groundspeed = Number(speed),
      height = Number(altitude),
      start = Date.parse(departure)
    if (
      !speed.trim() ||
      !altitude.trim() ||
      !Number.isFinite(groundspeed) ||
      groundspeed <= 0 ||
      !Number.isFinite(height) ||
      !Number.isFinite(start) ||
      !/(Z|[+-]\d\d:\d\d)$/i.test(departure)
    )
      throw new Error(
        'Enter a positive groundspeed, altitude and timezone-qualified departure time.',
      )
    if (points.length < 2 || points.length > 50) throw new Error('Use 2–50 route points.')
    let elapsed = 0
    return points.map((p, i) => {
      if (i) elapsed += (distanceNM(...points[i - 1], ...p) / groundspeed) * 3600000
      return {
        lat: String(p[0]),
        lon: String(p[1]),
        altitude_ft_msl: String(height),
        at: new Date(start + elapsed).toISOString(),
      }
    })
  }
  async function fromAirports() {
    invalidate()
    const seq = generation.current
    const abort = new AbortController()
    controller.current = abort
    setBusy(true)
    try {
      const codes = airports
        .trim()
        .toUpperCase()
        .split(/[\s,;→]+/)
        .filter(Boolean)
      if (codes.length < 2 || codes.length > 50)
        throw new Error('Use 2–50 route airports in order.')
      const points = await Promise.all(
        codes.map(async (code) => {
          if (!/^[A-Z0-9]{3,4}$/i.test(code)) throw new Error('Use published airport identifiers.')
          const r = await fetch('/api/airports/' + encodeURIComponent(code), {
            signal: abort.signal,
          })
          if (!r.ok) throw new Error('Airport lookup failed for ' + code)
          const a = await r.json()
          return [a.latitude, a.longitude] as [number, number]
        }),
      )
      const draft = prepare(points)
      if (seq === generation.current) setRows(draft)
    } catch (e) {
      if (seq === generation.current && !(e instanceof DOMException && e.name === 'AbortError'))
        setError(e instanceof Error ? e.message : 'Airport lookup failed')
    } finally {
      if (seq === generation.current) setBusy(false)
    }
  }
  function fromPlan() {
    invalidate()
    try {
      if (!plan) return
      const points: [number, number][] = []
      for (const s of plan.segments)
        for (const p of [s.start, s.end])
          if (
            !points.length ||
            points[points.length - 1][0] !== p[0] ||
            points[points.length - 1][1] !== p[1]
          )
            points.push(p)
      if (!points.length) points.push(plan.origin_coords, plan.destination_coords)
      setRows(prepare(points))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not prepare profile')
    }
  }
  async function assess() {
    invalidate()
    const seq = generation.current
    const abort = new AbortController()
    controller.current = abort
    try {
      if (rows.some((r) => Object.values(r).some((v) => !v.trim())))
        throw new Error('Complete every route coordinate, altitude and UTC time.')
      if (rows.some((r) => !Number.isFinite(Date.parse(r.at)) || !/(Z|[+-]\d\d:\d\d)$/i.test(r.at)))
        throw new Error('Every arrival time needs a UTC offset or Z.')
      const waypoints = rows.map((r) => ({
        lat: Number(r.lat),
        lon: Number(r.lon),
        altitude_ft_msl: Number(r.altitude_ft_msl),
        at: r.at,
      }))
      if (
        waypoints.some((r) => ![r.lat, r.lon, r.altitude_ft_msl].every(Number.isFinite)) ||
        !corridor.trim() ||
        !margin.trim() ||
        ![Number(corridor), Number(margin)].every(Number.isFinite)
      )
        throw new Error('Route values must be finite numbers.')
      setBusy(true)
      const r = await fetch('/api/route-assessment', {
        method: 'POST',
        signal: abort.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          waypoints,
          corridor_nm: Number(corridor),
          clearance_margin_ft: Number(margin),
        }),
      })
      const value = await r.json()
      if (!r.ok)
        throw new Error(
          typeof value.detail === 'string'
            ? value.detail
            : `Assessment failed (${r.status}); check route inputs.`,
        )
      if (seq === generation.current) setResult(value)
    } catch (e) {
      if (seq === generation.current && !(e instanceof DOMException && e.name === 'AbortError'))
        setError(e instanceof Error ? e.message : 'Assessment failed')
    } finally {
      if (seq === generation.current) setBusy(false)
    }
  }
  return (
    <Stack spacing={2} sx={{ overflowWrap: 'anywhere' }}>
      <Typography variant="h5" component="h2">
        Route hazard assessment
      </Typography>
      <Typography>
        Review a timed altitude profile against published advisories, airspace, TFR geometry,
        obstacles and sampled terrain.
      </Typography>
      <Alert severity="info">
        Reference planning only. Source gaps and uncertain applicability remain visible. This is not
        a complete NOTAM briefing or a safe-altitude determination.
      </Alert>
      <details>
        <summary>Prepare a draft profile from airports or the displayed plan</summary>
        <Stack spacing={2} sx={{ mt: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} gap={2}>
            <TextField
              label="Route airports (in order)"
              value={airports}
              onChange={(e) => {
                invalidate()
                setAirports(e.target.value.toUpperCase())
              }}
              sx={{ flex: 1 }}
            />
            <TextField
              label="Departure UTC"
              value={departure}
              onChange={(e) => {
                invalidate()
                setDeparture(e.target.value)
              }}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
            <TextField
              label="Assumed groundspeed (kt)"
              type="number"
              value={speed}
              onChange={(e) => {
                invalidate()
                setSpeed(e.target.value)
              }}
            />
            <TextField
              label="Draft altitude (ft MSL)"
              type="number"
              value={altitude}
              onChange={(e) => {
                invalidate()
                setAltitude(e.target.value)
              }}
            />
          </Stack>
          <Typography variant="body2">
            Draft times use constant groundspeed and altitude. Edit the rows below for climb,
            descent, holds or speed changes before assessing.
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            <Button disabled={busy} onClick={() => void fromAirports()}>
              Use airport route
            </Button>
            {plan && <Button onClick={fromPlan}>Use displayed route</Button>}
          </Stack>
        </Stack>
      </details>
      {rows.map((row, i) => (
        <Card key={i} variant="outlined">
          <CardContent>
            <Typography>Waypoint {i + 1}</Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} gap={1} sx={{ mt: 1 }}>
              <TextField
                label={`Latitude ${i + 1}`}
                type="number"
                value={row.lat}
                onChange={(e) => edit(i, 'lat', e.target.value)}
              />
              <TextField
                label={`Longitude ${i + 1}`}
                type="number"
                value={row.lon}
                onChange={(e) => edit(i, 'lon', e.target.value)}
              />
              <TextField
                label={`Altitude ft MSL ${i + 1}`}
                type="number"
                value={row.altitude_ft_msl}
                onChange={(e) => edit(i, 'altitude_ft_msl', e.target.value)}
              />
              <TextField
                label={`Arrival UTC ${i + 1}`}
                value={row.at}
                onChange={(e) => edit(i, 'at', e.target.value)}
                sx={{ minWidth: 0, flex: 1 }}
              />
            </Stack>
            <Button
              disabled={rows.length <= 2}
              onClick={() => {
                invalidate()
                setRows(rows.filter((_, n) => n !== i))
              }}
            >
              Remove waypoint {i + 1}
            </Button>
          </CardContent>
        </Card>
      ))}
      <Button
        disabled={rows.length >= 50}
        onClick={() => {
          invalidate()
          setRows([...rows, empty()])
        }}
      >
        Add waypoint
      </Button>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
        <TextField
          label="Proximity corridor (NM)"
          type="number"
          value={corridor}
          onChange={(e) => {
            invalidate()
            setCorridor(e.target.value)
          }}
        />
        <TextField
          label="Terrain / obstacle margin (ft)"
          type="number"
          value={margin}
          onChange={(e) => {
            invalidate()
            setMargin(e.target.value)
          }}
        />
      </Stack>
      <Stack direction="row" gap={1}>
        <Button variant="contained" disabled={busy} onClick={() => void assess()}>
          Assess route profile
        </Button>
        {busy && <Button onClick={invalidate}>Cancel assessment</Button>}
      </Stack>
      {busy && (
        <Typography role="status">
          Retrieving source data and assessing the supplied profile…
        </Typography>
      )}
      {error && <Alert severity="error">{error}</Alert>}
      {result && (
        <>
          <Typography variant="h6">
            {result.distance_nm.toFixed(1)} NM · {result.total_findings} encounters
          </Typography>
          <Alert severity="info">{result.limitations}</Alert>
          {result.coverage_gaps.map((g) => (
            <Alert severity="warning" key={g}>
              {g}
            </Alert>
          ))}
          {(result.findings_truncated || result.unassessed_count > result.unassessed.length) && (
            <Alert severity="warning">
              The response was capped. Some encounters or unassessed candidates are omitted; this
              assessment is incomplete.
            </Alert>
          )}
          <Typography variant="h6">Source coverage</Typography>
          {result.sources.map((s) => (
            <Box key={s.name}>
              <Chip
                label={`${s.name}: ${s.status}${s.truncated ? ' · truncated' : ''}`}
                color={s.status === 'unavailable' || s.truncated ? 'warning' : 'default'}
              />
              <Typography variant="body2">
                {s.error}
                {s.missing_geometry_ids.length > 0
                  ? ` · ${s.missing_geometry_ids.length} listed restrictions lack geometry`
                  : ''}
              </Typography>
              {s.sources.map((p, i) => (
                <Typography variant="body2" key={i}>
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noreferrer">
                      {p.provider}
                    </a>
                  ) : (
                    p.provider
                  )}{' '}
                  · retrieved {p.retrieved_at_utc || p.served_at_utc || 'unknown'}
                </Typography>
              ))}
            </Box>
          ))}
          <Typography variant="h6">Route and encountered source geometry</Typography>
          <AssessmentMap
            key={result.assessed_at_utc}
            route={result.route_geometry}
            findings={result.findings.map((f) => ({
              ...f,
              geometry: result.geometries[f.geometry_id],
            }))}
          />
          <Typography variant="body2">
            {result.geometry_method.corridor} Route spacing ≤{' '}
            {result.geometry_method.route_max_spacing_nm} NM; actual maximum terrain sample spacing{' '}
            {result.geometry_method.terrain_max_spacing_nm.toFixed(2)} NM.
          </Typography>
          <Typography variant="h6">Encounters</Typography>
          {!result.findings.length && (
            <Typography>
              No encounters identified in the available evaluated records. Check every source status
              and coverage gap above.
            </Typography>
          )}
          {result.findings.map((f, i) => (
            <Card key={f.id + ':' + i}>
              <CardContent>
                <Typography variant="h6">{f.name}</Typography>
                <Typography>
                  {f.kind} · {f.mode} · {f.applicability}
                </Typography>
                <Typography variant="body2">
                  Entry {f.entry.at} · {f.entry.altitude_ft_msl.toFixed(0)} ft MSL · leg{' '}
                  {f.entry.leg + 1}
                </Typography>
                <Typography variant="body2">
                  Exit {f.exit.at} · {f.exit.altitude_ft_msl.toFixed(0)} ft MSL
                </Typography>
                {f.uncertainties.map((u) => (
                  <Typography variant="body2" key={u}>
                    {u}
                  </Typography>
                ))}
                {f.source.url && (
                  <Button component="a" href={f.source.url} target="_blank" rel="noreferrer">
                    Published source
                  </Button>
                )}
                <details>
                  <summary>Original source fields</summary>
                  <Box component="pre" sx={{ overflow: 'auto', maxHeight: 300, fontSize: 12 }}>
                    {JSON.stringify(f.raw, null, 2)}
                  </Box>
                </details>
              </CardContent>
            </Card>
          ))}
          <Typography variant="h6">Sampled terrain clearance</Typography>
          <Typography>
            {result.terrain.length} samples · {result.terrain.filter((p) => p.below_margin).length}{' '}
            below the requested margin ·{' '}
            {result.terrain.filter((p) => p.elevation_ft_msl == null).length} unknown elevations
          </Typography>
          <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
            {result.terrain.map((p, i) => (
              <Typography variant="body2" key={i}>
                {p.along_route_nm.toFixed(1)} NM · {p.at} · terrain{' '}
                {p.elevation_ft_msl == null ? 'unknown' : `${p.elevation_ft_msl.toFixed(0)} ft MSL`}{' '}
                · clearance {p.clearance_ft == null ? 'unknown' : `${p.clearance_ft.toFixed(0)} ft`}
                {p.below_margin ? ' · below margin' : ''}
              </Typography>
            ))}
          </Box>
          <details>
            <summary>Unassessed candidates ({result.unassessed_count})</summary>
            <Stack spacing={1} sx={{ mt: 1 }}>
              {result.unassessed.map((u, i) => (
                <Typography key={u.id + ':' + i}>
                  {u.name}: {u.reason}
                </Typography>
              ))}
            </Stack>
          </details>
        </>
      )}
    </Stack>
  )
}
