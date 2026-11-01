import { greatCircleDistanceNm } from './radios'

export interface RadioState {
  kind: 'COM' | 'NAV'
  active_frequency_mhz: number
  standby_frequency_mhz: number
  volume: number
  receive: boolean
  transmit: boolean
}

export interface RadioTransition {
  active_frequency_mhz?: number
  standby_frequency_mhz?: number
  volume?: number
  receive?: boolean
  transmit?: boolean
  swap?: boolean
}

export interface AudioInputState { enabled: boolean; volume: number }

export const IDENT_DURATION_SEC = 18
export const TRANSPONDER_MODES = ['OFF', 'STBY', 'A', 'C', 'S'] as const

export type TransponderMode = typeof TRANSPONDER_MODES[number]

export interface MarkerBeaconSite {
  name: string
  latitude_deg: number
  longitude_deg: number
  outer_radius_nm: number
  middle_radius_nm: number
  inner_radius_nm: number
  altitude_limit_ft: number
}

export interface MarkerBeaconStatus {
  outer_active: boolean
  middle_active: boolean
  inner_active: boolean
}

export interface AudioPanelState {
  com1_enabled: boolean
  com2_enabled: boolean
  nav1_enabled: boolean
  nav2_enabled: boolean
  adf_enabled: boolean
  marker_enabled: boolean
  speaker_enabled: boolean
  headphone_enabled: boolean
  com1_volume: number
  com2_volume: number
  nav1_volume: number
  nav2_volume: number
  adf_volume: number
  marker_volume: number
}

export interface AudioPanelStatus extends AudioPanelState {
  adf_audio_level: number
  marker_audio_level: number
  marker_outer_active: boolean
  marker_middle_active: boolean
  marker_inner_active: boolean
}

export interface TransponderState {
  mode: TransponderMode
  squawk_code: string
  ident_active: boolean
  ident_remaining_sec: number
}

export interface TransponderTransition {
  mode?: TransponderMode
  squawk_code?: string | number
  ident?: boolean
  elapsed_sec?: number
}

const finite = (name: string, value: number): number => {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`)
  return value
}

const unitInterval = (name: string, value: number): number => {
  const result = finite(name, value)
  if (result < 0 || result > 1) throw new RangeError(`${name} out of range`)
  return result
}

const booleanControl = (name: string, value: unknown): void => {
  if (typeof value !== 'boolean') throw new RangeError(`${name} must be boolean`)
}

const validateRadio = (state: RadioState): void => {
  if (state.kind !== 'COM' && state.kind !== 'NAV') throw new RangeError('invalid radio kind')
  const [minimum, maximum, spacing] = state.kind === 'COM'
    ? [118, 136.975, 0.025] : [108, 117.95, 0.05]
  for (const frequency of [state.active_frequency_mhz, state.standby_frequency_mhz]) {
    finite('frequency_mhz', frequency)
    const channel = (frequency - minimum) / spacing
    if (frequency < minimum || frequency > maximum
      || Math.abs(channel - Math.round(channel)) > 1e-7) {
      throw new RangeError('frequency_mhz must be an in-band channel')
    }
  }
  unitInterval('volume', state.volume)
  booleanControl('receive', state.receive)
  booleanControl('transmit', state.transmit)
  if (state.kind === 'NAV' && state.transmit) throw new RangeError('NAV cannot transmit')
}

export const transitionRadio = (current: RadioState, change: RadioTransition): RadioState => {
  validateRadio(current)
  const allowed = ['active_frequency_mhz', 'standby_frequency_mhz', 'volume', 'receive', 'transmit', 'swap']
  for (const key of Object.keys(change)) {
    if (!allowed.includes(key)) throw new RangeError('unknown radio control')
  }
  for (const key of ['receive', 'transmit', 'swap'] as const) {
    if (change[key] !== undefined) booleanControl(key, change[key])
  }
  if (current.kind === 'NAV' && change.transmit !== undefined) {
    throw new RangeError('NAV cannot transmit')
  }
  const next: RadioState = {
    kind: current.kind,
    active_frequency_mhz: change.active_frequency_mhz === undefined
      ? current.active_frequency_mhz : change.active_frequency_mhz,
    standby_frequency_mhz: change.standby_frequency_mhz === undefined
      ? current.standby_frequency_mhz : change.standby_frequency_mhz,
    volume: change.volume === undefined ? current.volume : change.volume,
    receive: change.receive === undefined ? current.receive : change.receive,
    transmit: change.transmit === undefined ? current.transmit : change.transmit,
  }
  validateRadio(next)
  if (change.swap) {
    [next.active_frequency_mhz, next.standby_frequency_mhz] =
      [next.standby_frequency_mhz, next.active_frequency_mhz]
  }
  return next
}

export const transitionAudioInput = (
  current: AudioInputState, change: Partial<AudioInputState>,
): AudioInputState => {
  booleanControl('enabled', current.enabled)
  unitInterval('volume', current.volume)
  if (Object.keys(change).some(key => key !== 'enabled' && key !== 'volume')) {
    throw new RangeError('unknown audio input control')
  }
  const next = { ...current, ...change }
  booleanControl('enabled', next.enabled)
  unitInterval('volume', next.volume)
  return next
}

export const resolveMarkerLights = (
  outer: boolean, middle: boolean, inner: boolean,
): MarkerBeaconStatus => {
  booleanControl('outer', outer)
  booleanControl('middle', middle)
  booleanControl('inner', inner)
  return { outer_active: outer && !middle && !inner, middle_active: middle && !inner, inner_active: inner }
}

const validateMarkerSite = (site: MarkerBeaconSite): void => {
  if (typeof site.name !== 'string' || !site.name.trim()) throw new RangeError('name is required')
  finite('altitude_limit_ft', site.altitude_limit_ft)
  const inner = finite('inner_radius_nm', site.inner_radius_nm)
  const middle = finite('middle_radius_nm', site.middle_radius_nm)
  const outer = finite('outer_radius_nm', site.outer_radius_nm)
  if (site.altitude_limit_ft < 0) throw new RangeError('altitude_limit_ft out of range')
  if (inner <= 0 || inner > middle || middle > outer) {
    throw new RangeError('marker radii must be positive and ordered')
  }
}

export const computeMarkerBeacons = (
  latitudeDeg: number,
  longitudeDeg: number,
  altitudeFt: number,
  sites: readonly MarkerBeaconSite[],
): MarkerBeaconStatus => {
  finite('altitude_ft', altitudeFt)
  greatCircleDistanceNm(latitudeDeg, longitudeDeg, latitudeDeg, longitudeDeg)
  let bestPriority = 0
  for (const site of sites) {
    validateMarkerSite(site)
    if (altitudeFt > site.altitude_limit_ft) continue
    const distance = greatCircleDistanceNm(
      latitudeDeg,
      longitudeDeg,
      site.latitude_deg,
      site.longitude_deg,
    )
    const priority = distance <= site.inner_radius_nm
      ? 3
      : distance <= site.middle_radius_nm
        ? 2
        : distance <= site.outer_radius_nm ? 1 : 0
    bestPriority = Math.max(bestPriority, priority)
  }
  return {
    outer_active: bestPriority === 1,
    middle_active: bestPriority === 2,
    inner_active: bestPriority === 3,
  }
}

export const computeAudioPanelStatus = (
  state: AudioPanelState,
  adfSignalStrength: number,
  markerStatus: MarkerBeaconStatus,
): AudioPanelStatus => {
  const volumes = {
    com1_volume: unitInterval('com1_volume', state.com1_volume),
    com2_volume: unitInterval('com2_volume', state.com2_volume),
    nav1_volume: unitInterval('nav1_volume', state.nav1_volume),
    nav2_volume: unitInterval('nav2_volume', state.nav2_volume),
    adf_volume: unitInterval('adf_volume', state.adf_volume),
    marker_volume: unitInterval('marker_volume', state.marker_volume),
  }
  const signal = unitInterval('adf_signal_strength', adfSignalStrength)
  const markerActive = markerStatus.outer_active
    || markerStatus.middle_active
    || markerStatus.inner_active
  return {
    ...state,
    ...volumes,
    adf_audio_level: state.adf_enabled ? volumes.adf_volume * signal : 0,
    marker_audio_level: state.marker_enabled && markerActive ? volumes.marker_volume : 0,
    marker_outer_active: markerStatus.outer_active,
    marker_middle_active: markerStatus.middle_active,
    marker_inner_active: markerStatus.inner_active,
  }
}

export const normalizeSquawk = (value: string | number | null | undefined): string | undefined => {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 0) return undefined
    value = String(value)
  }
  if (typeof value !== 'string') return undefined
  const raw = value.trim()
  if (raw.length > 4) return undefined
  const code = (`0000${raw}`).slice(-4)
  return /^[0-7]{4}$/.test(code) ? code : undefined
}

const validateTransponderState = (state: TransponderState): void => {
  if (TRANSPONDER_MODES.indexOf(state.mode) === -1) throw new RangeError('invalid transponder mode')
  if (normalizeSquawk(state.squawk_code) !== state.squawk_code) {
    throw new RangeError('invalid squawk_code')
  }
  const remaining = finite('ident_remaining_sec', state.ident_remaining_sec)
  if (remaining < 0) throw new RangeError('ident_remaining_sec out of range')
  if (state.ident_active !== (remaining > 0)) {
    throw new RangeError('IDENT state and remaining time disagree')
  }
}

export const transitionTransponder = (
  current: TransponderState,
  transition: TransponderTransition,
): TransponderState => {
  validateTransponderState(current)
  if (transition.mode !== undefined && TRANSPONDER_MODES.indexOf(transition.mode) === -1) {
    throw new RangeError('invalid transponder mode')
  }
  const elapsed = transition.elapsed_sec === undefined
    ? 0
    : finite('elapsed_sec', transition.elapsed_sec)
  if (elapsed < 0) throw new RangeError('elapsed_sec out of range')
  const squawk = transition.squawk_code === undefined
    ? current.squawk_code
    : normalizeSquawk(transition.squawk_code)
  if (!squawk) throw new RangeError('invalid squawk_code')
  let remaining = Math.max(0, current.ident_remaining_sec - elapsed)
  if (transition.ident === true) remaining = IDENT_DURATION_SEC
  if (transition.ident === false) remaining = 0
  return {
    mode: transition.mode ?? current.mode,
    squawk_code: squawk,
    ident_active: remaining > 0,
    ident_remaining_sec: remaining,
  }
}
