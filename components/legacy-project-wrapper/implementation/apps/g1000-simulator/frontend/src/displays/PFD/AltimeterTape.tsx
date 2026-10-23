import { hasValue } from './formatters'

type AltimeterTapeProps = {
  altitude: string
  targetAltitude: string
  verticalSpeed: string
  baroSetting: string
  altitudeValue: number | null
  targetAltitudeValue: number | null
  verticalSpeedValue: number | null
}

export function AltimeterTape({
  altitude,
  targetAltitude,
  verticalSpeed,
  baroSetting,
  altitudeValue,
  targetAltitudeValue,
  verticalSpeedValue,
}: AltimeterTapeProps) {
  const altitudeRange = 1000
  const altitudeMarks = [-400, -200, 0, 200, 400]
  const altitudeAlert =
    hasValue(altitudeValue) &&
    hasValue(targetAltitudeValue) &&
    Math.abs(altitudeValue - targetAltitudeValue) <= 200
  const altitudeDelta =
    hasValue(altitudeValue) && hasValue(targetAltitudeValue) ? targetAltitudeValue - altitudeValue : null
  const clampDelta = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value))
  const toPercent = (value: number) =>
    ((clampDelta(value, altitudeRange) + altitudeRange) / (altitudeRange * 2)) * 100
  const bugStyle = altitudeDelta !== null ? { bottom: `${toPercent(altitudeDelta)}%` } : undefined
  const vsiStyle =
    hasValue(verticalSpeedValue) && verticalSpeedValue !== 0
      ? { bottom: `${toPercent((verticalSpeedValue / 2000) * altitudeRange)}%` }
      : undefined

  return (
    <div className={`pfd__tape pfd__tape--altimeter${altitudeAlert ? ' pfd__tape--alert' : ''}`}>
      <span className="pfd__tape-title">Altitude</span>
      <div className="pfd__tape-scale pfd__tape-scale--altitude">
        {altitudeMarks.map((mark) => (
          <span key={mark} className="pfd__tape-mark" style={{ bottom: `${toPercent(mark)}%` }}>
            <span className="pfd__tape-mark-label">
              {hasValue(altitudeValue) ? Math.round(altitudeValue + mark).toString() : '---'}
            </span>
          </span>
        ))}
        {bugStyle ? <span className="pfd__tape-bug" style={bugStyle} /> : null}
        {vsiStyle ? <span className="pfd__tape-vsi" style={vsiStyle} /> : null}
      </div>
      <span className="pfd__tape-value">{altitude}</span>
      <span className="pfd__tape-target">Bug {targetAltitude}</span>
      {altitudeAlert ? <span className="pfd__tape-alert">ALT ALERT</span> : null}
      <span className="pfd__tape-meta">VSI {verticalSpeed}</span>
      <span className="pfd__tape-meta">Baro {baroSetting}</span>
    </div>
  )
}
