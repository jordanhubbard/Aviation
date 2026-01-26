import { useState } from 'react'

import { ButtonPanel } from './controls/ButtonPanel'
import { KeyboardShortcuts } from './controls/KeyboardShortcuts'
import { KnobController } from './controls/KnobController'
import { MfdDisplay } from './displays/MFD/MfdDisplay'
import { PfdDisplay } from './displays/PFD/PfdDisplay'
import { useCommandSocket } from './hooks/useCommandSocket'
import { useTelemetrySocket } from './hooks/useTelemetrySocket'

const DEFAULT_TARGETS = {
  heading_deg: 90,
  altitude_ft: 4500,
  airspeed_kt: 110,
}

const normalizeHeading = (value: number) => ((value % 360) + 360) % 360

export default function App() {
  const { status: socketStatus, telemetry } = useTelemetrySocket()
  const { status: commandStatus, sendCommand } = useCommandSocket()
  const [lastInput, setLastInput] = useState('---')

  const telemetryItems = [
    {
      label: 'Altitude',
      value: telemetry ? `${Math.round(telemetry.position.altitude_ft)} ft` : '---',
    },
    {
      label: 'Heading',
      value: telemetry ? `${Math.round(telemetry.attitude.heading_deg)}°` : '---',
    },
    {
      label: 'Airspeed',
      value: telemetry ? `${Math.round(telemetry.velocity.airspeed_kt)} kt` : '---',
    },
    {
      label: 'Vertical Speed',
      value: telemetry ? `${Math.round(telemetry.velocity.vertical_speed_fpm)} fpm` : '---',
    },
    {
      label: 'Target Altitude',
      value: telemetry ? `${Math.round(telemetry.targets.altitude_ft)} ft` : '---',
    },
    {
      label: 'Target Heading',
      value: telemetry ? `${Math.round(telemetry.targets.heading_deg)}°` : '---',
    },
  ]

  const handleHeadingStep = (delta: number) => {
    const heading = normalizeHeading(
      (telemetry?.targets.heading_deg ?? DEFAULT_TARGETS.heading_deg) + delta,
    )
    sendCommand({ type: 'set_targets', targets: { heading_deg: heading } })
    setLastInput(`HDG ${delta > 0 ? '+' : ''}${delta}`)
  }

  const handleAltitudeStep = (delta: number) => {
    const altitude = Math.max(
      0,
      (telemetry?.targets.altitude_ft ?? DEFAULT_TARGETS.altitude_ft) + delta,
    )
    sendCommand({ type: 'set_targets', targets: { altitude_ft: altitude } })
    setLastInput(`ALT ${delta > 0 ? '+' : ''}${delta}`)
  }

  const handleAirspeedStep = (delta: number) => {
    const airspeed = Math.max(
      0,
      (telemetry?.targets.airspeed_kt ?? DEFAULT_TARGETS.airspeed_kt) + delta,
    )
    sendCommand({ type: 'set_targets', targets: { airspeed_kt: airspeed } })
    setLastInput(`SPD ${delta > 0 ? '+' : ''}${delta}`)
  }

  const handleReset = () => {
    sendCommand({ type: 'reset' })
    setLastInput('RESET')
  }

  const handleSync = () => {
    if (!telemetry) return
    sendCommand({
      type: 'set_targets',
      targets: {
        heading_deg: telemetry.attitude.heading_deg,
        altitude_ft: telemetry.position.altitude_ft,
        airspeed_kt: telemetry.velocity.airspeed_kt,
      },
    })
    setLastInput('SYNC')
  }

  const handleButtonPress = (id: string) => {
    if (id === 'reset') {
      handleReset()
      return
    }
    if (id === 'sync') {
      handleSync()
      return
    }
    setLastInput(id.toUpperCase())
  }

  return (
    <div className="app">
      <KeyboardShortcuts
        onHeadingStep={handleHeadingStep}
        onAltitudeStep={handleAltitudeStep}
        onAirspeedStep={handleAirspeedStep}
        onReset={handleReset}
        onSync={handleSync}
      />
      <header className="app__header">
        <div>
          <p className="app__subtitle">Garmin G1000 Simulator</p>
          <h1 className="app__title">Flight Deck Preview</h1>
        </div>
        <div className="app__status">
          Backend: /api/health · Telemetry: {socketStatus} · Commands: {commandStatus}
        </div>
      </header>
      <main className="app__main">
        <section className="panel panel--pfd">
          <h2 className="panel__title">Primary Flight Display</h2>
          <PfdDisplay telemetry={telemetry} socketStatus={socketStatus} />
        </section>
        <section className="panel panel--telemetry">
          <h2 className="panel__title">Live Telemetry</h2>
          <div className="telemetry-grid">
            {telemetryItems.map((item) => (
              <div key={item.label} className="telemetry-item">
                <span className="telemetry-item__label">{item.label}</span>
                <span className="telemetry-item__value">{item.value}</span>
              </div>
            ))}
          </div>
          <div className="controls">
            <div className="controls__header">
              <h3 className="controls__title">Input Controls</h3>
              <span className="controls__status">Last Input: {lastInput}</span>
            </div>
            <div className="controls__grid">
              <KnobController
                label="Heading Bug"
                value={telemetry ? Math.round(telemetry.targets.heading_deg) : null}
                unit="°"
                coarseStep={10}
                fineStep={1}
                onStep={handleHeadingStep}
              />
              <KnobController
                label="Altitude Bug"
                value={telemetry ? Math.round(telemetry.targets.altitude_ft) : null}
                unit=" ft"
                coarseStep={500}
                fineStep={100}
                onStep={handleAltitudeStep}
              />
              <KnobController
                label="Airspeed Bug"
                value={telemetry ? Math.round(telemetry.targets.airspeed_kt) : null}
                unit=" kt"
                coarseStep={5}
                fineStep={1}
                onStep={handleAirspeedStep}
              />
            </div>
            <ButtonPanel
              onPress={handleButtonPress}
              activeButtons={commandStatus === 'connected' ? ['sync'] : []}
            />
            <div className="controls__shortcuts">
              Shortcuts: H/L heading · A/Z altitude · S/X speed · R reset · T sync
            </div>
          </div>
        </section>
        <section className="panel panel--mfd">
          <h2 className="panel__title">Multi-Function Display</h2>
          <MfdDisplay telemetry={telemetry} />
        </section>
      </main>
    </div>
  )
}
