import { TelemetrySnapshot } from '../../hooks/useTelemetrySocket'
import { EngineDisplay } from './EngineDisplay'
import { MapDisplay } from './MapDisplay'
import { MenuSystem } from './MenuSystem'

type MfdDisplayProps = {
  telemetry: TelemetrySnapshot | null
}

export const MfdDisplay = ({ telemetry }: MfdDisplayProps) => {
  const rangeNm = telemetry ? Math.round(Math.max(5, telemetry.velocity.airspeed_kt / 2)) : 25
  const heading = telemetry ? Math.round(telemetry.attitude.heading_deg) : null
  const altitude = telemetry ? Math.round(telemetry.position.altitude_ft) : null
  const position = telemetry
    ? `${telemetry.position.latitude_deg.toFixed(3)}°, ${telemetry.position.longitude_deg.toFixed(3)}°`
    : '---'

  return (
    <div className="mfd">
      <div className="mfd__header">
        <div>
          <p className="mfd__subtitle">Map - Navigation</p>
          <h3 className="mfd__title">Range {rangeNm} NM</h3>
        </div>
        <div className="mfd__status">
          <span>HDG {heading ?? '---'}°</span>
          <span>ALT {altitude ?? '---'} ft</span>
        </div>
      </div>
      <div className="mfd__content">
        <MapDisplay telemetry={telemetry} />
        <EngineDisplay telemetry={telemetry} />
      </div>
      <div className="mfd__footer">
        <span>POS {position}</span>
        <span>WX Clear</span>
        <span>TERR Normal</span>
      </div>
      <MenuSystem />
    </div>
  )
}
