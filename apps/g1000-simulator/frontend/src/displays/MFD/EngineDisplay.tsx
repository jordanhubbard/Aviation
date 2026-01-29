import { useEffect, useMemo, useRef, useState } from 'react'

import { TelemetrySnapshot } from '../../hooks/useTelemetrySocket'
import { useSoftkeyStore, useSoftkeyToggle } from '../../stores/softkeyStore'

type EngineDisplayProps = {
  telemetry: TelemetrySnapshot | null
  layout?: 'summary' | 'full'
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export const EngineDisplay = ({ telemetry, layout = 'summary' }: EngineDisplayProps) => {
  const lastAction = useSoftkeyStore((state) => state.contexts.mfd.lastAction)
  const showTemps = useSoftkeyToggle('mfd', 'mfd-engine-config', 'temps')
  const showFuel = useSoftkeyToggle('mfd', 'mfd-engine-config', 'fuel')
  const showElectrical = useSoftkeyToggle('mfd', 'mfd-engine-config', 'elect')
  const showPress = useSoftkeyToggle('mfd', 'mfd-engine-config', 'press')
  const [leanAssist, setLeanAssist] = useState(false)
  const fuelStartRef = useRef({ fuel: 46, startedAt: Date.now() })
  const isFull = layout === 'full'

  useEffect(() => {
    if (lastAction === 'mfd-engine-lean') {
      setLeanAssist((prev) => !prev)
    }
    if (lastAction === 'mfd-engine-reset') {
      fuelStartRef.current = { fuel: 46, startedAt: Date.now() }
    }
  }, [lastAction])

  const airspeed = telemetry?.velocity.airspeed_kt ?? 0

  const egtValues = useMemo(() => {
    const base = clamp(1280 + airspeed * 1.6, 1150, 1550)
    return Array.from({ length: 6 }, (_, index) =>
      Math.round(base + (index - 2.5) * 12 + Math.sin(index + airspeed / 40) * 8),
    )
  }, [airspeed])

  const chtValues = useMemo(() => {
    const base = clamp(330 + airspeed * 0.45, 300, 430)
    return Array.from({ length: 6 }, (_, index) =>
      Math.round(base + (index - 2.5) * 6 + Math.cos(index + airspeed / 50) * 5),
    )
  }, [airspeed])

  const peakEgt = Math.max(...egtValues)
  const peakCylinder = egtValues.findIndex((value) => value === peakEgt) + 1

  if (!telemetry) {
    return (
      <div className={`mfd__engine ${isFull ? 'mfd__engine--full' : ''}`}>
        <h4 className="mfd__engine-title">Engine</h4>
        <p className="mfd__engine-placeholder">Engine telemetry unavailable</p>
      </div>
    )
  }

  const rpm = Math.round(clamp(1900 + airspeed * 6, 1800, 2700))
  const oilTemp = Math.round(clamp(175 + airspeed * 0.35, 150, 245))
  const oilPressure = Math.round(clamp(50 + airspeed * 0.12, 40, 85))
  const fuelFlow = clamp(7 + airspeed * 0.03, 6, 14)
  const volts = clamp(27.5 + airspeed * 0.01, 27.5, 28.4)
  const amps = Math.round(clamp(20 + airspeed * 0.08, 18, 32))
  const manifoldPressure = clamp(18 + airspeed * 0.02, 18, 29)
  const batteryTemp = Math.round(clamp(80 + airspeed * 0.1, 70, 120))

  const elapsedHours = (Date.now() - fuelStartRef.current.startedAt) / 3_600_000
  const fuelRemaining = Math.max(0, fuelStartRef.current.fuel - fuelFlow * elapsedHours)
  const enduranceHours = fuelFlow > 0 ? fuelRemaining / fuelFlow : 0
  const rangeNm = enduranceHours * (telemetry.gps.ground_speed_kt ?? 0)

  const oilAlert = oilTemp > 230 || oilPressure < 45
  const oilCaution = oilTemp > 210 || oilPressure < 55
  const alertLabel = oilAlert ? 'OIL WARN' : oilCaution ? 'OIL CAUT' : 'ENGINE OK'

  return (
    <div className={`mfd__engine ${isFull ? 'mfd__engine--full' : ''}`}>
      <div className="mfd__engine-header">
        <h4 className="mfd__engine-title">Engine</h4>
        <span className={`mfd__engine-alert ${oilAlert ? 'mfd__engine-alert--warn' : oilCaution ? 'mfd__engine-alert--caution' : ''}`}>
          {alertLabel}
        </span>
      </div>
      <div className="mfd__engine-gauges">
        <div className="mfd__engine-gauge">
          <span className="mfd__engine-label">RPM</span>
          <span className="mfd__engine-value">{rpm}</span>
          <div className="mfd__engine-bar">
            <span style={{ width: `${(rpm / 2700) * 100}%` }} />
          </div>
        </div>
        <div className="mfd__engine-gauge">
          <span className="mfd__engine-label">OIL TEMP</span>
          <span className="mfd__engine-value">{oilTemp}°F</span>
          <div className="mfd__engine-bar">
            <span style={{ width: `${(oilTemp / 245) * 100}%` }} />
          </div>
        </div>
        <div className="mfd__engine-gauge">
          <span className="mfd__engine-label">OIL PRES</span>
          <span className="mfd__engine-value">{oilPressure} PSI</span>
          <div className="mfd__engine-bar">
            <span style={{ width: `${(oilPressure / 85) * 100}%` }} />
          </div>
        </div>
        {showPress ? (
          <div className="mfd__engine-gauge">
            <span className="mfd__engine-label">MP</span>
            <span className="mfd__engine-value">{manifoldPressure.toFixed(1)} IN</span>
            <div className="mfd__engine-bar">
              <span style={{ width: `${(manifoldPressure / 29) * 100}%` }} />
            </div>
          </div>
        ) : null}
      </div>

      {showTemps && isFull ? (
        <div className="mfd__engine-temps">
          <div className="mfd__engine-section-header">EGT / CHT</div>
          <div className="mfd__engine-cylinder-grid">
            {egtValues.map((egt, index) => (
              <div key={`egt-${index}`} className="mfd__engine-cylinder">
                <span className="mfd__engine-cylinder-label">C{index + 1}</span>
                <div className="mfd__engine-cylinder-bars">
                  <span className="mfd__engine-cylinder-bar" style={{ height: `${(egt / 1600) * 100}%` }} />
                  <span className="mfd__engine-cylinder-bar mfd__engine-cylinder-bar--cht" style={{ height: `${(chtValues[index] / 450) * 100}%` }} />
                </div>
                <span className="mfd__engine-cylinder-value">{egt}/{chtValues[index]}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {showFuel ? (
        <div className="mfd__engine-fuel">
          <div className="mfd__engine-section-header">Fuel</div>
          <div className="mfd__engine-fuel-grid">
            <div>
              <span className="mfd__engine-label">Fuel Flow</span>
              <span className="mfd__engine-value">{fuelFlow.toFixed(1)} GPH</span>
            </div>
            <div>
              <span className="mfd__engine-label">Remaining</span>
              <span className="mfd__engine-value">{fuelRemaining.toFixed(1)} GAL</span>
            </div>
            <div>
              <span className="mfd__engine-label">Endurance</span>
              <span className="mfd__engine-value">{enduranceHours.toFixed(1)} HR</span>
            </div>
            <div>
              <span className="mfd__engine-label">Range</span>
              <span className="mfd__engine-value">{rangeNm.toFixed(0)} NM</span>
            </div>
          </div>
        </div>
      ) : null}

      {showElectrical && isFull ? (
        <div className="mfd__engine-electrical">
          <div className="mfd__engine-section-header">Electrical</div>
          <div className="mfd__engine-electrical-grid">
            <div>
              <span className="mfd__engine-label">Bus</span>
              <span className="mfd__engine-value">{volts.toFixed(1)} V</span>
            </div>
            <div>
              <span className="mfd__engine-label">Load</span>
              <span className="mfd__engine-value">{amps} A</span>
            </div>
            <div>
              <span className="mfd__engine-label">Battery</span>
              <span className="mfd__engine-value">{batteryTemp}°F</span>
            </div>
            <div>
              <span className="mfd__engine-label">Alternator</span>
              <span className="mfd__engine-value">Online</span>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mfd__engine-lean">
        <span className="mfd__engine-label">Lean Assist</span>
        <span className="mfd__engine-value">
          {leanAssist ? `Peak C${peakCylinder} ${peakEgt}°` : 'Off'}
        </span>
      </div>
    </div>
  )
}
