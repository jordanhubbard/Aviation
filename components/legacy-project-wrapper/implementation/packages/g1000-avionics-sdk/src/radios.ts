import { normalizeHeading, normalizeSignedAngle } from './devices'

const EARTH_RADIUS_NM = 3440.065
const ADF_TUNING_TOLERANCE_KHZ = 0.5
const DME_TUNING_TOLERANCE_MHZ = 0.005

export interface AdfStation {
  station_ident: string
  station_name: string
  frequency_khz: number
  latitude_deg: number
  longitude_deg: number
  max_range_nm: number
}

export interface DmeStation {
  station_ident: string
  station_name: string
  frequency_mhz: number
  latitude_deg: number
  longitude_deg: number
  elevation_ft: number
  max_range_nm: number
}

export interface AdfInput {
  latitude_deg: number
  longitude_deg: number
  heading_deg: number
  tuned_frequency_khz: number
  stations: readonly AdfStation[]
}

export interface DmeInput {
  latitude_deg: number
  longitude_deg: number
  altitude_ft: number
  track_deg: number
  ground_speed_kt: number
  tuned_frequency_mhz: number
  stations: readonly DmeStation[]
}

export interface AdfSolution {
  tuned_frequency_khz: number
  station_ident: string
  station_name: string
  bearing_deg: number
  relative_bearing_deg: number
  distance_nm: number
  signal_strength: number
  receiving: boolean
}

export interface DmeSolution {
  tuned_frequency_mhz: number
  station_ident: string
  station_name: string
  slant_range_nm: number
  ground_speed_kt: number
  signal_strength: number
  receiving: boolean
}

const finite = (name: string, value: number): number => {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`)
  return value
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.max(minimum, Math.min(maximum, value))

const validatePosition = (latitudeDeg: number, longitudeDeg: number): void => {
  finite('latitude_deg', latitudeDeg)
  finite('longitude_deg', longitudeDeg)
  if (latitudeDeg < -90 || latitudeDeg > 90) throw new RangeError('latitude_deg out of range')
  if (longitudeDeg < -180 || longitudeDeg > 180) throw new RangeError('longitude_deg out of range')
}

const validateStationIdentity = (ident: string, name: string): void => {
  if (typeof ident !== 'string' || !ident.trim()) throw new RangeError('station_ident is required')
  if (typeof name !== 'string' || !name.trim()) throw new RangeError('station_name is required')
}

const validateServiceVolume = (rangeNm: number): number => {
  const value = finite('max_range_nm', rangeNm)
  if (value <= 0) throw new RangeError('max_range_nm must be positive')
  return value
}

export const greatCircleDistanceNm = (
  fromLatitudeDeg: number,
  fromLongitudeDeg: number,
  toLatitudeDeg: number,
  toLongitudeDeg: number,
): number => {
  validatePosition(fromLatitudeDeg, fromLongitudeDeg)
  validatePosition(toLatitudeDeg, toLongitudeDeg)
  const latitude1 = fromLatitudeDeg * Math.PI / 180
  const latitude2 = toLatitudeDeg * Math.PI / 180
  const deltaLatitude = latitude2 - latitude1
  const deltaLongitude = (toLongitudeDeg - fromLongitudeDeg) * Math.PI / 180
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(deltaLongitude / 2) ** 2
  return EARTH_RADIUS_NM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)))
}

export const initialBearingDeg = (
  fromLatitudeDeg: number,
  fromLongitudeDeg: number,
  toLatitudeDeg: number,
  toLongitudeDeg: number,
): number => {
  validatePosition(fromLatitudeDeg, fromLongitudeDeg)
  validatePosition(toLatitudeDeg, toLongitudeDeg)
  const latitude1 = fromLatitudeDeg * Math.PI / 180
  const latitude2 = toLatitudeDeg * Math.PI / 180
  const deltaLongitude = (toLongitudeDeg - fromLongitudeDeg) * Math.PI / 180
  const y = Math.sin(deltaLongitude) * Math.cos(latitude2)
  const x = Math.cos(latitude1) * Math.sin(latitude2)
    - Math.sin(latitude1) * Math.cos(latitude2) * Math.cos(deltaLongitude)
  return normalizeHeading(Math.atan2(y, x) * 180 / Math.PI)
}

const signalStrength = (distanceNm: number, maxRangeNm: number): number =>
  clamp(1 - (distanceNm / maxRangeNm) ** 2, 0, 1)

const unavailableAdf = (frequencyKhz: number): AdfSolution => ({
  tuned_frequency_khz: frequencyKhz,
  station_ident: '',
  station_name: '',
  bearing_deg: 0,
  relative_bearing_deg: 0,
  distance_nm: 0,
  signal_strength: 0,
  receiving: false,
})

const unavailableDme = (frequencyMhz: number): DmeSolution => ({
  tuned_frequency_mhz: frequencyMhz,
  station_ident: '',
  station_name: '',
  slant_range_nm: 0,
  ground_speed_kt: 0,
  signal_strength: 0,
  receiving: false,
})

export const computeAdf = (input: AdfInput): AdfSolution => {
  validatePosition(input.latitude_deg, input.longitude_deg)
  const heading = normalizeHeading(input.heading_deg)
  const frequency = finite('tuned_frequency_khz', input.tuned_frequency_khz)
  if (frequency <= 0) throw new RangeError('tuned_frequency_khz must be positive')
  let selected: { station: AdfStation; distance: number } | undefined

  for (const station of input.stations) {
    validateStationIdentity(station.station_ident, station.station_name)
    validatePosition(station.latitude_deg, station.longitude_deg)
    const stationFrequency = finite('frequency_khz', station.frequency_khz)
    const maxRange = validateServiceVolume(station.max_range_nm)
    if (stationFrequency <= 0) throw new RangeError('frequency_khz must be positive')
    if (Math.abs(stationFrequency - frequency) > ADF_TUNING_TOLERANCE_KHZ) continue
    const distance = greatCircleDistanceNm(
      input.latitude_deg,
      input.longitude_deg,
      station.latitude_deg,
      station.longitude_deg,
    )
    if (distance >= maxRange) continue
    if (!selected || distance < selected.distance
      || (distance === selected.distance && station.station_ident < selected.station.station_ident)) {
      selected = { station, distance }
    }
  }

  if (!selected) return unavailableAdf(frequency)
  const bearing = initialBearingDeg(
    input.latitude_deg,
    input.longitude_deg,
    selected.station.latitude_deg,
    selected.station.longitude_deg,
  )
  return {
    tuned_frequency_khz: frequency,
    station_ident: selected.station.station_ident,
    station_name: selected.station.station_name,
    bearing_deg: bearing,
    relative_bearing_deg: normalizeSignedAngle(bearing - heading),
    distance_nm: selected.distance,
    signal_strength: signalStrength(selected.distance, selected.station.max_range_nm),
    receiving: true,
  }
}

export const computeDme = (input: DmeInput): DmeSolution => {
  validatePosition(input.latitude_deg, input.longitude_deg)
  const altitude = finite('altitude_ft', input.altitude_ft)
  const track = normalizeHeading(input.track_deg)
  const groundSpeed = Math.max(0, finite('ground_speed_kt', input.ground_speed_kt))
  const frequency = finite('tuned_frequency_mhz', input.tuned_frequency_mhz)
  if (frequency <= 0) throw new RangeError('tuned_frequency_mhz must be positive')
  let selected: { station: DmeStation; slantRange: number; bearing: number } | undefined

  for (const station of input.stations) {
    validateStationIdentity(station.station_ident, station.station_name)
    validatePosition(station.latitude_deg, station.longitude_deg)
    const stationFrequency = finite('frequency_mhz', station.frequency_mhz)
    finite('elevation_ft', station.elevation_ft)
    const maxRange = validateServiceVolume(station.max_range_nm)
    if (stationFrequency <= 0) throw new RangeError('frequency_mhz must be positive')
    if (Math.abs(stationFrequency - frequency) > DME_TUNING_TOLERANCE_MHZ) continue
    const horizontalDistance = greatCircleDistanceNm(
      input.latitude_deg,
      input.longitude_deg,
      station.latitude_deg,
      station.longitude_deg,
    )
    const verticalDistance = (altitude - station.elevation_ft) / 6076.11548556
    const slantRange = Math.hypot(horizontalDistance, verticalDistance)
    if (slantRange >= maxRange) continue
    const bearing = initialBearingDeg(
      input.latitude_deg,
      input.longitude_deg,
      station.latitude_deg,
      station.longitude_deg,
    )
    if (!selected || slantRange < selected.slantRange
      || (slantRange === selected.slantRange && station.station_ident < selected.station.station_ident)) {
      selected = { station, slantRange, bearing }
    }
  }

  if (!selected) return unavailableDme(frequency)
  const stationRelativeGroundSpeed = Math.abs(
    groundSpeed * Math.cos(normalizeSignedAngle(selected.bearing - track) * Math.PI / 180),
  )
  return {
    tuned_frequency_mhz: frequency,
    station_ident: selected.station.station_ident,
    station_name: selected.station.station_name,
    slant_range_nm: selected.slantRange,
    ground_speed_kt: stationRelativeGroundSpeed,
    signal_strength: signalStrength(selected.slantRange, selected.station.max_range_nm),
    receiving: true,
  }
}
