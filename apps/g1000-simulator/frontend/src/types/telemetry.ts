export type TelemetrySnapshot = {
  position: {
    latitude_deg: number
    longitude_deg: number
    altitude_ft: number
  }
  attitude: {
    heading_deg: number
    pitch_deg: number
    roll_deg: number
    true_heading_deg?: number
    yaw_deg?: number
    slip_skid_deg?: number
    magnetic_variation_deg?: number
  }
  adc: {
    ias_kt: number
    cas_kt: number
    tas_kt: number
    pressure_altitude_ft: number
    density_altitude_ft: number
    vertical_speed_fpm: number
    oat_c: number
  }
  velocity: {
    airspeed_kt: number
    vertical_speed_fpm: number
    turn_rate_dps: number
  }
  targets: {
    heading_deg: number
    altitude_ft: number
    airspeed_kt: number
  }
  timestamp: number
}

export type TelemetryUpdate = {
  position?: Partial<TelemetrySnapshot['position']>
  attitude?: Partial<TelemetrySnapshot['attitude']>
  adc?: Partial<TelemetrySnapshot['adc']>
  velocity?: Partial<TelemetrySnapshot['velocity']>
  targets?: Partial<TelemetrySnapshot['targets']>
  timestamp?: number
}
