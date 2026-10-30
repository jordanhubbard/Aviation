export interface AhrsInput {
  heading_deg: number
  pitch_deg: number
  roll_deg: number
  turn_rate_dps: number
  airspeed_kt: number
  latitude_deg: number
  longitude_deg: number
}

export interface AhrsSolution {
  heading_deg: number
  pitch_deg: number
  roll_deg: number
  yaw_deg: number
  true_heading_deg: number
  magnetic_heading_deg: number
  magnetic_variation_deg: number
  slip_skid_deg: number
}

export interface AdcInput {
  altitude_ft: number
  airspeed_kt: number
  vertical_speed_fpm: number
  altimeter_setting_inhg?: number
  temperature_offset_c?: number
}

export interface AdcSolution {
  ias_kt: number
  cas_kt: number
  tas_kt: number
  pressure_altitude_ft: number
  density_altitude_ft: number
  vertical_speed_fpm: number
  oat_c: number
}

export interface GpsInput {
  latitude_deg: number
  longitude_deg: number
  altitude_ft: number
  ground_speed_kt: number
  track_deg: number
  timestamp: number
}

export interface GpsSolution {
  latitude_deg: number
  longitude_deg: number
  altitude_ft: number
  ground_speed_kt: number
  track_deg: number
  waas_available: boolean
  waas_enabled: boolean
  raim_available: boolean
  raim_ok: boolean
  fix_valid: boolean
  horizontal_accuracy_m: number
  vertical_accuracy_m: number
}

const finite = (name: string, value: number): number => {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`)
  return value
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.max(minimum, Math.min(maximum, value))

export const normalizeHeading = (heading: number): number =>
  ((finite('heading_deg', heading) % 360) + 360) % 360

export const normalizeSignedAngle = (angle: number): number => {
  const wrapped = ((finite('angle', angle) + 180) % 360 + 360) % 360 - 180
  return wrapped === -180 ? 180 : wrapped
}

export const estimateMagneticVariation = (
  latitudeDeg: number,
  longitudeDeg: number,
): number => {
  finite('latitude_deg', latitudeDeg)
  finite('longitude_deg', longitudeDeg)
  if (latitudeDeg < -90 || latitudeDeg > 90) throw new RangeError('latitude_deg out of range')
  if (longitudeDeg < -180 || longitudeDeg > 180) throw new RangeError('longitude_deg out of range')
  return clamp(longitudeDeg * 0.1, -30, 30)
}

export const computeAhrs = (input: AhrsInput): AhrsSolution => {
  const trueHeading = normalizeHeading(input.heading_deg)
  const pitch = normalizeSignedAngle(input.pitch_deg)
  const roll = normalizeSignedAngle(input.roll_deg)
  const variation = estimateMagneticVariation(input.latitude_deg, input.longitude_deg)
  const speedMps = Math.max(finite('airspeed_kt', input.airspeed_kt) * 0.514444, 1)
  const coordinatedTurnRate = 180 / Math.PI * 9.80665 * Math.tan(roll * Math.PI / 180) / speedMps
  const slipSkid = clamp(finite('turn_rate_dps', input.turn_rate_dps) - coordinatedTurnRate, -10, 10)
  return {
    heading_deg: normalizeHeading(trueHeading - variation),
    pitch_deg: pitch,
    roll_deg: roll,
    yaw_deg: trueHeading,
    true_heading_deg: trueHeading,
    magnetic_heading_deg: normalizeHeading(trueHeading - variation),
    magnetic_variation_deg: variation,
    slip_skid_deg: slipSkid,
  }
}

export const standardTemperatureC = (altitudeFt: number): number =>
  15 - 0.0019812 * finite('altitude_ft', altitudeFt)

export const computeAdc = (input: AdcInput): AdcSolution => {
  const altitude = finite('altitude_ft', input.altitude_ft)
  const airspeed = Math.max(0, finite('airspeed_kt', input.airspeed_kt))
  const verticalSpeed = finite('vertical_speed_fpm', input.vertical_speed_fpm)
  const altimeter = finite('altimeter_setting_inhg', input.altimeter_setting_inhg ?? 29.92)
  const temperatureOffset = finite('temperature_offset_c', input.temperature_offset_c ?? 0)
  if (altimeter <= 0) throw new RangeError('altimeter_setting_inhg must be positive')
  const pressureAltitude = altitude + (29.92 - altimeter) * 1000
  const standardTemperature = standardTemperatureC(pressureAltitude)
  const oat = standardTemperature + temperatureOffset
  const densityBase = clamp(1 - 0.0000068756 * pressureAltitude, 0.1, 1)
  const densityRatio = densityBase ** 4.2561
  return {
    ias_kt: airspeed,
    cas_kt: airspeed,
    tas_kt: airspeed / Math.sqrt(Math.max(densityRatio, 0.1)),
    pressure_altitude_ft: pressureAltitude,
    density_altitude_ft: pressureAltitude + 120 * temperatureOffset,
    vertical_speed_fpm: verticalSpeed,
    oat_c: oat,
  }
}

export const isWaasAvailable = (latitudeDeg: number, longitudeDeg: number): boolean =>
  latitudeDeg >= 15 && latitudeDeg <= 55 && longitudeDeg >= -130 && longitudeDeg <= -60

export const computeGps = (input: GpsInput): GpsSolution => {
  const latitude = finite('latitude_deg', input.latitude_deg)
  const longitude = finite('longitude_deg', input.longitude_deg)
  const altitude = finite('altitude_ft', input.altitude_ft)
  const timestamp = finite('timestamp', input.timestamp)
  if (latitude < -90 || latitude > 90) throw new RangeError('latitude_deg out of range')
  if (longitude < -180 || longitude > 180) throw new RangeError('longitude_deg out of range')
  const waasAvailable = isWaasAvailable(latitude, longitude)
  const waasEnabled = waasAvailable
  const raimAvailable = true
  const raimOk = ((Math.floor(timestamp) % 300) + 300) % 300 >= 15
  const multiplier = raimOk ? 1 : 4
  const horizontalAccuracy = (waasEnabled ? 3 : 15) * multiplier
  const verticalAccuracy = (waasEnabled ? 5 : 25) * multiplier
  const horizontalErrorNm = horizontalAccuracy / 1852
  const angle = (timestamp * 0.35) % (2 * Math.PI)
  const latitudeRad = latitude * Math.PI / 180
  const deltaLatitude = horizontalErrorNm * Math.cos(angle) / 60
  const deltaLongitude = horizontalErrorNm * Math.sin(angle) /
    Math.max(1e-6, 60 * Math.cos(latitudeRad))
  const verticalErrorFt = verticalAccuracy / 0.3048 * Math.sin(timestamp * 0.15)
  return {
    latitude_deg: latitude + deltaLatitude,
    longitude_deg: longitude + deltaLongitude,
    altitude_ft: altitude + verticalErrorFt,
    ground_speed_kt: Math.max(0, finite('ground_speed_kt', input.ground_speed_kt)),
    track_deg: normalizeHeading(input.track_deg),
    waas_available: waasAvailable,
    waas_enabled: waasEnabled,
    raim_available: raimAvailable,
    raim_ok: raimOk,
    fix_valid: raimOk,
    horizontal_accuracy_m: horizontalAccuracy,
    vertical_accuracy_m: verticalAccuracy,
  }
}
