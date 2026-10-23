import { apiClient } from './apiClient'
import type { TerrainProfileResponse } from '../types'

export const terrainService = {
  async getProfile(
    points: Array<[number, number]>,
    demtype = 'SRTMGL1',
  ): Promise<TerrainProfileResponse> {
    const resp = await apiClient.post<TerrainProfileResponse>('/terrain/profile', {
      points,
      demtype,
    })
    return resp.data
  },
}
