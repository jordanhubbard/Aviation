import { useQuery, UseQueryResult } from 'react-query'
import { weatherService } from '../services'
import type { ForecastResponse } from '../types'

export function useForecast(airport: string, days = 3): UseQueryResult<ForecastResponse, Error> {
  return useQuery(['forecast', airport, days], () => weatherService.getForecast(airport, days), {
    enabled: !!airport && airport.length >= 3,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })
}
