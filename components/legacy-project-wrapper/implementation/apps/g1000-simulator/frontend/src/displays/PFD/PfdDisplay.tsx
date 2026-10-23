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
  const targetHeadingValue = normalizeHeading(telemetry?.targets.heading_deg)
  const targetHeading = formatNumber(telemetry?.targets.heading_deg, '°')
  const turnRate = formatSigned(telemetry?.velocity.turn_rate_dps, '°/s')
  const airspeedValue = telemetry?.adc.ias_kt ?? telemetry?.velocity.airspeed_kt ?? null
  const tasValue = telemetry?.adc.tas_kt ?? null
  const targetAirspeedValue = telemetry?.targets.airspeed_kt ?? null
  const groundSpeedValue = telemetry?.gps.ground_speed_kt ?? null
  const airspeed = formatNumber(airspeedValue, ' kt')
  const targetAirspeed = formatNumber(targetAirspeedValue, ' kt')
  const altitudeValue = telemetry?.position.altitude_ft ?? null
  const targetAltitudeValue = telemetry?.targets.altitude_ft ?? null
  const altitude = formatNumber(altitudeValue, ' ft')
  const targetAltitude = formatNumber(targetAltitudeValue, ' ft')
  const verticalSpeedValue = telemetry?.adc.vertical_speed_fpm ?? telemetry?.velocity.vertical_speed_fpm
  const verticalSpeed = formatSigned(verticalSpeedValue, ' fpm')
  const baroSetting = '29.92 inHg'
  const navSource = telemetry?.gps.fix_valid ? 'GPS' : '---'
  const trackValue = normalizeHeading(telemetry?.gps.track_deg)
  const waypointId =
    telemetry?.dme.station_ident || telemetry?.adf.station_ident || (telemetry?.gps.fix_valid ? 'GPS' : '---')
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
        <AirspeedTape
          airspeed={airspeed}
          targetAirspeed={targetAirspeed}
          indicatedAirspeed={airspeedValue}
          trueAirspeed={tasValue}
          targetAirspeedValue={targetAirspeedValue}
          groundSpeed={groundSpeedValue}
        />
        <div className="pfd__center">
          <AttitudeIndicator telemetry={telemetry} />
          <HSI
            heading={headingDisplay}
            targetHeading={targetHeading}
            turnRate={turnRate}
            navSource={navSource}
            headingValue={heading}
            trackValue={trackValue}
            courseValue={targetHeadingValue}
            waypointId={waypointId}
          />
        </div>
        <AltimeterTape
          altitude={altitude}
          targetAltitude={targetAltitude}
          verticalSpeed={verticalSpeed}
          baroSetting={baroSetting}
          altitudeValue={altitudeValue}
          targetAltitudeValue={targetAltitudeValue}
          verticalSpeedValue={verticalSpeedValue ?? null}
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
