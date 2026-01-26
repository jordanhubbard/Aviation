import { TelemetrySnapshot } from '../../hooks/useTelemetrySocket'

type EngineDisplayProps = {
  telemetry: TelemetrySnapshot | null
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export const EngineDisplay = ({ telemetry }: EngineDisplayProps) => {
  if (!telemetry) {
    return (
      <div className="mfd__engine">
        <h4 className="mfd__engine-title">Engine</h4>
        <p className="mfd__engine-placeholder">Engine telemetry unavailable</p>
      </div>
    )
  }

  const airspeed = telemetry.velocity.airspeed_kt
  const rpm = Math.round(clamp(1900 + airspeed * 6, 1800, 2700))
  const oilTemp = Math.round(clamp(175 + airspeed * 0.35, 150, 245))
  const oilPressure = Math.round(clamp(50 + airspeed * 0.12, 40, 85))
  const fuelFlow = clamp(7 + airspeed * 0.03, 6, 14).toFixed(1)
  const volts = clamp(27.5 + airspeed * 0.01, 27.5, 28.4).toFixed(1)
  const amps = Math.round(clamp(20 + airspeed * 0.08, 18, 32))

  const items = [
    { label: 'RPM', value: rpm, unit: '' },
    { label: 'OIL TEMP', value: oilTemp, unit: '°F' },
    { label: 'OIL PRES', value: oilPressure, unit: 'PSI' },
    { label: 'FUEL FLOW', value: fuelFlow, unit: 'GPH' },
    { label: 'VOLTS', value: volts, unit: 'V' },
    { label: 'AMPS', value: amps, unit: 'A' },
  ]

  return (
    <div className="mfd__engine">
      <h4 className="mfd__engine-title">Engine</h4>
      <div className="mfd__engine-grid">
        {items.map((item) => (
          <div key={item.label} className="mfd__engine-item">
            <span className="mfd__engine-label">{item.label}</span>
            <span className="mfd__engine-value">
              {item.value} {item.unit}
            </span>
          </div>
        ))}
      </div>
      <div className="mfd__engine-footer">Fuel Qty 42.0 gal · Lean Assist Off</div>
    </div>
  )
}
