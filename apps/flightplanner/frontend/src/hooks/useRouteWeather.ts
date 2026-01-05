import { useMemo } from 'react'
import { useQuery, UseQueryResult } from 'react-query'
import { weatherService } from '../services'
import type { RouteWeatherResponse } from '../types'

export function useRouteWeather(
  points: Array<[number, number]>,
  maxPoints = 10,
  enabled = true,
): UseQueryResult<RouteWeatherResponse, Error> {
  const pointsKey = useMemo(() => points.map((p) => p.join(',')).join('|'), [points])

  return useQuery(
    ['routeWeather', pointsKey, maxPoints],
    () => weatherService.getRouteWeather(points, maxPoints),
    {
      enabled: enabled && points.length > 1,
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  )
}
