export type PlanMode = 'local' | 'route'

export type SpeedUnit = 'knots' | 'mph'

export interface Segment {
  start: [number, number]
  end: [number, number]
  type: 'climb' | 'cruise' | 'descent'
  vfr_altitude: number
}

export interface RouteLeg {
  from_code: string
  to_code: string
  distance_nm: number
  groundspeed_kt: number
  ete_minutes: number
  depart_time_utc?: string | null
  arrive_time_utc?: string | null
  type?: 'climb' | 'cruise' | 'descent' | null
  vfr_altitude?: number | null
  refuel_minutes: number
  elapsed_minutes: number
  fuel_stop: boolean
}

export interface AlternateWeather {
  metar?: string | null
  visibility_sm?: number | null
  ceiling_ft?: number | null
  wind_speed_kt?: number | null
  wind_direction_deg?: number | null
  temperature_f?: number | null
}

export interface AlternateAirport {
  code: string
  name?: string | null
  type?: string | null
  distance_nm: number
  weather?: AlternateWeather | null
}

export interface FlightPlan {
  planned_at_utc?: string | null
  departure_time_utc?: string | null
  arrival_time_utc?: string | null
  route: string[]
  distance_nm: number
  time_hr: number
  origin_coords: [number, number]
  destination_coords: [number, number]
  segments: Segment[]

  legs?: RouteLeg[] | null

  alternates?: AlternateAirport[] | null

  fuel_stops?: string[] | null
  fuel_burn_gph?: number | null
  reserve_minutes?: number | null
  fuel_required_gal?: number | null
  fuel_required_with_reserve_gal?: number | null

  wind_speed_kt?: number | null
  wind_direction_deg?: number | null
  headwind_kt?: number | null
  crosswind_kt?: number | null
  groundspeed_kt?: number | null
}

export type RoutePlanRequest = {
  mode: 'route'
  origin: string
  destination: string
  speed: number
  speed_unit: SpeedUnit
  altitude: number
  avoid_airspaces?: boolean
  avoid_terrain?: boolean
  include_alternates?: boolean

  plan_fuel_stops?: boolean
  aircraft_range_nm?: number
  max_leg_distance?: number
  fuel_on_board_gal?: number
  fuel_burn_gph?: number
  reserve_minutes?: number
  fuel_strategy?: 'time' | 'economy'
  apply_wind?: boolean
}

export type LocalPlanRequest = {
  mode: 'local'
  airport: string
  radius_nm?: number
}

export interface LocalAirportSummary {
  icao: string
  iata: string
  name?: string | null
  city: string
  country: string
  latitude: number
  longitude: number
  elevation?: number | null
  type: string
}

export interface NearbyAirport extends LocalAirportSummary {
  distance_nm: number
}

export interface LocalPlanResponse {
  planned_at_utc?: string | null
  airport: string
  radius_nm: number
  center: LocalAirportSummary
  nearby_airports: NearbyAirport[]
}

export type FlightPlanRequest = RoutePlanRequest | LocalPlanRequest
