import { formatNumber, hasValue } from './formatters'
import { C172S_OPERATING_PROFILE } from '../../integrations/sharedSdk'

const MIN_SPEED = 0
const MAX_SPEED = 200

type AirspeedTapeProps = {
  airspeed: string
  targetAirspeed: string
  indicatedAirspeed: number | null
  trueAirspeed: number | null
  targetAirspeedValue: number | null
  groundSpeed: number | null
}

const clampSpeed = (value: number) => Math.max(MIN_SPEED, Math.min(MAX_SPEED, value))

const toPercent = (value: number) =>
  ((clampSpeed(value) - MIN_SPEED) / (MAX_SPEED - MIN_SPEED)) * 100

export function AirspeedTape({
  airspeed,
  targetAirspeed,
  indicatedAirspeed,
  trueAirspeed,
  targetAirspeedValue,
  groundSpeed,
}: AirspeedTapeProps) {
  const limits = C172S_OPERATING_PROFILE.airspeedLimits
  const indicatorStyle = hasValue(indicatedAirspeed)
    ? { bottom: `${toPercent(indicatedAirspeed)}%` }
    : undefined
  const trendDelta =
    hasValue(indicatedAirspeed) && hasValue(targetAirspeedValue)
      ? clampSpeed(indicatedAirspeed + Math.max(-20, Math.min(20, targetAirspeedValue - indicatedAirspeed))) -
        indicatedAirspeed
      : null
  const trendStyle =
    hasValue(indicatedAirspeed) && trendDelta !== null
      ? {
          bottom: `${Math.min(
            toPercent(indicatedAirspeed),
            toPercent(indicatedAirspeed + trendDelta),
          )}%`,
          height: `${Math.abs(toPercent(indicatedAirspeed + trendDelta) - toPercent(indicatedAirspeed))}%`,
        }
      : undefined

  const arcs = [
    { id: 'white', start: limits.vsoKias, end: limits.vfeKias, className: 'pfd__tape-arc--white' },
    { id: 'green', start: limits.vsKias, end: limits.vnoKias, className: 'pfd__tape-arc--green' },
    { id: 'yellow', start: limits.vnoKias, end: limits.vneKias, className: 'pfd__tape-arc--yellow' },
  ]

  return (
    <div className="pfd__tape pfd__tape--airspeed">
      <span className="pfd__tape-title">Airspeed</span>
      <div className="pfd__tape-scale">
        <div className="pfd__tape-arcs">
          {arcs.map((arc) => (
            <span
              key={arc.id}
              className={`pfd__tape-arc ${arc.className}`}
              style={{
                bottom: `${toPercent(arc.start)}%`,
                height: `${Math.max(2, toPercent(arc.end) - toPercent(arc.start))}%`,
              }}
            />
          ))}
        </div>
        <span className="pfd__tape-vne" style={{ bottom: `${toPercent(limits.vneKias)}%` }} />
        {indicatorStyle ? <span className="pfd__tape-indicator" style={indicatorStyle} /> : null}
        {trendStyle ? <span className="pfd__tape-trend" style={trendStyle} /> : null}
      </div>
      <span className="pfd__tape-value">{airspeed}</span>
      <span className="pfd__tape-target">Bug {targetAirspeed}</span>
      <span className="pfd__tape-meta">TAS {formatNumber(trueAirspeed, ' kt')}</span>
      <span className="pfd__tape-meta">GS {formatNumber(groundSpeed, ' kt')}</span>
      <span className="pfd__tape-meta">MAX {limits.vneKias} kt</span>
    </div>
  )
}
