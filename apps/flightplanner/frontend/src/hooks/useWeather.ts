import { useQuery, UseQueryResult } from 'react-query'
import { weatherService } from '../services'
import type { WeatherData } from '../types'

export function useWeather(airport: string): UseQueryResult<WeatherData, Error> {
  return useQuery(['weather', airport], () => weatherService.getWeather(airport), {
    enabled: !!airport && airport.length >= 3,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  })
}
