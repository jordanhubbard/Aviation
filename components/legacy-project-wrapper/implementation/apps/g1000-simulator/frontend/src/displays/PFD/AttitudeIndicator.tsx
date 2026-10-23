import type { TelemetrySnapshot } from '../../hooks/useTelemetrySocket'
import { hasValue } from './formatters'

type AttitudeIndicatorProps = {
  telemetry: TelemetrySnapshot | null
}

export function AttitudeIndicator({ telemetry }: AttitudeIndicatorProps) {
  const pitch = telemetry?.attitude.pitch_deg ?? null
  const roll = telemetry?.attitude.roll_deg ?? null
  const slipSkid = telemetry?.attitude.slip_skid_deg ?? null
  const pitchScale = 3
  const pitchMarks = [-20, -15, -10, -5, 5, 10, 15, 20]
  const bankMarks = [-60, -45, -30, -20, -10, 10, 20, 30, 45, 60]

  const pitchOffset = hasValue(pitch) ? Math.max(-30, Math.min(30, pitch)) : 0
  const rollOffset = hasValue(roll) ? roll : 0
  const slipOffset = hasValue(slipSkid) ? Math.max(-10, Math.min(10, slipSkid)) * 2 : 0
  const attitudeStyle = {
    transform: `translateY(${pitchOffset * pitchScale}px) rotate(${rollOffset}deg)`,
  }

  return (
    <div className="pfd__attitude">
      <div className="pfd__attitude-background" style={attitudeStyle}>
        <div className="pfd__attitude-ladder">
          {pitchMarks.map((mark) => (
            <div
              key={mark}
              className="pfd__attitude-ladder-mark"
              style={{ top: `calc(50% - ${mark * pitchScale}px)` }}
            >
              <span className="pfd__attitude-ladder-label">{Math.abs(mark)}</span>
              <span className="pfd__attitude-ladder-line" />
              <span className="pfd__attitude-ladder-label">{Math.abs(mark)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="pfd__attitude-overlay">
        <span className="pfd__attitude-label">Attitude</span>
        <div className="pfd__attitude-bank">
          {bankMarks.map((mark) => (
            <span
              key={mark}
              className={`pfd__attitude-bank-mark${
                Math.abs(mark) >= 30 ? ' pfd__attitude-bank-mark--major' : ''
              }`}
              style={{ transform: `rotate(${mark}deg)` }}
            />
          ))}
          <div
            className="pfd__attitude-bank-pointer"
            style={{ transform: `translateX(-50%) rotate(${rollOffset}deg)` }}
          />
        </div>
        <div className="pfd__attitude-horizon" />
        <div className="pfd__attitude-aircraft" />
        <div className="pfd__attitude-slip">
          <span className="pfd__attitude-slip-track" />
          <span
            className="pfd__attitude-slip-ball"
            style={{ transform: `translateX(calc(-50% + ${slipOffset}px))` }}
          />
        </div>
        <div className="pfd__attitude-values">
          <span>Pitch {hasValue(pitch) ? `${pitch.toFixed(1)}°` : '---'}</span>
          <span>Roll {hasValue(roll) ? `${roll.toFixed(1)}°` : '---'}</span>
        </div>
      </div>
    </div>
  )
}
