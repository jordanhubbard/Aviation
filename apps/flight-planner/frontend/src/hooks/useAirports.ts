import { useQuery, UseQueryResult } from '@tanstack/react-query'
import { airportService } from '../services'
import type { Airport } from '../types'

export function useAirportSearch(query: string): UseQueryResult<Airport[], Error> {
  return useQuery({
    queryKey: ['airports', 'search', query],
    queryFn: () => airportService.search(query),
    enabled: !!query && query.length >= 2,
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
  })
}

export function useAirportDetails(icao: string): UseQueryResult<Airport, Error> {
  return useQuery({
    queryKey: ['airports', 'details', icao],
    queryFn: () => airportService.getDetails(icao),
    enabled: !!icao,
    staleTime: 30 * 60 * 1000, // 30 minutes
    retry: 1,
  })
}
