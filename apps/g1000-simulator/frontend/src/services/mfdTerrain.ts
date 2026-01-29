export type TerrainAlertLevel = 'normal' | 'advisory' | 'caution' | 'warning'

const ALERT_RANK: Record<TerrainAlertLevel, number> = {
  normal: 0,
  advisory: 1,
  caution: 2,
  warning: 3,
}

export const getTerrainElevation = (latitude: number, longitude: number) => {
  const wave1 = Math.sin(latitude * 0.35) * 480
  const wave2 = Math.cos(longitude * 0.22) * 520
  const wave3 = Math.sin((latitude + longitude) * 0.18) * 320
  return Math.max(0, 900 + wave1 + wave2 + wave3)
}

export const getTerrainAlertLevel = (altitudeFt: number, terrainElevationFt: number): TerrainAlertLevel => {
  const clearance = altitudeFt - terrainElevationFt
  if (clearance <= 100) return 'warning'
  if (clearance <= 300) return 'caution'
  if (clearance <= 500) return 'advisory'
  return 'normal'
}

export const terrainAlertRank = (level: TerrainAlertLevel) => ALERT_RANK[level]
