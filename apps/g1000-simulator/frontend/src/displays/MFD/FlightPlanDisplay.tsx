import { useMemo } from 'react'

import { TelemetrySnapshot } from '../../hooks/useTelemetrySocket'

type FlightPlanDisplayProps = {
  telemetry: TelemetrySnapshot | null
}

const NM_PER_DEG_LAT = 60

const calcDistanceNm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const latNm = (lat2 - lat1) * NM_PER_DEG_LAT
  const lonNm = (lon2 - lon1) * NM_PER_DEG_LAT * Math.cos((lat1 * Math.PI) / 180)
  return Math.sqrt(latNm ** 2 + lonNm ** 2)
}

export const FlightPlanDisplay = ({ telemetry }: FlightPlanDisplayProps) => {
  const baseLat = telemetry?.position.latitude_deg ?? 37.618805
  const baseLon = telemetry?.position.longitude_deg ?? -122.375416
  const waypoints = useMemo(
    () => [
      { id: 'KSFO', name: 'Departure', lat: baseLat, lon: baseLon },
      { id: 'BOSDY', name: 'Fix', lat: baseLat + 0.12, lon: baseLon + 0.18 },
      { id: 'HADLY', name: 'Fix', lat: baseLat + 0.22, lon: baseLon + 0.28 },
      { id: 'KMOD', name: 'Arrival', lat: baseLat + 0.34, lon: baseLon + 0.42 },
    ],
    [baseLat, baseLon],
  )

  const legs = waypoints.slice(0, -1).map((waypoint, index) => {
    const next = waypoints[index + 1]
    const distance = calcDistanceNm(waypoint.lat, waypoint.lon, next.lat, next.lon)
    return {
      from: waypoint.id,
      to: next.id,
      distance,
      active: index === 1,
    }
  })

  return (
    <div className="mfd__panel">
      <h4 className="mfd__panel-title">Flight Plan</h4>
      <div className="mfd__fpl-list">
        {waypoints.map((waypoint, index) => (
          <div key={waypoint.id} className="mfd__fpl-row">
            <span className="mfd__fpl-index">{index + 1}</span>
            <span className="mfd__fpl-id">{waypoint.id}</span>
            <span className="mfd__fpl-name">{waypoint.name}</span>
          </div>
        ))}
      </div>
      <div className="mfd__fpl-legs">
        {legs.map((leg) => (
          <div key={`${leg.from}-${leg.to}`} className={`mfd__fpl-leg ${leg.active ? 'mfd__fpl-leg--active' : ''}`}>
            <span>
              {leg.from} → {leg.to}
            </span>
            <span>{leg.distance.toFixed(1)} NM</span>
          </div>
        ))}
      </div>
    </div>
  )
}
