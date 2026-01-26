type AirspeedTapeProps = {
  airspeed: string
  targetAirspeed: string
}

export function AirspeedTape({ airspeed, targetAirspeed }: AirspeedTapeProps) {
  return (
    <div className="pfd__tape">
      <span className="pfd__tape-title">Airspeed</span>
      <span className="pfd__tape-value">{airspeed}</span>
      <span className="pfd__tape-target">Bug {targetAirspeed}</span>
    </div>
  )
}
