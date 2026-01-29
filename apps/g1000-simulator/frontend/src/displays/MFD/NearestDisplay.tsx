import { TelemetrySnapshot } from '../../hooks/useTelemetrySocket'

type NearestDisplayProps = {
  telemetry: TelemetrySnapshot | null
}

export const NearestDisplay = ({ telemetry }: NearestDisplayProps) => {
  const altitude = telemetry?.position.altitude_ft ?? 0
  const items = [
    { id: 'KSFO', type: 'Airport', distance: 4.2, bearing: 182, info: '118.50' },
    { id: 'KOAK', type: 'Airport', distance: 9.1, bearing: 45, info: '127.20' },
    { id: 'SFO', type: 'VOR', distance: 12.4, bearing: 270, info: '115.80' },
    { id: 'CCR', type: 'NDB', distance: 18.6, bearing: 320, info: '362' },
    { id: 'BOSDY', type: 'INT', distance: 25.3, bearing: 90, info: 'IFR FIX' },
  ]

  return (
    <div className="mfd__panel">
      <h4 className="mfd__panel-title">Nearest</h4>
      <div className="mfd__nearest-header">
        <span>Current Alt</span>
        <strong>{altitude.toFixed(0)} ft</strong>
      </div>
      <div className="mfd__nearest-list">
        {items.map((item) => (
          <div key={item.id} className="mfd__nearest-row">
            <div>
              <span className="mfd__nearest-id">{item.id}</span>
              <span className="mfd__nearest-type">{item.type}</span>
            </div>
            <div className="mfd__nearest-meta">
              <span>{item.distance.toFixed(1)} NM</span>
              <span>{item.bearing.toString().padStart(3, '0')}°</span>
            </div>
            <div className="mfd__nearest-info">{item.info}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
