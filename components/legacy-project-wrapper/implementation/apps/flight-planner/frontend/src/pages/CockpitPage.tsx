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
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { bridgeClient, type Envelope, type Snapshot } from '../cockpit/client'

const number = (value: unknown, digits = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : 'Unknown'
const stamp = (value: string) =>
  Number.isFinite(Date.parse(value)) ? new Date(value).toUTCString() : 'Unknown'
function Report({
  envelope,
  localAge,
  available,
}: {
  envelope: Envelope | null
  localAge: number
  available: boolean
}) {
  if (!envelope) return <Typography>No report received.</Typography>
  const report = envelope.report
  const age = envelope.age_seconds + localAge
  const fresh =
    available && envelope.live && !envelope.stale && age <= (report.kind === 'traffic' ? 15 : 5)
  return (
    <Box sx={{ overflowWrap: 'anywhere' }}>
      <Chip
        size="small"
        color={fresh ? 'success' : 'warning'}
        label={
          report.kind === 'fisb_text'
            ? 'Product validity unassessed'
            : fresh
              ? 'Fresh receipt'
              : 'Last known / stale'
        }
      />
      <Typography variant="body2">
        Received {stamp(envelope.received_at)} · age {number(age, 1)} seconds
      </Typography>
      {(report.kind === 'ownship' || report.kind === 'traffic') && (
        <>
          <Typography>
            {report.callsign || 'No callsign'} · {report.participant_address} · address type{' '}
            {report.address_type}
          </Typography>
          <Typography>
            {report.kind === 'ownship' && (!fresh || envelope.gps_fix_valid !== true)
              ? 'Reported position (GPS invalid or not current)'
              : 'Position'}
            :{' '}
            {report.position_valid
              ? `${number(report.latitude_deg, 5)}, ${number(report.longitude_deg, 5)}`
              : 'Invalid / unavailable'}
          </Typography>
          {report.kind === 'ownship' && (
            <Typography>
              Ownship GPS fix:{' '}
              {fresh && envelope.gps_fix_valid === true
                ? 'Valid'
                : envelope.gps_fix_valid === false
                  ? 'Invalid'
                  : 'Unknown / not current'}
            </Typography>
          )}
          <Typography>Pressure altitude: {number(report.pressure_altitude_ft)} ft</Typography>
          <Typography>
            Horizontal speed:{' '}
            {report.horizontal_speed_saturated
              ? `at least ${number(report.horizontal_speed_at_least_kt)}`
              : number(report.horizontal_speed_kt)}{' '}
            kt
          </Typography>
          <Typography>
            Track / heading: {number(report.angle_deg, 1)}° ·{' '}
            {report.angle_reference ?? 'Unknown reference'}
          </Typography>
          <Typography>
            NIC {number(report.nic)} · NACp {number(report.nacp)} ·{' '}
            {report.extrapolated ? 'Extrapolated' : 'Not extrapolated'} · alert{' '}
            {number(report.alert_status)}
          </Typography>
        </>
      )}
      {report.kind === 'geometric_altitude' && (
        <>
          <Typography>
            Geometric altitude: {number(report.geometric_altitude_ft)} ft ·{' '}
            {report.datum ?? 'Unknown datum'}
          </Typography>
          <Typography>
            Datum source: {report.datum_source} · vertical warning{' '}
            {report.vertical_warning ? 'Yes' : 'No'}
          </Typography>
        </>
      )}
      {report.kind === 'device_id' && (
        <>
          <Typography>
            {report.device_long_name || report.device_name} · serial{' '}
            {report.serial_number_hex ?? 'Unknown'}
          </Typography>
          <Typography>
            Declared datum: {report.geometric_altitude_datum} · internet policy:{' '}
            {report.internet_policy ?? 'Unknown'}
          </Typography>
        </>
      )}
      {report.kind === 'fisb_text' && (
        <>
          <Typography>
            {report.report_type} · {report.location_id} · FIS-B product {report.product_id}
          </Typography>
          <Typography>Report time (as received): {report.report_time}</Typography>
          <Typography variant="body2">
            Receipt age does not establish product age or validity.
          </Typography>
          {age > 900 && <Typography>Receipt retention expired; refresh the snapshot.</Typography>}
          <Box
            component="pre"
            sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: 'monospace' }}
          >
            {report.body}
          </Box>
        </>
      )}
      {report.kind === 'heartbeat' && (
        <Typography>
          Receiver GPS indication: {report.gps_position_valid ? 'Valid' : 'Invalid'} · receiver UTC
          seconds since midnight: {number(report.seconds_since_midnight)} (calendar date unknown)
        </Typography>
      )}
      <details>
        <summary>Normalized report details</summary>
        <Box
          component="pre"
          sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12 }}
        >
          {JSON.stringify(envelope, null, 2)}
        </Box>
      </details>
    </Box>
  )
}
export default function CockpitPage() {
  const [origin, setOrigin] = useState('http://127.0.0.1:18190')
  const [token, setToken] = useState('')
  const [connected, setConnected] = useState(false)
  const [monitor, setMonitor] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [localAge, setLocalAge] = useState(0)
  const connection = useRef<ReturnType<typeof bridgeClient> | null>(null)
  const pending = useRef<AbortController | null>(null)
  const epoch = useRef(0)
  const sampleTime = useRef({ wall: 0, monotonic: 0 })
  const refresh = useCallback(async (action?: 'start' | 'stop') => {
    if (!connection.current || pending.current) return
    const version = epoch.current,
      client = connection.current,
      controller = new AbortController()
    pending.current = controller
    setBusy(true)
    try {
      if (action) await client.control(action, controller.signal)
      const next = await client.state(controller.signal)
      if (epoch.current !== version) return
      sampleTime.current = { wall: Date.now(), monotonic: performance.now() }
      setSnapshot(next)
      setLocalAge(0)
      setError('')
    } catch (failure) {
      if (epoch.current === version)
        setError(failure instanceof Error ? failure.message : 'Bridge request failed.')
    } finally {
      if (epoch.current === version) {
        pending.current = null
        setBusy(false)
      }
    }
  }, [])
  useEffect(
    () => () => {
      epoch.current++
      pending.current?.abort()
      connection.current = null
    },
    [],
  )
  useEffect(() => {
    if (!connected || !monitor) return
    const timer = window.setInterval(() => void refresh(), 2000)
    return () => window.clearInterval(timer)
  }, [connected, monitor, refresh])
  useEffect(() => {
    if (!snapshot) return
    const timer = window.setInterval(
      () =>
        setLocalAge((previous) =>
          Math.max(
            previous,
            0,
            (Date.now() - sampleTime.current.wall) / 1000,
            (performance.now() - sampleTime.current.monotonic) / 1000,
          ),
        ),
      1000,
    )
    return () => window.clearInterval(timer)
  }, [snapshot])
  function connect() {
    try {
      connection.current = bridgeClient(origin, token)
      epoch.current++
      setConnected(true)
      setToken('')
      setSnapshot(null)
      setError('')
      void refresh()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Invalid connection settings.')
    }
  }
  function disconnect() {
    epoch.current++
    pending.current?.abort()
    pending.current = null
    connection.current = null
    setConnected(false)
    setMonitor(false)
    setBusy(false)
    setSnapshot(null)
    setToken('')
    setError('')
  }
  const available = connected && !error && snapshot?.listening === true
  return (
    <Stack spacing={2} sx={{ overflowWrap: 'anywhere' }}>
      <Typography variant="h4" component="h1">
        Cockpit receiver
      </Typography>
      <Alert severity="warning">
        Advisory receiver reports only. Traffic coverage is incomplete; this page supplies no
        navigation or collision-avoidance guidance. Receiver weather decoding is unavailable.
      </Alert>
      <Typography>
        Run the local bridge with this page’s origin in its allowlist. Use HTTPS, or loopback HTTP
        on the same device. Browser certificate and local-network permissions still apply. The token
        stays only in page memory.
      </Typography>
      {!connected ? (
        <Stack spacing={2}>
          <TextField
            label="Bridge origin"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            autoComplete="off"
          />
          <TextField
            label="Bridge operator token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
          />
          <Button variant="contained" onClick={connect}>
            Connect and read snapshot
          </Button>
        </Stack>
      ) : (
        <>
          <Typography sx={{ overflowWrap: 'anywhere' }}>
            Bridge: {connection.current?.origin}
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Button onClick={() => void refresh()} disabled={busy}>
              Refresh snapshot
            </Button>
            <Button onClick={() => void refresh('start')} disabled={busy}>
              Start receiver listener
            </Button>
            <Button onClick={() => void refresh('stop')} disabled={busy}>
              Stop receiver listener
            </Button>
            <Button onClick={disconnect}>Disconnect and clear</Button>
          </Stack>
          <FormControlLabel
            control={<Checkbox checked={monitor} onChange={(e) => setMonitor(e.target.checked)} />}
            label="Monitor every 2 seconds"
          />
          {busy && <Typography role="status">Contacting local bridge…</Typography>}
        </>
      )}
      {error && <Alert severity="error">{error}</Alert>}
      {!snapshot && !busy && <Typography>No receiver snapshot loaded.</Typography>}
      {snapshot && (
        <>
          <Alert
            severity={available && snapshot.connected && localAge <= 5 ? 'success' : 'warning'}
          >
            {error || localAge > 5
              ? 'Last known snapshot; refresh to establish current state.'
              : snapshot.listening
                ? snapshot.connected
                  ? 'Listener running; receiver reports connected.'
                  : 'Listener running; no current receiver telemetry.'
                : 'Receiver listener stopped.'}{' '}
            Session {snapshot.session} · snapshot age {number(localAge, 1)} seconds.
          </Alert>
          <Typography>
            UDP bind: {snapshot.udp_bind}:{snapshot.udp_port ?? 'Not listening'}
          </Typography>
          {snapshot.limitations.map((limitation) => (
            <Typography key={limitation} variant="body2">
              {limitation}
            </Typography>
          ))}
          <Typography variant="h5" component="h2">
            Receivers ({snapshot.receivers.length})
          </Typography>
          {snapshot.receivers.map((receiver) => (
            <Card key={receiver.source_id}>
              <CardContent>
                <Stack spacing={1}>
                  <Typography variant="h6" component="h3" sx={{ overflowWrap: 'anywhere' }}>
                    Source {receiver.source_id}
                  </Typography>
                  <Typography>
                    {available && receiver.connected && localAge <= 5
                      ? 'Telemetry connected'
                      : 'No current telemetry'}{' '}
                    · device profile{' '}
                    {receiver.device_profile_valid === true
                      ? 'Known at capture'
                      : 'Unknown / uncertain'}
                  </Typography>
                  {(['device_id', 'heartbeat', 'ownship', 'geometric_altitude'] as const).map(
                    (kind) => (
                      <Box key={kind}>
                        <Typography fontWeight="bold">{kind.replace(/_/g, ' ')}</Typography>
                        <Report
                          envelope={receiver[kind]}
                          localAge={localAge}
                          available={available}
                        />
                      </Box>
                    ),
                  )}
                </Stack>
              </CardContent>
            </Card>
          ))}
          <Box component="section" aria-label="Receiver weather">
            <Typography variant="h5" component="h2">
              Receiver weather ({snapshot.weather?.length ?? 0})
            </Typography>
            <Typography variant="body2">
              {snapshot.capabilities.weather_decoding
                ? 'Received FIS-B text product 413. Graphical and segmented products are unavailable; product validity is unassessed.'
                : 'This bridge does not decode receiver weather.'}
            </Typography>
            {!snapshot.weather?.length && (
              <Typography>
                No receiver weather reports retained; this does not establish weather coverage.
              </Typography>
            )}
            {snapshot.weather?.map((weather, index) => (
              <Card key={`${weather.source_id}-weather-${index}`}>
                <CardContent>
                  <Typography sx={{ overflowWrap: 'anywhere' }}>
                    Source {weather.source_id}
                  </Typography>
                  <Report envelope={weather} localAge={localAge} available={available} />
                </CardContent>
              </Card>
            ))}
          </Box>
          <Typography variant="h5" component="h2">
            Traffic ({snapshot.traffic.length})
          </Typography>
          {!snapshot.traffic.length && (
            <Typography>
              No traffic reports received; this does not establish clear airspace.
            </Typography>
          )}
          {snapshot.traffic.map((traffic, index) => (
            <Card key={`${traffic.source_id}-${index}`}>
              <CardContent>
                <Typography sx={{ overflowWrap: 'anywhere' }}>
                  Source {traffic.source_id}
                </Typography>
                <Report envelope={traffic} localAge={localAge} available={available} />
              </CardContent>
            </Card>
          ))}
          <details>
            <summary>Receiver counters and decoding diagnostics</summary>
            <Box component="pre" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {JSON.stringify(
                {
                  counters: snapshot.counters,
                  decode_errors: snapshot.decode_errors,
                  capabilities: snapshot.capabilities,
                },
                null,
                2,
              )}
            </Box>
          </details>
        </>
      )}
    </Stack>
  )
}
