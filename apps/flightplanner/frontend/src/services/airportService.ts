import { apiClient } from './apiClient'
import type { Airport } from '../types'

export const airportService = {
  search: async (query: string): Promise<Airport[]> => {
    const response = await apiClient.get<Airport[]>('/airports/search', {
      params: { q: query, limit: 50 },
    })
    return response.data
  },

  getDetails: async (icao: string): Promise<Airport> => {
    const response = await apiClient.get<Airport>(`/airports/${icao}`)
    return response.data
  },
}
