type AltimeterTapeProps = {
  altitude: string
  targetAltitude: string
  verticalSpeed: string
  baroSetting: string
}

export function AltimeterTape({ altitude, targetAltitude, verticalSpeed, baroSetting }: AltimeterTapeProps) {
  return (
    <div className="pfd__tape">
      <span className="pfd__tape-title">Altitude</span>
      <span className="pfd__tape-value">{altitude}</span>
      <span className="pfd__tape-target">Bug {targetAltitude}</span>
      <span className="pfd__tape-meta">VSI {verticalSpeed}</span>
      <span className="pfd__tape-meta">Baro {baroSetting}</span>
    </div>
  )
}
