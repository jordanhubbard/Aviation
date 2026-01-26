import type { TelemetrySnapshot } from '../../hooks/useTelemetrySocket'
import { hasValue } from './formatters'

type AttitudeIndicatorProps = {
  telemetry: TelemetrySnapshot | null
}

export function AttitudeIndicator({ telemetry }: AttitudeIndicatorProps) {
  const pitch = telemetry?.attitude.pitch_deg ?? null
  const roll = telemetry?.attitude.roll_deg ?? null

  const pitchOffset = hasValue(pitch) ? Math.max(-20, Math.min(20, pitch)) : 0
  const rollOffset = hasValue(roll) ? roll : 0
  const attitudeStyle = {
    transform: `translateY(${pitchOffset * 2}px) rotate(${rollOffset}deg)`,
  }

  return (
    <div className="pfd__attitude">
      <div className="pfd__attitude-background" style={attitudeStyle} />
      <div className="pfd__attitude-overlay">
        <span className="pfd__attitude-label">Attitude</span>
        <div className="pfd__attitude-horizon" />
        <div className="pfd__attitude-aircraft" />
        <div className="pfd__attitude-values">
          <span>Pitch {hasValue(pitch) ? `${pitch.toFixed(1)}°` : '---'}</span>
          <span>Roll {hasValue(roll) ? `${roll.toFixed(1)}°` : '---'}</span>
        </div>
      </div>
    </div>
  )
}
