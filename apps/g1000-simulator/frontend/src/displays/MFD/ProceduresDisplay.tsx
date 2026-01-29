export const ProceduresDisplay = () => {
  const departures = ['SFO OFFSHORE', 'SERFR', 'PORTE']
  const arrivals = ['BDEGA TWO', 'INYOE TWO', 'MOD TWO']
  const approaches = ['ILS RWY 28L', 'RNAV RWY 28R', 'VOR RWY 10L']

  return (
    <div className="mfd__panel">
      <h4 className="mfd__panel-title">Procedures</h4>
      <div className="mfd__proc-grid">
        <div>
          <span className="mfd__proc-title">Departures</span>
          {departures.map((procedure) => (
            <div key={procedure} className="mfd__proc-item">
              {procedure}
            </div>
          ))}
        </div>
        <div>
          <span className="mfd__proc-title">Arrivals</span>
          {arrivals.map((procedure) => (
            <div key={procedure} className="mfd__proc-item">
              {procedure}
            </div>
          ))}
        </div>
        <div>
          <span className="mfd__proc-title">Approaches</span>
          {approaches.map((procedure) => (
            <div key={procedure} className="mfd__proc-item">
              {procedure}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
