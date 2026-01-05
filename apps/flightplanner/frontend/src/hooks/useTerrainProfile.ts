import { useQuery, UseQueryResult } from 'react-query'
import { terrainService } from '../services'
import type { TerrainProfileResponse } from '../types'

export function useTerrainProfile(
  points: Array<[number, number]>,
): UseQueryResult<TerrainProfileResponse, Error> {
  return useQuery(['terrain-profile', points], () => terrainService.getProfile(points), {
    enabled: points.length >= 2,
    staleTime: 10 * 60 * 1000,
    retry: 0,
  })
}
