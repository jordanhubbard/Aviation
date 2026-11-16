import { useEffect } from 'react'
import { MapContainer, GeoJSON, TileLayer, useMap } from 'react-leaflet'
import type { GeoJsonObject, Geometry } from 'geojson'
import 'leaflet/dist/leaflet.css'

// Keep antimeridian geometry adjacent in the display's longitude world copy.
function displayed(value: unknown, anchor: number): unknown {
  if (Array.isArray(value)) {
    if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number')
      return [anchor + ((value[0] - anchor + 540) % 360) - 180, ...value.slice(1)]
    return value.map((v) => displayed(v, anchor))
  }
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        k === 'coordinates' || k === 'geometries' ? displayed(v, anchor) : v,
      ]),
    )
  return value
}
function Fit({ route }: { route: Geometry }) {
  const map = useMap()
  useEffect(() => {
    if (route.type === 'LineString')
      map.fitBounds(
        route.coordinates.map((p) => [p[1], p[0]]),
        { padding: [20, 20] },
      )
  }, [map, route])
  return null
}
export default function AssessmentMap({
  route,
  findings,
}: {
  route: Geometry
  findings: { id: string; geometry: Geometry }[]
}) {
  const anchor = route.type === 'LineString' ? route.coordinates[0][0] : 0
  const line = displayed(route, anchor) as Geometry
  const unique = [...new Map(findings.map((f) => [f.id, f])).values()]
  return (
    <MapContainer style={{ height: 440, width: '100%', zIndex: 0 }} center={[30, -98]} zoom={7}>
      <TileLayer
        attribution="© OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {unique.map((f) => (
        <GeoJSON
          key={f.id}
          data={displayed(f.geometry, anchor) as GeoJsonObject}
          style={{ color: '#b54708', weight: 1.5, fillOpacity: 0.03 }}
        />
      ))}
      <GeoJSON data={line as GeoJsonObject} style={{ color: '#1565c0', weight: 4 }} />
      <Fit route={line} />
    </MapContainer>
  )
}
