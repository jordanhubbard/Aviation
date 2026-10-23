import axios, { AxiosResponse } from 'axios'

// Type definitions for API responses
interface LogbookData {
  entries: LogbookEntry[]
  stats: LogbookStats
  all_time: LogbookStats
  recent_experience: LogbookStats
  aircraft_stats: AircraftStat[]
  logbook_filename: string | null
  error_count: number
  student_pilot?: boolean
}

interface LogbookEntry {
  date: string
  aircraft: {
    registration: string
    type: string
    icao_type_code?: string | null  // ICAO aircraft type designator (e.g., CH7A, C172)
    category_class: string
  }
  departure: { identifier: string | null }
  destination: { identifier: string | null }
  route: string
  total_time: number
  pic_time: number
  dual_received: number
  solo_time: number
  ground_training: number | null
  night_time: number | null
  conditions: {
    day: number
    night: number
    cross_country: number
    simulated_instrument: number
    actual_instrument: number
  }
  landings_day: number
  landings_night: number
  pilot_role: string
  remarks: string | null
  running_totals: {
    total_time: number
    pic_time: number
    dual_received: number
    cross_country: number
    day_time: number
    night_time: number
    sim_instrument: number
  }
  error_explanation: string | null
  warning_explanation: string | null
}

interface LogbookStats {
  total_time: number
  total_hours: number
  total_pic: number
  total_dual: number
  total_night: number
  total_cross_country: number
  total_sim_instrument: number
  total_landings: number
  total_time_asel: number
  total_time_tailwheel: number
  total_time_complex: number
  total_time_high_performance: number
}

interface AircraftStat {
  registration: string
  type: string
  total_time: number
  flights: number
}

// Create axios instance with default config
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

export const logbookService = {
  async processLogbook(file: File, isStudentPilot: boolean): Promise<LogbookData> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('student_pilot', isStudentPilot ? 'true' : 'false')

    const response: AxiosResponse<LogbookData> = await api.post('/process-logbook', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })

    return response.data
  },
}

export default logbookService

// Export types for use in other components
export type {
  LogbookData,
  LogbookEntry,
  LogbookStats,
  AircraftStat,
}
