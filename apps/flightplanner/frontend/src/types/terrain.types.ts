export interface TerrainProfilePoint {
  latitude: number
  longitude: number
  elevation_ft: number | null
}

export interface TerrainProfileResponse {
  demtype: string
  points: TerrainProfilePoint[]
}
