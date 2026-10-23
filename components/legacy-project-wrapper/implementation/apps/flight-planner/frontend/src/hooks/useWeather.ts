import { useQuery, UseQueryResult } from '@tanstack/react-query'
import { weatherService } from '../services'
import type { WeatherData } from '../types'

export function useWeather(airport: string): UseQueryResult<WeatherData, Error> {
  return useQuery({
    queryKey: ['weather', airport],
    queryFn: () => weatherService.getWeather(airport),
    enabled: !!airport && airport.length >= 3,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  })
}
