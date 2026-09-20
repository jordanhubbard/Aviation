import { useQuery, UseQueryResult } from '@tanstack/react-query'
import { weatherService } from '../services'
import type { WeatherRecommendationsResponse } from '../types'

export function useWeatherRecommendations(
  airport: string,
): UseQueryResult<WeatherRecommendationsResponse, Error> {
  return useQuery({
    queryKey: ['weather-recommendations', airport],
    queryFn: () => weatherService.getRecommendations(airport),
    enabled: !!airport && airport.length >= 3,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })
}
