import { TelemetrySnapshot } from '../../hooks/useTelemetrySocket'

type MapDisplayProps = {
  telemetry: TelemetrySnapshot | null
}

const formatCoordinate = (value: number | null) =>
  value === null ? '---' : `${value.toFixed(2)}°`

export const MapDisplay = ({ telemetry }: MapDisplayProps) => {
  const latitude = telemetry?.position.latitude_deg ?? null
  const longitude = telemetry?.position.longitude_deg ?? null
  const groundTrack = telemetry?.attitude.heading_deg ?? null

  return (
    <div className="mfd__map">
      <div className="mfd__map-grid" />
      <div className="mfd__map-centerline" />
      <div className="mfd__map-marker">
        <span className="mfd__map-marker-label">ACFT</span>
      </div>
      <div className="mfd__map-overlay">
        <div>
          <span className="mfd__map-label">LAT</span>
          <span className="mfd__map-value">{formatCoordinate(latitude)}</span>
        </div>
        <div>
          <span className="mfd__map-label">LON</span>
          <span className="mfd__map-value">{formatCoordinate(longitude)}</span>
        </div>
        <div>
          <span className="mfd__map-label">TRK</span>
          <span className="mfd__map-value">{groundTrack ? `${Math.round(groundTrack)}°` : '---'}</span>
        </div>
      </div>
      <div className="mfd__map-legend">
        <span className="mfd__legend-item">APT</span>
        <span className="mfd__legend-item">VOR</span>
        <span className="mfd__legend-item">TFC</span>
        <span className="mfd__legend-item">WX</span>
      </div>
    </div>
  )
}
