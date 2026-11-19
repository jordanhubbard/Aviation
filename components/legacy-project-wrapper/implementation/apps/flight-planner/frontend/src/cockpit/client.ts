import type { Gdl90Message, FisbTextReport } from '@aviation/g1000-avionics-sdk'

export type Envelope = {
  source_id: string
  received_at: string
  age_seconds: number
  live: boolean
  stale: boolean
  gps_fix_valid?: boolean | null
  report: Gdl90Message | FisbTextReport
}
export type Receiver = {
  source_id: string
  connected: boolean
  device_profile_valid: boolean | null
  device_id: Envelope | null
  heartbeat: Envelope | null
  ownship: Envelope | null
  geometric_altitude: Envelope | null
}
export type Snapshot = {
  source: 'local-udp-gdl90'
  session: number
  listening: boolean
  connected: boolean
  udp_bind: string
  udp_port: number | null
  receivers: Receiver[]
  traffic: Envelope[]
  recent_reports: Envelope[]
  weather?: Envelope[]
  counters: Record<string, number>
  decode_errors: Record<string, number>
  capabilities: {
    weather_decoding: boolean
    weather_product_ids?: number[]
    weather_segmented?: boolean
    weather_graphical?: boolean
  }
  limitations: string[]
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function textRecord(value: unknown): boolean {
  if (!object(value) || value.product_id !== 413) return false
  if (
    !['report_type', 'location_id', 'report_time'].every(
      (key) =>
        typeof value[key] === 'string' &&
        value[key].length > 0 &&
        value[key].length <= 32 &&
        !value[key].includes(' '),
    )
  )
    return false
  return (
    typeof value.body === 'string' &&
    value.body.length > 0 &&
    typeof value.raw_text === 'string' &&
    value.raw_text.length <= 4096 &&
    value.raw_text ===
      `${value.report_type} ${value.location_id} ${value.report_time} ${value.body}`
  )
}
function report(value: Record<string, unknown>): boolean {
  if (value.kind === 'uplink') {
    return (
      value.message_id === 7 &&
      typeof value.payload_hex === 'string' &&
      /^07[0-9a-f]{870}$/.test(value.payload_hex) &&
      typeof value.application_data_valid === 'boolean' &&
      (value.time_of_reception_ns === null ||
        (typeof value.time_of_reception_ns === 'number' &&
          Number.isInteger(value.time_of_reception_ns) &&
          value.time_of_reception_ns >= 0 &&
          value.time_of_reception_ns < 1000000000)) &&
      Array.isArray(value.records) &&
      value.records.length <= 128 &&
      value.records.every(textRecord) &&
      (value.application_data_valid || value.records.length === 0) &&
      value.records.reduce((n: number, row) => n + String(row.raw_text).length, 0) <= 4096 &&
      Number.isInteger(value.unsupported_frames) &&
      (value.unsupported_frames as number) >= 0 &&
      (value.unsupported_frames as number) <= 141 &&
      Array.isArray(value.unsupported_products) &&
      value.unsupported_products.length <= 141 &&
      value.unsupported_products.every((n) => Number.isInteger(n) && n >= 0 && n <= 2047) &&
      Array.isArray(value.errors) &&
      value.errors.length <= 32 &&
      value.errors.every((e) => typeof e === 'string' && e.length > 0 && e.length <= 40)
    )
  }
  if (value.kind === 'fisb_text')
    return (
      textRecord(value) &&
      value.message_id === 7 &&
      typeof value.payload_hex === 'string' &&
      /^07[0-9a-f]{870}$/.test(value.payload_hex) &&
      value.product_age_seconds === null &&
      value.validity === 'unassessed'
    )
  return (
    ['heartbeat', 'ownship', 'traffic', 'geometric_altitude', 'device_id', 'unsupported'].includes(
      String(value.kind),
    ) &&
    Object.values(value).every(
      (field) =>
        field === null ||
        typeof field === 'string' ||
        typeof field === 'boolean' ||
        (typeof field === 'number' && Number.isFinite(field)),
    )
  )
}
function envelope(value: unknown): value is Envelope {
  if (!object(value) || !object(value.report)) return false
  return (
    typeof value.source_id === 'string' &&
    typeof value.received_at === 'string' &&
    Number.isFinite(Date.parse(value.received_at)) &&
    typeof value.age_seconds === 'number' &&
    Number.isFinite(value.age_seconds) &&
    value.age_seconds >= 0 &&
    typeof value.live === 'boolean' &&
    typeof value.stale === 'boolean' &&
    [undefined, null, true, false].includes(value.gps_fix_valid as boolean | null | undefined) &&
    (value.report.kind !== 'fisb_text' || value.live === false) &&
    report(value.report)
  )
}
function snapshot(value: unknown): value is Snapshot {
  if (
    !object(value) ||
    value.source !== 'local-udp-gdl90' ||
    !Number.isInteger(value.session) ||
    (value.session as number) < 0 ||
    typeof value.listening !== 'boolean' ||
    typeof value.connected !== 'boolean' ||
    typeof value.udp_bind !== 'string' ||
    !(
      value.udp_port === null ||
      (Number.isInteger(value.udp_port) &&
        (value.udp_port as number) > 0 &&
        (value.udp_port as number) <= 65535)
    ) ||
    !object(value.capabilities) ||
    typeof value.capabilities.weather_decoding !== 'boolean' ||
    !Array.isArray(value.limitations) ||
    !value.limitations.every((item) => typeof item === 'string') ||
    !Array.isArray(value.receivers) ||
    value.receivers.length > 8 ||
    !Array.isArray(value.traffic) ||
    value.traffic.length > 500 ||
    !Array.isArray(value.recent_reports) ||
    value.recent_reports.length > 128
  )
    return false
  if (
    value.weather !== undefined &&
    (!Array.isArray(value.weather) ||
      value.weather.length > 128 ||
      !value.weather.every((row) => envelope(row) && row.report.kind === 'fisb_text'))
  )
    return false
  if (
    value.capabilities.weather_decoding &&
    (!Array.isArray(value.weather) ||
      JSON.stringify(value.capabilities.weather_product_ids) !== '[413]' ||
      value.capabilities.weather_segmented !== false ||
      value.capabilities.weather_graphical !== false)
  )
    return false
  if (!value.capabilities.weather_decoding && Array.isArray(value.weather) && value.weather.length)
    return false
  for (const key of ['counters', 'decode_errors']) {
    if (
      !object(value[key]) ||
      !Object.values(value[key]).every((n) => Number.isInteger(n) && (n as number) >= 0)
    )
      return false
  }
  return (
    value.receivers.every(
      (receiver) =>
        object(receiver) &&
        typeof receiver.source_id === 'string' &&
        typeof receiver.connected === 'boolean' &&
        [null, true, false].includes(receiver.device_profile_valid as boolean | null) &&
        ['device_id', 'heartbeat', 'ownship', 'geometric_altitude'].every(
          (kind) =>
            receiver[kind] === null ||
            (envelope(receiver[kind]) &&
              receiver[kind].source_id === receiver.source_id &&
              receiver[kind].report.kind === kind),
        ),
    ) &&
    value.traffic.every((report) => envelope(report) && report.report.kind === 'traffic') &&
    value.recent_reports.every(envelope)
  )
}
export function bridgeOrigin(value: string): string {
  const url = new URL(value)
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    (url.protocol === 'http:' && !loopback) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !['', '/'].includes(url.pathname) ||
    url.port === '0'
  )
    throw new Error('Use an HTTPS bridge origin, or loopback HTTP, without credentials or a path.')
  return url.origin
}
export function bridgeClient(origin: string, token: string) {
  const base = bridgeOrigin(origin)
  if (token.length < 32 || token.length > 512 || /[\r\n]/.test(token))
    throw new Error('Enter the bridge operator token (32–512 characters).')
  async function request(path: 'state' | 'start' | 'stop', signal: AbortSignal) {
    const controller = new AbortController()
    const abort = () => controller.abort()
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) controller.abort()
    const timeout = window.setTimeout(abort, 8000)
    try {
      const response = await fetch(`${base}/api/cockpit/${path}`, {
        method: path === 'state' ? 'GET' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        referrerPolicy: 'no-referrer',
        signal: controller.signal,
      })
      if (!response.ok)
        throw new Error(
          `Bridge request failed (HTTP ${response.status}). Check the token and allowed origin.`,
        )
      const data = await response.json()
      if (data?.source !== 'local-udp-gdl90' || typeof data.listening !== 'boolean')
        throw new Error('The endpoint did not return an Aviation cockpit snapshot.')
      if (path === 'state' && !snapshot(data))
        throw new Error('The bridge snapshot has an invalid report collection or state.')
      return data as Snapshot
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Bridge request failed')) throw error
      if (error instanceof Error && error.message.startsWith('The ')) throw error
      throw new Error(
        'Bridge unavailable or request cancelled. Check its address, certificate, allowed origin and browser local-network permission.',
      )
    } finally {
      window.clearTimeout(timeout)
      signal.removeEventListener('abort', abort)
    }
  }
  return {
    origin: base,
    state: (signal: AbortSignal) => request('state', signal),
    control: (action: 'start' | 'stop', signal: AbortSignal) => request(action, signal),
  }
}
