import { useQuery, UseQueryResult } from 'react-query'
import { weatherService } from '../services'
import type { WeatherRecommendationsResponse } from '../types'

export function useWeatherRecommendations(
  airport: string,
): UseQueryResult<WeatherRecommendationsResponse, Error> {
  return useQuery(
    ['weather-recommendations', airport],
    () => weatherService.getRecommendations(airport),
    {
      enabled: !!airport && airport.length >= 3,
      staleTime: 10 * 60 * 1000,
      retry: 1,
    },
  )
}
