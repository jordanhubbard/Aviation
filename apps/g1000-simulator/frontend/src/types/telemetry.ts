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
  velocity?: Partial<TelemetrySnapshot['velocity']>
  targets?: Partial<TelemetrySnapshot['targets']>
  timestamp?: number
}
