export interface WeatherData {
  airport: string
  conditions: string
  temperature: number
  wind_speed: number
  wind_direction: number
  visibility: number
  ceiling: number
  metar: string

  flight_category?: 'VFR' | 'MVFR' | 'IFR' | 'LIFR' | 'UNKNOWN' | null
  recommendation?: string | null
  warnings?: string[]
}

export type FlightCategory = 'VFR' | 'MVFR' | 'IFR' | 'LIFR' | 'UNKNOWN'

export interface DepartureWindow {
  start_time: string
  end_time: string
  score: number
  flight_category: FlightCategory
}

export interface WeatherRecommendationsResponse {
  airport: string
  current_category: FlightCategory
  recommendation: string
  warnings: string[]
  best_departure_windows: DepartureWindow[]
}

export interface DailyForecast {
  date: string
  temp_max_f: number | null
  temp_min_f: number | null
  precipitation_mm: number | null
  wind_speed_max_kt: number | null
}

export interface ForecastResponse {
  airport: string
  days: number
  daily: DailyForecast[]
}

export interface RouteWeatherPoint {
  latitude: number
  longitude: number
  temperature_f?: number | null
  wind_speed_kt?: number | null
  wind_direction?: number | null
  time?: string | null
}

export interface RouteWeatherResponse {
  points: RouteWeatherPoint[]
}
