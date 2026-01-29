import { useEffect, useMemo, useState } from 'react'

import { TelemetrySnapshot } from '../../hooks/useTelemetrySocket'
import type { FlightPlanWaypointType } from '../../stores/flightPlanStore'
import { useFlightPlanStore } from '../../stores/flightPlanStore'
import { useSoftkeyStore } from '../../stores/softkeyStore'
import { formatNumber } from '../PFD/formatters'

type FlightPlanDisplayProps = {
  telemetry: TelemetrySnapshot | null
}

type RoutePoint = {
  id: string
  lat: number
  lon: number
}

const NM_PER_DEG_LAT = 60
const DEFAULT_LAT = 37.618805
const DEFAULT_LON = -122.375416

const WAYPOINT_TYPES: Array<{ value: FlightPlanWaypointType; label: string }> = [
  { value: 'airport', label: 'APT' },
  { value: 'navaid', label: 'NAV' },
  { value: 'intersection', label: 'INT' },
  { value: 'user', label: 'USER' },
  { value: 'airway', label: 'AIRWAY' },
  { value: 'procedure', label: 'PROC' },
]

const sanitizeIdentifier = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '')

const parseOptionalNumber = (value: string) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const offsetCoordinates = (lat: number, lon: number, eastNm: number, northNm: number) => {
  const latOffset = northNm / NM_PER_DEG_LAT
  const lonOffset = eastNm / (NM_PER_DEG_LAT * (Math.cos((lat * Math.PI) / 180) || 1))
  return { lat: lat + latOffset, lon: lon + lonOffset }
}

const calcDistanceNm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const latNm = (lat2 - lat1) * NM_PER_DEG_LAT
  const lonNm = (lon2 - lon1) * NM_PER_DEG_LAT * Math.cos((lat1 * Math.PI) / 180)
  return Math.sqrt(latNm ** 2 + lonNm ** 2)
}

export const FlightPlanDisplay = ({ telemetry }: FlightPlanDisplayProps) => {
  const {
    plan,
    addWaypoint,
    updateWaypoint,
    removeWaypoint,
    resetPlan,
    loadSamplePlan,
    setField,
    setActiveLegIndex,
  } = useFlightPlanStore((state) => ({
    plan: state.plan,
    addWaypoint: state.addWaypoint,
    updateWaypoint: state.updateWaypoint,
    removeWaypoint: state.removeWaypoint,
    resetPlan: state.resetPlan,
    loadSamplePlan: state.loadSamplePlan,
    setField: state.setField,
    setActiveLegIndex: state.setActiveLegIndex,
  }))
  const lastAction = useSoftkeyStore((state) => state.contexts.mfd.lastAction)
  const [newIdent, setNewIdent] = useState('')
  const [newType, setNewType] = useState<FlightPlanWaypointType>('intersection')
  const [newAirway, setNewAirway] = useState('')
  const [newAltitude, setNewAltitude] = useState('')
  const [newSpeed, setNewSpeed] = useState('')
  const [insertAfter, setInsertAfter] = useState('-1')

  useEffect(() => {
    if (lastAction === 'mfd-fpl-new') {
      resetPlan()
    }
    if (lastAction === 'mfd-fpl-load') {
      loadSamplePlan()
    }
    if (lastAction === 'mfd-fpl-activate') {
      setActiveLegIndex(0)
    }
  }, [lastAction, loadSamplePlan, resetPlan, setActiveLegIndex])

  useEffect(() => {
    if (plan.waypoints.length === 0 && insertAfter !== '-1') {
      setInsertAfter('-1')
    }
    if (plan.waypoints.length > 0 && Number(insertAfter) > plan.waypoints.length - 1) {
      setInsertAfter(String(plan.waypoints.length - 1))
    }
  }, [insertAfter, plan.waypoints.length])

  const routePoints = useMemo(() => {
    const baseLat = telemetry?.position.latitude_deg ?? DEFAULT_LAT
    const baseLon = telemetry?.position.longitude_deg ?? DEFAULT_LON
    const points = [
      plan.origin ? { id: plan.origin } : null,
      ...plan.waypoints,
      plan.destination ? { id: plan.destination } : null,
    ].filter(Boolean) as Array<{ id: string; latitude_deg?: number; longitude_deg?: number }>
    if (points.length === 0) return [] as RoutePoint[]
    const midpoint = (points.length - 1) / 2
    return points.map((point, index) => {
      const offset = {
        eastNm: (index - midpoint) * 8,
        northNm: (index - midpoint) * 5,
      }
      const derived = offsetCoordinates(baseLat, baseLon, offset.eastNm, offset.northNm)
      return {
        id: point.id,
        lat: point.latitude_deg ?? derived.lat,
        lon: point.longitude_deg ?? derived.lon,
      }
    })
  }, [plan.destination, plan.origin, plan.waypoints, telemetry?.position.latitude_deg, telemetry?.position.longitude_deg])

  const legs = useMemo(() => {
    return routePoints.slice(0, -1).map((point, index) => {
      const next = routePoints[index + 1]
      const distance = calcDistanceNm(point.lat, point.lon, next.lat, next.lon)
      return {
        from: point.id,
        to: next.id,
        distance,
        active: index === plan.activeLegIndex,
      }
    })
  }, [plan.activeLegIndex, routePoints])

  const totalDistance = useMemo(
    () => legs.reduce((total, leg) => total + leg.distance, 0),
    [legs],
  )

  const handleAddWaypoint = () => {
    const normalizedIdent = sanitizeIdentifier(newIdent)
    const insertAfterIndex = Number.isFinite(Number(insertAfter)) ? Number(insertAfter) : plan.waypoints.length - 1
    addWaypoint(
      {
        id: normalizedIdent || undefined,
        type: newType,
        airway: newType === 'airway' ? newAirway.trim().toUpperCase() : undefined,
        altitude_ft: parseOptionalNumber(newAltitude),
        speed_kt: parseOptionalNumber(newSpeed),
      },
      insertAfterIndex,
    )
    setNewIdent('')
    setNewAirway('')
    setNewAltitude('')
    setNewSpeed('')
    setInsertAfter(String(Math.min(plan.waypoints.length, insertAfterIndex + 1)))
  }

  return (
    <div className="mfd__panel mfd__fpl">
      <div className="mfd__fpl-header">
        <h4 className="mfd__panel-title">Flight Plan</h4>
        <div className="mfd__fpl-actions">
          <button type="button" className="mfd__fpl-button" onClick={resetPlan}>
            New
          </button>
          <button type="button" className="mfd__fpl-button" onClick={() => setActiveLegIndex(0)}>
            Activate
          </button>
          <button type="button" className="mfd__fpl-button" onClick={loadSamplePlan}>
            Load
          </button>
        </div>
      </div>

      <div className="mfd__fpl-form">
        <label className="mfd__fpl-field">
          <span>Plan Name</span>
          <input value={plan.name} onChange={(event) => setField('name', event.target.value)} />
        </label>
        <label className="mfd__fpl-field">
          <span>Origin</span>
          <input
            value={plan.origin}
            onChange={(event) => setField('origin', sanitizeIdentifier(event.target.value))}
          />
        </label>
        <label className="mfd__fpl-field">
          <span>Destination</span>
          <input
            value={plan.destination}
            onChange={(event) => setField('destination', sanitizeIdentifier(event.target.value))}
          />
        </label>
        <label className="mfd__fpl-field">
          <span>Alternate</span>
          <input
            value={plan.alternate}
            onChange={(event) => setField('alternate', sanitizeIdentifier(event.target.value))}
          />
        </label>
      </div>

      <div className="mfd__fpl-add">
        <label className="mfd__fpl-field">
          <span>Waypoint</span>
          <input value={newIdent} onChange={(event) => setNewIdent(event.target.value)} />
        </label>
        <label className="mfd__fpl-field">
          <span>Type</span>
          <select
            value={newType}
            onChange={(event) => {
              const nextType = event.target.value as FlightPlanWaypointType
              setNewType(nextType)
              if (nextType !== 'airway') {
                setNewAirway('')
              }
            }}
          >
            {WAYPOINT_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="mfd__fpl-field">
          <span>Airway</span>
          <input
            value={newAirway}
            onChange={(event) => setNewAirway(event.target.value)}
            disabled={newType !== 'airway'}
          />
        </label>
        <label className="mfd__fpl-field">
          <span>Alt (FT)</span>
          <input value={newAltitude} onChange={(event) => setNewAltitude(event.target.value)} />
        </label>
        <label className="mfd__fpl-field">
          <span>Spd (KT)</span>
          <input value={newSpeed} onChange={(event) => setNewSpeed(event.target.value)} />
        </label>
        <label className="mfd__fpl-field">
          <span>Insert After</span>
          <select value={insertAfter} onChange={(event) => setInsertAfter(event.target.value)}>
            <option value="-1">After {plan.origin || 'ORIG'}</option>
            {plan.waypoints.map((waypoint, index) => (
              <option key={`insert-${waypoint.id}-${index}`} value={index.toString()}>
                After {waypoint.id}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="mfd__fpl-button" onClick={handleAddWaypoint}>
          Add
        </button>
      </div>

      {plan.waypoints.length === 0 ? (
        <div className="mfd__fpl-placeholder">No enroute waypoints entered.</div>
      ) : (
        <div className="mfd__fpl-list">
          {plan.waypoints.map((waypoint, index) => (
            <div
              key={`${waypoint.id}-${index}`}
              className={`mfd__fpl-row ${index === plan.activeLegIndex ? 'mfd__fpl-row--active' : ''}`}
            >
              <span className="mfd__fpl-index">{index + 1}</span>
              <input
                className="mfd__fpl-input"
                value={waypoint.id}
                onChange={(event) =>
                  updateWaypoint(index, { id: sanitizeIdentifier(event.target.value) })
                }
              />
              <select
                className="mfd__fpl-input"
                value={waypoint.type}
                onChange={(event) => {
                  const nextType = event.target.value as FlightPlanWaypointType
                  updateWaypoint(index, {
                    type: nextType,
                    airway: nextType === 'airway' ? waypoint.airway : undefined,
                  })
                }}
              >
                {WAYPOINT_TYPES.map((option) => (
                  <option key={`type-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                className="mfd__fpl-input"
                value={waypoint.airway ?? ''}
                placeholder="Airway"
                onChange={(event) => updateWaypoint(index, { airway: event.target.value.toUpperCase() })}
                disabled={waypoint.type !== 'airway'}
              />
              <input
                className="mfd__fpl-input"
                value={waypoint.altitude_ft?.toString() ?? ''}
                placeholder="Alt"
                onChange={(event) =>
                  updateWaypoint(index, { altitude_ft: parseOptionalNumber(event.target.value) })
                }
              />
              <input
                className="mfd__fpl-input"
                value={waypoint.speed_kt?.toString() ?? ''}
                placeholder="Spd"
                onChange={(event) =>
                  updateWaypoint(index, { speed_kt: parseOptionalNumber(event.target.value) })
                }
              />
              <button
                type="button"
                className="mfd__fpl-remove"
                onClick={() => removeWaypoint(index)}
              >
                Del
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mfd__fpl-legs">
        {legs.map((leg, index) => (
          <button
            key={`${leg.from}-${leg.to}`}
            type="button"
            className={`mfd__fpl-leg ${leg.active ? 'mfd__fpl-leg--active' : ''}`}
            onClick={() => setActiveLegIndex(index)}
          >
            <span>
              {leg.from} → {leg.to}
            </span>
            <span>{leg.distance.toFixed(1)} NM</span>
          </button>
        ))}
        <div className="mfd__fpl-total">
          <span>Total</span>
          <strong>{formatNumber(totalDistance, ' NM', 1)}</strong>
        </div>
      </div>
    </div>
  )
}
