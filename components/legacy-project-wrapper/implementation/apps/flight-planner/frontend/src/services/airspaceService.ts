import { apiClient } from './apiClient'
import type { GeoJsonFeatureCollection } from '../types'

export const airspaceService = {
  getNearby: async (params: {
    lat: number
    lon: number
    radiusNm?: number
    limit?: number
  }): Promise<GeoJsonFeatureCollection> => {
    const response = await apiClient.get<GeoJsonFeatureCollection>('/airspace/nearby', {
      params: {
        lat: params.lat,
        lon: params.lon,
        radius_nm: params.radiusNm ?? 20,
        limit: params.limit ?? 250,
      },
    })
    return response.data
  },
}
