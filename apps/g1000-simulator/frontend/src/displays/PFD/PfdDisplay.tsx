import type { PfdDisplayProps } from '../types'
import { AirspeedTape } from './AirspeedTape'
import { AlertOverlay } from './AlertOverlay'
import { AltimeterTape } from './AltimeterTape'
import { AutopilotStatus } from './AutopilotStatus'
import { AttitudeIndicator } from './AttitudeIndicator'
import { HSI } from './HSI'
import { formatCoordinate, formatNumber, formatSigned, normalizeHeading } from './formatters'
import { SoftkeyMenuSystem } from '../Shared/SoftkeyMenuSystem'

export function PfdDisplay({ telemetry, socketStatus }: PfdDisplayProps) {
  const heading = normalizeHeading(telemetry?.attitude.heading_deg)
  const headingDisplay = heading !== null ? `${heading.toString().padStart(3, '0')}°` : '---'
  const targetHeading = formatNumber(telemetry?.targets.heading_deg, '°')
  const turnRate = formatSigned(telemetry?.velocity.turn_rate_dps, '°/s')
  const airspeed = formatNumber(telemetry?.velocity.airspeed_kt, ' kt')
  const targetAirspeed = formatNumber(telemetry?.targets.airspeed_kt, ' kt')
  const altitude = formatNumber(telemetry?.position.altitude_ft, ' ft')
  const targetAltitude = formatNumber(telemetry?.targets.altitude_ft, ' ft')
  const verticalSpeed = formatSigned(telemetry?.velocity.vertical_speed_fpm, ' fpm')
  const baroSetting = '29.92 inHg'
  const navSource = telemetry ? 'GPS' : '---'
  const position = telemetry
    ? `${formatCoordinate(telemetry.position.latitude_deg)}, ${formatCoordinate(telemetry.position.longitude_deg)}`
    : '---'

  return (
    <div className="pfd">
      <div className="pfd__topbar">
        <span className="pfd__topbar-item">NAV {navSource}</span>
        <span className="pfd__topbar-item">HDG {headingDisplay}</span>
        <span className="pfd__topbar-item">ALT {altitude}</span>
        <span className="pfd__topbar-item">VS {verticalSpeed}</span>
      </div>
      <AutopilotStatus />
      <AlertOverlay socketStatus={socketStatus} telemetry={telemetry} />
      <div className="pfd__main">
        <AirspeedTape airspeed={airspeed} targetAirspeed={targetAirspeed} />
        <div className="pfd__center">
          <AttitudeIndicator telemetry={telemetry} />
          <HSI
            heading={headingDisplay}
            targetHeading={targetHeading}
            turnRate={turnRate}
            navSource={navSource}
          />
        </div>
        <AltimeterTape
          altitude={altitude}
          targetAltitude={targetAltitude}
          verticalSpeed={verticalSpeed}
          baroSetting={baroSetting}
        />
      </div>
      <div className="pfd__footer">
        <span>Position {position}</span>
        <span>SPD {airspeed}</span>
        <span>ALT SEL {targetAltitude}</span>
      </div>
      <SoftkeyMenuSystem context="pfd" ariaLabel="PFD softkeys" />
    </div>
  )
}
