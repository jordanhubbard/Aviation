type HsiProps = {
  heading: string
  targetHeading: string
  turnRate: string
  navSource: string
}

export function HSI({ heading, targetHeading, turnRate, navSource }: HsiProps) {
  return (
    <div className="pfd__hsi">
      <div className="pfd__hsi-row">
        <span className="pfd__hsi-label">Heading</span>
        <span className="pfd__hsi-value">{heading}</span>
        <span className="pfd__hsi-target">Bug {targetHeading}</span>
      </div>
      <div className="pfd__hsi-row pfd__hsi-row--secondary">
        <span>Turn {turnRate}</span>
        <span>Nav {navSource}</span>
      </div>
    </div>
  )
}
