type HsiProps = {
  heading: string
  targetHeading: string
  turnRate: string
  navSource: string
  headingValue: number | null
  trackValue: number | null
  courseValue: number | null
  waypointId: string
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const computeDelta = (from: number, to: number) => ((to - from + 540) % 360) - 180

export function HSI({
  heading,
  targetHeading,
  turnRate,
  navSource,
  headingValue,
  trackValue,
  courseValue,
  waypointId,
}: HsiProps) {
  const headingRotation = headingValue !== null ? { transform: `rotate(${-headingValue}deg)` } : undefined
  const cdiDeviation =
    headingValue !== null && courseValue !== null ? clamp(computeDelta(headingValue, courseValue) / 10, -1, 1) : 0
  const cdiStyle = { transform: `translateX(calc(-50% + ${cdiDeviation * 22}px))` }
  const trackStyle =
    headingValue !== null && trackValue !== null
      ? { transform: `translate(-50%, -50%) rotate(${computeDelta(headingValue, trackValue)}deg)` }
      : undefined

  return (
    <div className="pfd__hsi">
      <div className="pfd__hsi-rose">
        <div className="pfd__hsi-rose-ring" style={headingRotation}>
          {['N', 'E', 'S', 'W'].map((label, index) => (
            <span
              key={label}
              className="pfd__hsi-cardinal"
              style={{ transform: `translateX(-50%) rotate(${index * 90}deg)` }}
            >
              <span style={{ transform: `rotate(${-index * 90}deg)` }}>{label}</span>
            </span>
          ))}
        </div>
        <div className="pfd__hsi-pointer" />
        {trackStyle ? <div className="pfd__hsi-track" style={trackStyle} /> : null}
        <div className="pfd__hsi-cdi">
          <div className="pfd__hsi-cdi-needle" style={cdiStyle} />
        </div>
      </div>
      <div className="pfd__hsi-row">
        <span className="pfd__hsi-label">Heading</span>
        <span className="pfd__hsi-value">{heading}</span>
        <span className="pfd__hsi-target">Bug {targetHeading}</span>
      </div>
      <div className="pfd__hsi-row pfd__hsi-row--secondary">
        <span>Turn {turnRate}</span>
        <span>Nav {navSource}</span>
        <span>WPT {waypointId}</span>
      </div>
    </div>
  )
}
