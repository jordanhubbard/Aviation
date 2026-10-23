export interface FlightData {
  airspeed: number
  altitude: number
  vsi: number
  pitch: number
  roll: number
  heading: number
}

export interface TapeConfig {
  min: number
  max: number
  step: number
}

export interface AttitudeData {
  pitch: number
  roll: number
}

export interface CompassData {
  heading: number
  track?: number
}
