import { useMemo } from 'react'

import { getTerrainAlertLevel, getTerrainElevation } from '../../services/mfdTerrain'
import { MAP_RANGE_OPTIONS, useMfdStore } from '../../stores/mfdStore'
import { useSoftkeyToggle } from '../../stores/softkeyStore'
import type { MfdDisplayProps } from '../types'
import { EngineDisplay } from './EngineDisplay'
import { FlightPlanDisplay } from './FlightPlanDisplay'
import { MapDisplay } from './MapDisplay'
import { MfdMenuPanel } from './MfdMenuPanel'
import { MenuSystem } from './MenuSystem'
import { NearestDisplay } from './NearestDisplay'
import { ProceduresDisplay } from './ProceduresDisplay'
import { TripPlanningDisplay } from './TripPlanningDisplay'

export const MfdDisplay = ({ telemetry }: MfdDisplayProps) => {
  const activePage = useMfdStore((state) => state.activePage)
  const mapRangeIndex = useMfdStore((state) => state.mapRangeIndex)
  const mapOrientation = useMfdStore((state) => state.mapOrientation)
  const rangeNm = MAP_RANGE_OPTIONS[mapRangeIndex] ?? 20
  const heading = telemetry ? Math.round(telemetry.attitude.heading_deg) : null
  const altitude = telemetry ? Math.round(telemetry.position.altitude_ft) : null
  const position = telemetry
    ? `${telemetry.position.latitude_deg.toFixed(3)}°, ${telemetry.position.longitude_deg.toFixed(3)}°`
    : '---'
  const showTerrain = useSoftkeyToggle('mfd', 'mfd-map-settings', 'terrain')
  const showWeather = useSoftkeyToggle('mfd', 'mfd-map', 'weather')
  const showTraffic = useSoftkeyToggle('mfd', 'mfd-map', 'traffic')

  const terrainAlert = useMemo(() => {
    if (!telemetry || !showTerrain) return 'normal'
    const elevation = getTerrainElevation(
      telemetry.position.latitude_deg,
      telemetry.position.longitude_deg,
    )
    return getTerrainAlertLevel(telemetry.position.altitude_ft, elevation)
  }, [showTerrain, telemetry])

  const terrainLabel =
    !showTerrain
      ? 'TERR OFF'
      : terrainAlert === 'warning'
        ? 'TERR WARN'
        : terrainAlert === 'caution'
          ? 'TERR CAUT'
          : terrainAlert === 'advisory'
            ? 'TERR ADV'
            : 'TERR NORM'
  const weatherLabel = showWeather ? 'WX ON' : 'WX OFF'
  const trafficLabel = showTraffic ? 'TFC ON' : 'TFC OFF'

  const headerMeta = useMemo(() => {
    switch (activePage) {
      case 'engine':
        return { subtitle: 'Engine - Monitoring', title: 'Powerplant Status' }
      case 'nearest':
        return { subtitle: 'Nearest', title: 'Nearest Facilities' }
      case 'flight-plan':
        return { subtitle: 'Flight Plan', title: 'Active Route' }
      case 'procedures':
        return { subtitle: 'Procedures', title: 'Departures & Arrivals' }
      case 'trip':
        return { subtitle: 'Trip Planning', title: 'Fuel · W&B · Density Alt' }
      case 'menu':
        return { subtitle: 'Menu', title: 'MFD Settings' }
      default:
        return { subtitle: 'Map - Navigation', title: `Range ${rangeNm} NM` }
    }
  }, [activePage, rangeNm])

  const contentClassName = `mfd__content ${activePage === 'map' ? 'mfd__content--map' : 'mfd__content--single'}`

  return (
    <div className="mfd">
      <div className="mfd__header">
        <div>
          <p className="mfd__subtitle">{headerMeta.subtitle}</p>
          <h3 className="mfd__title">{headerMeta.title}</h3>
        </div>
        <div className="mfd__status">
          <span>HDG {heading ?? '---'}°</span>
          <span>ALT {altitude ?? '---'} ft</span>
          <span>{mapOrientation.toUpperCase().replace('-', ' ')}</span>
        </div>
      </div>
      <div className={contentClassName}>
        {activePage === 'map' ? (
          <>
            <MapDisplay telemetry={telemetry} />
            <EngineDisplay telemetry={telemetry} layout="summary" />
          </>
        ) : null}
        {activePage === 'engine' ? <EngineDisplay telemetry={telemetry} layout="full" /> : null}
        {activePage === 'nearest' ? <NearestDisplay telemetry={telemetry} /> : null}
        {activePage === 'flight-plan' ? <FlightPlanDisplay telemetry={telemetry} /> : null}
        {activePage === 'procedures' ? <ProceduresDisplay /> : null}
        {activePage === 'trip' ? <TripPlanningDisplay telemetry={telemetry} /> : null}
        {activePage === 'menu' ? <MfdMenuPanel /> : null}
      </div>
      <div className="mfd__footer">
        <span>POS {position}</span>
        <span>{weatherLabel}</span>
        <span>{terrainLabel}</span>
        <span>{trafficLabel}</span>
      </div>
      <MenuSystem />
    </div>
  )
}
