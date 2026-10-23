export type GeoJsonGeometry = {
  type: string
  coordinates: unknown
}

export type GeoJsonFeature = {
  type: 'Feature'
  geometry: GeoJsonGeometry | null
  properties?: Record<string, unknown>
}

export type GeoJsonFeatureCollection = {
  type: 'FeatureCollection'
  features: GeoJsonFeature[]
}
