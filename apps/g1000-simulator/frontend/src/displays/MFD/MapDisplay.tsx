import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

import { TelemetrySnapshot } from '../../hooks/useTelemetrySocket'
import { useCursorStore } from '../../stores/cursorStore'
import { useMfdStore, MAP_RANGE_OPTIONS } from '../../stores/mfdStore'
import { useRotaryKnobStore } from '../../stores/rotaryKnobStore'
import { useSoftkeyToggle } from '../../stores/softkeyStore'
import { getTerrainAlertLevel, getTerrainElevation, terrainAlertRank } from '../../services/mfdTerrain'
import { formatCoordinate, formatNumber, formatSigned, normalizeHeading } from '../PFD/formatters'

type MapDisplayProps = {
  telemetry: TelemetrySnapshot | null
}

type MapFeatureType = 'airport' | 'vor' | 'ndb' | 'fix'

type MapFeature = {
  id: string
  type: MapFeatureType
  label: string
  lat: number
  lon: number
}

type AirspaceRing = {
  id: string
  label: string
  lat: number
  lon: number
  radiusNm: number
}

type WeatherCell = {
  id: string
  intensity: number
  lat: number
  lon: number
  radiusNm: number
}

type WindOverlay = {
  id: string
  lat: number
  lon: number
  direction: number
  speed: number
}

type LightningStrike = {
  id: string
  lat: number
  lon: number
}

type TrafficTarget = {
  id: string
  lat: number
  lon: number
  altitudeFt: number
  relativeAltitudeFt: number
  distanceNm: number
  alert: 'none' | 'ta' | 'ra'
}

type Obstacle = {
  id: string
  lat: number
  lon: number
  heightFt: number
  alert: 'none' | 'caution' | 'warning'
}

const NM_PER_DEG_LAT = 60

const degToRad = (value: number) => (value * Math.PI) / 180

const lonScale = (lat: number) => Math.cos(degToRad(lat)) || 1

const clampRatio = (value: number) => Math.max(0, Math.min(1, value))

const offsetCoordinates = (lat: number, lon: number, eastNm: number, northNm: number) => {
  const latOffset = northNm / NM_PER_DEG_LAT
  const lonOffset = eastNm / (NM_PER_DEG_LAT * lonScale(lat))
  return { lat: lat + latOffset, lon: lon + lonOffset }
}

const toMapPoint = (
  lat: number,
  lon: number,
  centerLat: number,
  centerLon: number,
  rangeNm: number,
) => {
  if (!Number.isFinite(rangeNm) || rangeNm <= 0) return null
  const deltaLatNm = (lat - centerLat) * NM_PER_DEG_LAT
  const deltaLonNm = (lon - centerLon) * NM_PER_DEG_LAT * lonScale(centerLat)
  if (Math.abs(deltaLatNm) > rangeNm * 1.25 || Math.abs(deltaLonNm) > rangeNm * 1.25) return null
  const x = 50 + (deltaLonNm / rangeNm) * 50
  const y = 50 - (deltaLatNm / rangeNm) * 50
  return {
    x: Math.max(0, Math.min(100, x)),
    y: Math.max(0, Math.min(100, y)),
  }
}

export const MapDisplay = ({ telemetry }: MapDisplayProps) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const holdTimeoutRef = useRef<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const { mode, position, focusTarget, setCursorMode, setCursorPosition, setFocusTarget } = useCursorStore(
    (state) => ({
      mode: state.mode,
      position: state.position,
      focusTarget: state.focusTarget,
      setCursorMode: state.setCursorMode,
      setCursorPosition: state.setCursorPosition,
      setFocusTarget: state.setFocusTarget,
    }),
  )
  const mapRangeIndex = useMfdStore((state) => state.mapRangeIndex)
  const mapOrientation = useMfdStore((state) => state.mapOrientation)
  const stepRange = useMfdStore((state) => state.stepRange)
  const cycleOrientation = useMfdStore((state) => state.cycleOrientation)
  const { lastEvent, lastEventAt } = useRotaryKnobStore((state) => ({
    lastEvent: state.lastEvent,
    lastEventAt: state.lastEventAt,
  }))
  const showTerrain = useSoftkeyToggle('mfd', 'mfd-map-settings', 'terrain')
  const showAirspace = useSoftkeyToggle('mfd', 'mfd-map-settings', 'airspace')
  const showData = useSoftkeyToggle('mfd', 'mfd-map-settings', 'data')
  const showDeclutter = useSoftkeyToggle('mfd', 'mfd-map-settings', 'declutter')
  const showWind = useSoftkeyToggle('mfd', 'mfd-map-settings', 'wind')
  const showLightning = useSoftkeyToggle('mfd', 'mfd-map-settings', 'ltng')
  const showTraffic = useSoftkeyToggle('mfd', 'mfd-map', 'traffic')
  const showWeather = useSoftkeyToggle('mfd', 'mfd-map', 'weather')
  const isActive = mode === 'active'
  const rangeNm = MAP_RANGE_OPTIONS[mapRangeIndex] ?? 20
  const latitude = telemetry?.gps.latitude_deg ?? telemetry?.position.latitude_deg ?? null
  const longitude = telemetry?.gps.longitude_deg ?? telemetry?.position.longitude_deg ?? null
  const heading = normalizeHeading(telemetry?.attitude.heading_deg) ?? 0
  const track = normalizeHeading(telemetry?.gps.track_deg) ?? heading
  const cursorStyle = useMemo(
    () => ({
      left: `${position.x * 100}%`,
      top: `${position.y * 100}%`,
    }),
    [position.x, position.y],
  )
  const mapRotation = useMemo(() => {
    if (mapOrientation === 'north-up') return 0
    if (mapOrientation === 'track-up') return -track
    return -heading
  }, [heading, mapOrientation, track])

  useEffect(() => {
    if (!lastEvent || lastEvent.knobId !== 'range') return
    const delta = lastEvent.direction === 'clockwise' ? lastEvent.detents : -lastEvent.detents
    if (lastEvent.ring === 'outer') {
      stepRange(delta)
    } else {
      cycleOrientation(delta)
    }
  }, [cycleOrientation, lastEvent, lastEventAt, stepRange])

  const updateCursorFromClient = useCallback(
    (clientX: number, clientY: number) => {
      if (!mapRef.current) return
      const rect = mapRef.current.getBoundingClientRect()
      const nextX = clampRatio((clientX - rect.left) / rect.width)
      const nextY = clampRatio((clientY - rect.top) / rect.height)
      setCursorPosition({ x: nextX, y: nextY })
    },
    [setCursorPosition],
  )

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!mapRef.current || event.button !== 0) return
      event.preventDefault()
      const { clientX, clientY } = event
      mapRef.current.setPointerCapture(event.pointerId)
      if (isActive) {
        setIsDragging(true)
        updateCursorFromClient(clientX, clientY)
        return
      }

      holdTimeoutRef.current = window.setTimeout(() => {
        setCursorMode('active')
        setIsDragging(true)
        updateCursorFromClient(clientX, clientY)
      }, 300)
    },
    [isActive, setCursorMode, updateCursorFromClient],
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isDragging) return
      event.preventDefault()
      updateCursorFromClient(event.clientX, event.clientY)
    },
    [isDragging, updateCursorFromClient],
  )

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (holdTimeoutRef.current) {
      window.clearTimeout(holdTimeoutRef.current)
      holdTimeoutRef.current = null
    }
    setIsDragging(false)
    mapRef.current?.releasePointerCapture(event.pointerId)
  }, [])

  useEffect(() => () => {
    if (holdTimeoutRef.current) {
      window.clearTimeout(holdTimeoutRef.current)
    }
  }, [])

  const nextFocusTarget = useMemo(() => {
    if (!isActive) return null
    const dx = position.x - 0.5
    const dy = position.y - 0.5
    const distance = Math.sqrt(dx * dx + dy * dy)
    return distance < 0.08 ? 'aircraft' : null
  }, [isActive, position.x, position.y])

  useEffect(() => {
    if (nextFocusTarget !== focusTarget) {
      setFocusTarget(nextFocusTarget)
    }
  }, [focusTarget, nextFocusTarget, setFocusTarget])

  const cursorClassName = useMemo(() => {
    const base = 'mfd__map-cursor'
    const activeClass = isActive ? ' mfd__map-cursor--active' : ''
    const focusClass = nextFocusTarget ? ' mfd__map-cursor--focus' : ''
    return `${base}${activeClass}${focusClass}`
  }, [isActive, nextFocusTarget])

  const panOffset = useMemo(() => {
    if (!isActive || nextFocusTarget) {
      return { eastNm: 0, northNm: 0 }
    }
    return {
      eastNm: (position.x - 0.5) * rangeNm,
      northNm: (0.5 - position.y) * rangeNm,
    }
  }, [isActive, nextFocusTarget, position.x, position.y, rangeNm])

  const center = useMemo(() => {
    const baseLat = latitude ?? 37.618805
    const baseLon = longitude ?? -122.375416
    return offsetCoordinates(baseLat, baseLon, panOffset.eastNm, panOffset.northNm)
  }, [latitude, longitude, panOffset.eastNm, panOffset.northNm])

  const cursorCoordinate = useMemo(() => {
    if (!isActive || latitude === null || longitude === null) return null
    const cursorOffset = {
      eastNm: (position.x - 0.5) * rangeNm,
      northNm: (0.5 - position.y) * rangeNm,
    }
    return offsetCoordinates(latitude, longitude, cursorOffset.eastNm, cursorOffset.northNm)
  }, [isActive, latitude, longitude, position.x, position.y, rangeNm])

  const navFeatures = useMemo(() => {
    const baseLat = latitude ?? 37.618805
    const baseLon = longitude ?? -122.375416
    const seeds = [
      { id: 'KSFO', type: 'airport', label: 'SFO', eastNm: 6, northNm: 8 },
      { id: 'KOAK', type: 'airport', label: 'OAK', eastNm: -4, northNm: 10 },
      { id: 'KSQL', type: 'airport', label: 'SQL', eastNm: 4, northNm: -6 },
      { id: 'SFO', type: 'vor', label: 'SFO', eastNm: 12, northNm: 2 },
      { id: 'OSI', type: 'vor', label: 'OSI', eastNm: -10, northNm: -4 },
      { id: 'CCR', type: 'ndb', label: 'CCR', eastNm: -16, northNm: 6 },
      { id: 'BOSDY', type: 'fix', label: 'BOSDY', eastNm: 14, northNm: -8 },
      { id: 'KAYEX', type: 'fix', label: 'KAYEX', eastNm: -8, northNm: -12 },
    ] as const
    return seeds.map((seed) => ({
      id: seed.id,
      type: seed.type,
      label: seed.label,
      ...offsetCoordinates(baseLat, baseLon, seed.eastNm, seed.northNm),
    })) satisfies MapFeature[]
  }, [latitude, longitude])

  const airspaceRings = useMemo(() => {
    const baseLat = latitude ?? 37.618805
    const baseLon = longitude ?? -122.375416
    const rings = [
      { id: 'class-b', label: 'B', eastNm: 0, northNm: 0, radiusNm: 15 },
      { id: 'class-c', label: 'C', eastNm: -12, northNm: 5, radiusNm: 8 },
    ]
    return rings.map((ring) => ({
      id: ring.id,
      label: ring.label,
      radiusNm: ring.radiusNm,
      ...offsetCoordinates(baseLat, baseLon, ring.eastNm, ring.northNm),
    })) satisfies AirspaceRing[]
  }, [latitude, longitude])

  const flightPlan = useMemo(() => {
    const baseLat = latitude ?? 37.618805
    const baseLon = longitude ?? -122.375416
    const offsets = [
      { eastNm: -18, northNm: -12 },
      { eastNm: -6, northNm: -4 },
      { eastNm: 4, northNm: 2 },
      { eastNm: 16, northNm: 10 },
    ]
    return offsets.map((offset) => offsetCoordinates(baseLat, baseLon, offset.eastNm, offset.northNm))
  }, [latitude, longitude])

  const weatherCells = useMemo(() => {
    const baseLat = latitude ?? 37.618805
    const baseLon = longitude ?? -122.375416
    const cells = [
      { id: 'wx-1', intensity: 3, eastNm: 10, northNm: -4, radiusNm: 6 },
      { id: 'wx-2', intensity: 2, eastNm: -14, northNm: 6, radiusNm: 8 },
      { id: 'wx-3', intensity: 1, eastNm: 2, northNm: 14, radiusNm: 5 },
    ]
    return cells.map((cell) => ({
      id: cell.id,
      intensity: cell.intensity,
      radiusNm: cell.radiusNm,
      ...offsetCoordinates(baseLat, baseLon, cell.eastNm, cell.northNm),
    })) satisfies WeatherCell[]
  }, [latitude, longitude])

  const windOverlays = useMemo(() => {
    const baseLat = latitude ?? 37.618805
    const baseLon = longitude ?? -122.375416
    const baseDirection = heading + 40
    const winds = [
      { id: 'wind-1', direction: baseDirection, speed: 22, eastNm: -6, northNm: 12 },
      { id: 'wind-2', direction: baseDirection + 30, speed: 28, eastNm: 8, northNm: 4 },
      { id: 'wind-3', direction: baseDirection - 20, speed: 18, eastNm: -10, northNm: -10 },
    ]
    return winds.map((wind) => ({
      id: wind.id,
      direction: wind.direction,
      speed: wind.speed,
      ...offsetCoordinates(baseLat, baseLon, wind.eastNm, wind.northNm),
    })) satisfies WindOverlay[]
  }, [heading, latitude, longitude])

  const lightningStrikes = useMemo(() => {
    const baseLat = latitude ?? 37.618805
    const baseLon = longitude ?? -122.375416
    const strikes = [
      { id: 'ltng-1', eastNm: -2, northNm: 2 },
      { id: 'ltng-2', eastNm: 12, northNm: -8 },
      { id: 'ltng-3', eastNm: -14, northNm: -6 },
    ]
    return strikes.map((strike) => ({
      id: strike.id,
      ...offsetCoordinates(baseLat, baseLon, strike.eastNm, strike.northNm),
    })) satisfies LightningStrike[]
  }, [latitude, longitude])

  const trafficTargets = useMemo(() => {
    if (!telemetry) return []
    const timeSeed = telemetry.timestamp / 1000
    const baseLat = latitude ?? telemetry.position.latitude_deg
    const baseLon = longitude ?? telemetry.position.longitude_deg
    const offsets = [
      { id: 'TFC1', eastNm: 8 + Math.sin(timeSeed / 6) * 4, northNm: 6 + Math.cos(timeSeed / 4) * 3, alt: 400 },
      { id: 'TFC2', eastNm: -10 + Math.cos(timeSeed / 5) * 5, northNm: -4, alt: -200 },
      { id: 'TFC3', eastNm: 2, northNm: -12 + Math.sin(timeSeed / 3) * 4, alt: 900 },
    ]
    return offsets.map((offset) => {
      const position = offsetCoordinates(baseLat, baseLon, offset.eastNm, offset.northNm)
      const distanceNm = Math.sqrt(offset.eastNm ** 2 + offset.northNm ** 2)
      const relativeAltitude = offset.alt
      const alert =
        distanceNm <= 2 && Math.abs(relativeAltitude) <= 500
          ? 'ra'
          : distanceNm <= 4 && Math.abs(relativeAltitude) <= 1000
            ? 'ta'
            : 'none'
      return {
        id: offset.id,
        lat: position.lat,
        lon: position.lon,
        altitudeFt: telemetry.position.altitude_ft + relativeAltitude,
        relativeAltitudeFt: relativeAltitude,
        distanceNm,
        alert,
      }
    }) satisfies TrafficTarget[]
  }, [latitude, longitude, telemetry])

  const obstacles = useMemo(() => {
    const baseLat = latitude ?? 37.618805
    const baseLon = longitude ?? -122.375416
    const obstacleSeeds = [
      { id: 'OBS1', eastNm: 6, northNm: -2, heightFt: 450 },
      { id: 'OBS2', eastNm: -8, northNm: 4, heightFt: 620 },
      { id: 'OBS3', eastNm: -2, northNm: -10, heightFt: 300 },
    ]
    const altitude = telemetry?.position.altitude_ft ?? 0
    return obstacleSeeds.map((obstacle) => {
      const position = offsetCoordinates(baseLat, baseLon, obstacle.eastNm, obstacle.northNm)
      const clearance = altitude - obstacle.heightFt
      const alert = clearance <= 100 ? 'warning' : clearance <= 300 ? 'caution' : 'none'
      return {
        id: obstacle.id,
        lat: position.lat,
        lon: position.lon,
        heightFt: obstacle.heightFt,
        alert,
      }
    }) satisfies Obstacle[]
  }, [latitude, longitude, telemetry?.position.altitude_ft])

  const terrainData = useMemo(() => {
    if (!showTerrain) {
      return { cells: [], alertLevel: 'normal' as const }
    }
    const altitude = telemetry?.position.altitude_ft ?? 0
    const gridSize = 10
    const cellSize = 100 / gridSize
    const cells = Array.from({ length: gridSize * gridSize }, (_, index) => {
      const row = Math.floor(index / gridSize)
      const col = index % gridSize
      const northNm = ((gridSize / 2 - (row + 0.5)) / gridSize) * rangeNm * 2
      const eastNm = (((col + 0.5) - gridSize / 2) / gridSize) * rangeNm * 2
      const cellLatLon = offsetCoordinates(center.lat, center.lon, eastNm, northNm)
      const elevationFt = getTerrainElevation(cellLatLon.lat, cellLatLon.lon)
      const alertLevel = getTerrainAlertLevel(altitude, elevationFt)
      return {
        id: `cell-${row}-${col}`,
        x: col * cellSize,
        y: row * cellSize,
        size: cellSize,
        alertLevel,
      }
    })
    const alertLevel = cells.reduce((highest, cell) => {
      return terrainAlertRank(cell.alertLevel) > terrainAlertRank(highest) ? cell.alertLevel : highest
    }, 'normal' as const)
    return { cells, alertLevel }
  }, [center.lat, center.lon, rangeNm, showTerrain, telemetry?.position.altitude_ft])

  const trafficAlert = useMemo(() => {
    if (!showTraffic || trafficTargets.length === 0) return 'none'
    if (trafficTargets.some((target) => target.alert === 'ra')) return 'ra'
    if (trafficTargets.some((target) => target.alert === 'ta')) return 'ta'
    return 'none'
  }, [showTraffic, trafficTargets])

  const visibleNavFeatures = useMemo(() => {
    if (!showData) return []
    if (!showDeclutter) return navFeatures
    return navFeatures.filter((feature) => feature.type === 'airport' || feature.type === 'vor')
  }, [navFeatures, showData, showDeclutter])

  const mapOrientationLabel = useMemo(() => {
    switch (mapOrientation) {
      case 'track-up':
        return 'TRK'
      case 'heading-up':
        return 'HDG'
      default:
        return 'NTH'
    }
  }, [mapOrientation])

  const cursorStatus = isActive ? 'ON' : 'OFF'
  const cursorLat = cursorCoordinate?.lat ?? latitude
  const cursorLon = cursorCoordinate?.lon ?? longitude
  const displayTrack = telemetry ? track : null
  const scaleLabel = rangeNm >= 2 ? (rangeNm / 4).toFixed(0) : (rangeNm / 4).toFixed(2)
  const terrainAlertLabel = !showTerrain
    ? 'TERR OFF'
    : terrainData.alertLevel === 'warning'
      ? 'TERR WARN'
      : terrainData.alertLevel === 'caution'
        ? 'TERR CAUT'
        : terrainData.alertLevel === 'advisory'
          ? 'TERR ADV'
          : 'TERR NORM'
  const trafficAlertLabel = !showTraffic
    ? 'TFC OFF'
    : trafficAlert === 'ra'
      ? 'TFC RA'
      : trafficAlert === 'ta'
        ? 'TFC TA'
        : 'TFC OK'

  return (
    <div
      className="mfd__map"
      ref={mapRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <div className="mfd__map-grid" />
      <div className="mfd__map-rotating" style={{ transform: `rotate(${mapRotation}deg)` }}>
        <svg className="mfd__map-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          {showTerrain ? (
            <g className="mfd__map-terrain">
              {terrainData.cells.map((cell) => (
                <rect
                  key={cell.id}
                  className={`mfd__terrain-cell mfd__terrain-cell--${cell.alertLevel}`}
                  x={cell.x}
                  y={cell.y}
                  width={cell.size}
                  height={cell.size}
                />
              ))}
            </g>
          ) : null}
          {showAirspace ? (
            <g className="mfd__map-airspace">
              {airspaceRings.map((ring) => {
                const point = toMapPoint(ring.lat, ring.lon, center.lat, center.lon, rangeNm)
                if (!point) return null
                const radius = (ring.radiusNm / rangeNm) * 50
                return (
                  <g key={ring.id}>
                    <circle className="mfd__map-airspace-ring" cx={point.x} cy={point.y} r={radius} />
                    <text className="mfd__map-airspace-label" x={point.x} y={point.y}>
                      {ring.label}
                    </text>
                  </g>
                )
              })}
            </g>
          ) : null}
          <g className="mfd__map-fpl">
            {flightPlan.map((waypoint, index) => {
              const point = toMapPoint(waypoint.lat, waypoint.lon, center.lat, center.lon, rangeNm)
              if (!point) return null
              return (
                <circle
                  key={`fpl-${index}`}
                  className={index === 1 ? 'mfd__map-fpl-point mfd__map-fpl-point--active' : 'mfd__map-fpl-point'}
                  cx={point.x}
                  cy={point.y}
                  r={1.4}
                />
              )
            })}
            <polyline
              className="mfd__map-fpl-line"
              points={flightPlan
                .map((waypoint) => toMapPoint(waypoint.lat, waypoint.lon, center.lat, center.lon, rangeNm))
                .filter(Boolean)
                .map((point) => `${point?.x ?? 0},${point?.y ?? 0}`)
                .join(' ')}
            />
          </g>
          <g className="mfd__map-nav">
            {visibleNavFeatures.map((feature) => {
              const point = toMapPoint(feature.lat, feature.lon, center.lat, center.lon, rangeNm)
              if (!point) return null
              return (
                <g key={feature.id} className={`mfd__map-feature mfd__map-feature--${feature.type}`}>
                  <circle className="mfd__map-feature-icon" cx={point.x} cy={point.y} r={2.2} />
                  <text className="mfd__map-feature-label" x={point.x + 3.5} y={point.y - 2}>
                    {feature.label}
                  </text>
                </g>
              )
            })}
          </g>
          {showWeather ? (
            <g className="mfd__map-weather">
              {weatherCells.map((cell) => {
                const point = toMapPoint(cell.lat, cell.lon, center.lat, center.lon, rangeNm)
                if (!point) return null
                const radius = (cell.radiusNm / rangeNm) * 50
                return (
                  <circle
                    key={cell.id}
                    className={`mfd__map-weather-cell mfd__map-weather-cell--${cell.intensity}`}
                    cx={point.x}
                    cy={point.y}
                    r={radius}
                  />
                )
              })}
              {navFeatures
                .filter((feature) => feature.type === 'airport')
                .map((feature) => {
                  const point = toMapPoint(feature.lat, feature.lon, center.lat, center.lon, rangeNm)
                  if (!point) return null
                  const conditionClass = feature.id === 'KSFO' ? 'vfr' : feature.id === 'KOAK' ? 'ifr' : 'mvfr'
                  return (
                    <g key={`metar-${feature.id}`} className="mfd__map-metar">
                      <circle className={`mfd__map-metar-icon mfd__map-metar-icon--${conditionClass}`} cx={point.x} cy={point.y} r={2.6} />
                    </g>
                  )
                })}
            </g>
          ) : null}
          {showWeather && showWind ? (
            <g className="mfd__map-winds">
              {windOverlays.map((wind) => {
                const point = toMapPoint(wind.lat, wind.lon, center.lat, center.lon, rangeNm)
                if (!point) return null
                return (
                  <g
                    key={wind.id}
                    className="mfd__map-wind"
                    transform={`translate(${point.x} ${point.y}) rotate(${wind.direction})`}
                  >
                    <line x1={0} y1={0} x2={0} y2={-5} />
                    <line x1={0} y1={-5} x2={2.8} y2={-3.5} />
                    <text className="mfd__map-wind-label" x={4} y={-2}>
                      {wind.speed}
                    </text>
                  </g>
                )
              })}
            </g>
          ) : null}
          {showWeather && showLightning ? (
            <g className="mfd__map-lightning">
              {lightningStrikes.map((strike) => {
                const point = toMapPoint(strike.lat, strike.lon, center.lat, center.lon, rangeNm)
                if (!point) return null
                return (
                  <text key={strike.id} className="mfd__map-lightning-icon" x={point.x} y={point.y}>
                    ⚡
                  </text>
                )
              })}
            </g>
          ) : null}
          {showTraffic ? (
            <g className="mfd__map-traffic">
              {trafficTargets.map((target) => {
                const point = toMapPoint(target.lat, target.lon, center.lat, center.lon, rangeNm)
                if (!point) return null
                const relativeTag = formatSigned(Math.round(target.relativeAltitudeFt / 100), '')
                return (
                  <g key={target.id} className={`mfd__map-traffic-target mfd__map-traffic-target--${target.alert}`}>
                    <rect x={point.x - 2} y={point.y - 2} width={4} height={4} />
                    <text className="mfd__map-traffic-label" x={point.x + 3} y={point.y + 3}>
                      {relativeTag}
                    </text>
                  </g>
                )
              })}
            </g>
          ) : null}
          {showTerrain ? (
            <g className="mfd__map-obstacles">
              {obstacles.map((obstacle) => {
                const point = toMapPoint(obstacle.lat, obstacle.lon, center.lat, center.lon, rangeNm)
                if (!point) return null
                return (
                  <g key={obstacle.id} className={`mfd__map-obstacle mfd__map-obstacle--${obstacle.alert}`}>
                    <path d="M 0 -2 L 2 2 L -2 2 Z" transform={`translate(${point.x} ${point.y})`} />
                  </g>
                )
              })}
            </g>
          ) : null}
          <circle className="mfd__map-range-ring" cx={50} cy={50} r={30} />
          <g className="mfd__map-aircraft">
            <path d="M 0 -5 L 3 5 L 0 3 L -3 5 Z" transform="translate(50 50)" />
          </g>
        </svg>
      </div>
      <div
        className={`mfd__map-marker${nextFocusTarget ? ' mfd__map-marker--focused' : ''}`}
      >
        <span className="mfd__map-marker-label">ACFT</span>
      </div>
      <div className={cursorClassName} style={cursorStyle}>
        <span className="mfd__map-cursor-dot" />
      </div>
      <div className="mfd__map-overlay">
        <div>
          <span className="mfd__map-label">LAT</span>
          <span className="mfd__map-value">{formatCoordinate(cursorLat)}</span>
        </div>
        <div>
          <span className="mfd__map-label">LON</span>
          <span className="mfd__map-value">{formatCoordinate(cursorLon)}</span>
        </div>
        <div>
          <span className="mfd__map-label">TRK</span>
          <span className="mfd__map-value">{formatNumber(displayTrack, '°')}</span>
        </div>
        <div className="mfd__map-status">
          <span className="mfd__map-label">CUR</span>
          <span className="mfd__map-value">{cursorStatus}</span>
        </div>
      </div>
      <div className="mfd__map-status-panel">
        <span>RNG {rangeNm} NM</span>
        <span>{mapOrientationLabel}</span>
        <span>{terrainAlertLabel}</span>
        <span>{trafficAlertLabel}</span>
      </div>
      <div className="mfd__map-scale">
        <span className="mfd__map-scale-bar" />
        <span>{scaleLabel} NM</span>
      </div>
      <div className="mfd__map-legend">
        <span className="mfd__legend-item">APT</span>
        <span className="mfd__legend-item">VOR</span>
        <span className="mfd__legend-item">TFC</span>
        <span className="mfd__legend-item">WX</span>
      </div>
    </div>
  )
}
