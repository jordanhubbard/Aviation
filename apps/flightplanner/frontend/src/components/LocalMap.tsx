import React, { useMemo } from 'react'
import { Box, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { MapContainer, TileLayer, Circle, CircleMarker, Marker, Popup, useMap } from 'react-leaflet'
import { useQueries } from 'react-query'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import { useRouteWeather } from '../hooks'
import { weatherService } from '../services'
import { getRuntimeEnv } from '../utils'
import { windBarbSvg } from '../utils/windBarb'
import type { FlightCategory, LocalPlanResponse, WeatherData } from '../types'
import type { WeatherOverlayKey, WeatherOverlays } from './WeatherOverlayControls'

type Props = {
  plan: LocalPlanResponse
  overlays?: WeatherOverlays
}

const OPENWEATHER_LAYERS: Record<WeatherOverlayKey, string> = {
  clouds: 'clouds_new',
  wind: 'wind_new',
  precipitation: 'precipitation_new',
  temperature: 'temp_new',
}

const FitBounds: React.FC<{ points: Array<[number, number]> }> = ({ points }) => {
  const map = useMap()

  React.useEffect(() => {
    if (points.length < 2) return
    const bounds = L.latLngBounds(points.map(([lat, lon]) => [lat, lon]))
    map.fitBounds(bounds.pad(0.25), { animate: true })
  }, [map, points])

  return null
}

const nmToMeters = (nm: number) => nm * 1852

const CATEGORY_COLORS: Record<FlightCategory, { fill: string; stroke: string }> = {
  VFR: { fill: '#2e7d32', stroke: '#ffffff' },
  MVFR: { fill: '#1976d2', stroke: '#ffffff' },
  IFR: { fill: '#d32f2f', stroke: '#ffffff' },
  LIFR: { fill: '#8e24aa', stroke: '#ffffff' },
  UNKNOWN: { fill: '#9e9e9e', stroke: '#ffffff' },
}

const toCategory = (value: string | null | undefined): FlightCategory => {
  if (value === 'VFR' || value === 'MVFR' || value === 'IFR' || value === 'LIFR') return value
  return 'UNKNOWN'
}

const LocalMap: React.FC<Props> = ({ plan, overlays }) => {
  const theme = useTheme()
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'))

  const windBarbsEnabled = Boolean(overlays?.wind.enabled)

  const center = useMemo<[number, number]>(
    () => [plan.center.latitude, plan.center.longitude],
    [plan.center.latitude, plan.center.longitude],
  )

  const points = useMemo(() => {
    const pts: Array<[number, number]> = [center]
    for (const ap of plan.nearby_airports.slice(0, 60)) {
      pts.push([ap.latitude, ap.longitude])
    }
    return pts
  }, [center, plan.nearby_airports])

  const stationMarkers = useMemo(() => {
    const markers: Array<{ lat: number; lon: number; label: string }> = []

    markers.push({
      lat: plan.center.latitude,
      lon: plan.center.longitude,
      label: plan.center.icao || plan.center.iata,
    })

    for (const ap of plan.nearby_airports.slice(0, 20)) {
      markers.push({
        lat: ap.latitude,
        lon: ap.longitude,
        label: ap.icao || ap.iata,
      })
    }

    return markers
  }, [plan.center, plan.nearby_airports])

  const stationPoints = useMemo(
    () => stationMarkers.map((m) => [m.lat, m.lon] as [number, number]),
    [stationMarkers],
  )

  const stationLabelByKey = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of stationMarkers) {
      m.set(`${s.lat.toFixed(6)},${s.lon.toFixed(6)}`, s.label)
    }
    return m
  }, [stationMarkers])

  const stationWeather = useRouteWeather(stationPoints, stationPoints.length, windBarbsEnabled)

  const weatherStations = useMemo(() => {
    const out: Array<{ code: string; lat: number; lon: number; name?: string | null }> = []
    const seen = new Set<string>()

    const centerCode = (plan.center.icao || plan.center.iata || '').toUpperCase()
    if (centerCode) {
      out.push({
        code: centerCode,
        lat: plan.center.latitude,
        lon: plan.center.longitude,
        name: plan.center.name,
      })
      seen.add(centerCode)
    }

    for (const ap of plan.nearby_airports.slice(0, 25)) {
      const code = (ap.icao || ap.iata || '').toUpperCase()
      if (!code || seen.has(code)) continue
      out.push({ code, lat: ap.latitude, lon: ap.longitude, name: ap.name })
      seen.add(code)
    }

    return out
  }, [plan.center, plan.nearby_airports])

  const stationWeatherQueries = useQueries(
    weatherStations.map((s) => ({
      queryKey: ['weather', s.code],
      queryFn: () => weatherService.getWeather(s.code, { suppressToast: true }),
      enabled: Boolean(s.code),
      staleTime: 5 * 60 * 1000,
      retry: 0,
    })),
  ) as Array<{ data?: WeatherData }>

  const weatherByCode = useMemo(() => {
    const m = new Map<string, WeatherData>()
    for (let i = 0; i < weatherStations.length; i++) {
      const code = weatherStations[i]?.code
      const data = stationWeatherQueries[i]?.data
      if (code && data) m.set(code, data)
    }
    return m
  }, [stationWeatherQueries, weatherStations])

  const owmKey = getRuntimeEnv('VITE_OPENWEATHERMAP_API_KEY')

  const windIcon = (direction: number, speed: number, category: FlightCategory) => {
    const colors = CATEGORY_COLORS[category]
    const hasCategory = category !== 'UNKNOWN'

    return L.divIcon({
      className: '',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      html: windBarbSvg(
        direction,
        speed,
        hasCategory
          ? {
              size: 40,
              backgroundFill: colors.fill,
              backgroundStroke: colors.stroke,
            }
          : { size: 40 },
      ),
    })
  }

  return (
    <Box
      sx={{
        height: { xs: 300, sm: 400, md: 520, lg: 640 },
        borderRadius: 1,
        overflow: 'hidden',
        border: 1,
        borderColor: 'divider',
      }}
    >
      <MapContainer
        center={[center[0], center[1]]}
        zoom={9}
        scrollWheelZoom={!isSmall}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {owmKey &&
          overlays &&
          (Object.keys(overlays) as WeatherOverlayKey[]).map((key) => {
            if (!overlays[key].enabled) return null
            const layer = OPENWEATHER_LAYERS[key]
            return (
              <TileLayer
                key={key}
                url={`https://tile.openweathermap.org/map/${layer}/{z}/{x}/{y}.png?appid=${owmKey}`}
                opacity={overlays[key].opacity}
              />
            )
          })}

        <FitBounds points={points} />

        {windBarbsEnabled &&
          stationWeather.data?.points
            .filter((p) => p.wind_speed_kt != null && p.wind_direction != null)
            .map((p) => {
              const k = `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`
              const label = stationLabelByKey.get(k)
              const code = label ? label.toUpperCase() : undefined
              const weather = code ? weatherByCode.get(code) : undefined
              const category = toCategory(weather?.flight_category ?? null)
              return (
                <Marker
                  key={k}
                  position={[p.latitude, p.longitude]}
                  icon={windIcon(p.wind_direction as number, p.wind_speed_kt as number, category)}
                >
                  <Popup>
                    {label ? `${label}: ` : ''}
                    Wind: {Math.round(p.wind_speed_kt as number)} kt @ {p.wind_direction}°
                  </Popup>
                </Marker>
              )
            })}

        <Circle
          center={[center[0], center[1]]}
          radius={nmToMeters(plan.radius_nm)}
          pathOptions={{ color: '#1976d2', weight: 2 }}
        />

        <CircleMarker center={[center[0], center[1]]} radius={9} pathOptions={{ color: 'green' }}>
          <Popup>
            {plan.center.icao || plan.center.iata} — {plan.center.name || plan.center.city}
          </Popup>
        </CircleMarker>

        {plan.nearby_airports.slice(0, 60).map((ap) => {
          const code = (ap.icao || ap.iata || '').toUpperCase()
          const weather = code ? weatherByCode.get(code) : undefined
          const cat = toCategory(weather?.flight_category ?? null)

          // Only show weather status circles for airports that actually report a category.
          if (cat === 'UNKNOWN') return null

          const colors = CATEGORY_COLORS[cat]

          return (
            <CircleMarker
              key={code || `${ap.latitude}-${ap.longitude}`}
              center={[ap.latitude, ap.longitude]}
              radius={6}
              pathOptions={{
                color: colors.stroke,
                weight: 2,
                fillColor: colors.fill,
                fillOpacity: 0.95,
              }}
            >
              <Popup>
                {code || 'Airport'} — {ap.name || ap.city} ({ap.distance_nm.toFixed(1)} nm)
                <br />
                Category: {weather?.flight_category || 'UNKNOWN'}
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>
    </Box>
  )
}

export default React.memo(LocalMap)
