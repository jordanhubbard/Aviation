import React, { useMemo } from 'react'
import { Box, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { MapContainer, TileLayer, Circle, CircleMarker, GeoJSON, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Feature, GeoJsonObject, GeoJsonProperties } from 'geojson'

import type { Airport, GeoJsonFeatureCollection } from '../types'

type Props = {
  airport: Airport
  radiusNm?: number
  airspace?: GeoJsonFeatureCollection | null
}

const nmToMeters = (nm: number) => nm * 1852

const FitToCircle: React.FC<{ center: [number, number]; radiusM: number }> = ({
  center,
  radiusM,
}) => {
  const map = useMap()

  React.useEffect(() => {
    const bounds = L.circle(L.latLng(center[0], center[1]), { radius: radiusM }).getBounds()
    map.fitBounds(bounds.pad(0.15), { animate: true })
  }, [map, center, radiusM])

  return null
}

const CLASS_COLORS: Record<string, string> = {
  A: '#8e24aa',
  B: '#6a1b9a',
  C: '#1976d2',
  D: '#0288d1',
  E: '#2e7d32',
  G: '#f9a825',
}

const styleForFeature = (feature?: Feature) => {
  const props = (feature?.properties ?? {}) as GeoJsonProperties
  const rawClass = (props?.icaoClass ?? props?.class ?? props?.category) as string | undefined
  const cls = (rawClass ?? '').toString().toUpperCase()
  const color = CLASS_COLORS[cls] ?? '#ff6f00'
  return {
    color,
    weight: 2,
    opacity: 0.9,
    fillColor: color,
    fillOpacity: 0.15,
  }
}

const AirportAirspaceMap: React.FC<Props> = ({ airport, radiusNm = 20, airspace }) => {
  const theme = useTheme()
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'))

  const center = useMemo<[number, number]>(
    () => [airport.latitude, airport.longitude],
    [airport.latitude, airport.longitude],
  )

  const radiusM = useMemo(() => nmToMeters(radiusNm), [radiusNm])

  const geoJson: GeoJsonFeatureCollection = airspace ?? { type: 'FeatureCollection', features: [] }

  return (
    <Box
      sx={{
        height: { xs: 280, sm: 360, md: 420 },
        borderRadius: 1,
        overflow: 'hidden',
        border: 1,
        borderColor: 'divider',
      }}
    >
      <MapContainer
        center={[center[0], center[1]]}
        zoom={10}
        scrollWheelZoom={!isSmall}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitToCircle center={center} radiusM={radiusM} />

        <Circle
          center={[center[0], center[1]]}
          radius={radiusM}
          pathOptions={{ color: '#1976d2' }}
        />

        <CircleMarker
          center={[center[0], center[1]]}
          radius={8}
          pathOptions={{ color: '#2e7d32' }}
        />

        {geoJson.features.length ? (
          <GeoJSON
            data={geoJson as unknown as GeoJsonObject}
            style={styleForFeature}
            onEachFeature={(feature, layer) => {
              const props = (feature?.properties ?? {}) as GeoJsonProperties
              const name = String(props?.name ?? props?.id ?? 'Airspace')
              const cls = String(props?.icaoClass ?? props?.class ?? '')
              const typ = String(props?.type ?? '')
              const parts = [name, cls ? `Class ${cls}` : null, typ || null].filter(Boolean)
              layer.bindPopup(parts.join(' — '))
            }}
          />
        ) : null}
      </MapContainer>
    </Box>
  )
}

export default React.memo(AirportAirspaceMap)
