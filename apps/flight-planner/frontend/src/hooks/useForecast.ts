import { useQuery, UseQueryResult } from '@tanstack/react-query'
import { weatherService } from '../services'
import type { ForecastResponse } from '../types'

export function useForecast(airport: string, days = 3): UseQueryResult<ForecastResponse, Error> {
  return useQuery({
    queryKey: ['forecast', airport, days],
    queryFn: () => weatherService.getForecast(airport, days),
    enabled: !!airport && airport.length >= 3,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })
}
