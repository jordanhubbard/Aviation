import { useMemo, useState } from 'react'

import { AutopilotPanel } from './controls/AutopilotPanel'
import { ButtonPanel } from './controls/ButtonPanel'
import {
  PUSH_BUTTONS,
  PushButtonAnnunciator,
  PushButtonEvent,
} from './controls/pushButtonMap'
import { JoystickPanel } from './controls/JoystickPanel'
import { KeymapPanel } from './controls/KeymapPanel'
import { KeyboardShortcutLegend } from './controls/KeyboardShortcutLegend'
import { KeyboardShortcuts } from './controls/KeyboardShortcuts'
import { KnobController } from './controls/KnobController'
import { ThemeSelector } from './controls/ThemeSelector'
import { DisplayShell } from './displays/DisplayShell'
import { MfdDisplay } from './displays/MFD/MfdDisplay'
import { PfdDisplay } from './displays/PFD/PfdDisplay'
import { useCursorInput } from './hooks/useCursorInput'
import { useCommandSocket } from './hooks/useCommandSocket'
import { useTelemetrySocket } from './hooks/useTelemetrySocket'
import { AlertManager } from './services/alert-manager'
import { AutopilotProvider } from './stores/autopilotStore'
import { useThemePreference } from './stores/uiStore'

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
  const theme = useThemePreference()
  const alertManager = useMemo(() => new AlertManager(), [])

  useCursorInput()

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

  const handleButtonEvent = (event: PushButtonEvent) => {
    if (event.type === 'long-press') {
      setLastInput(`${event.button.label} HOLD`)
      return
    }
    if (event.button.action === 'reset-targets') {
      handleReset()
      return
    }
    if (event.button.action === 'sync-targets') {
      handleSync()
      return
    }
    setLastInput(event.button.label)
  }

  const alerts = alertManager.getAlerts({ telemetry, socketStatus })
  const highestAlert = alertManager.getHighestLevel(alerts)
  const annunciatorButtons = useMemo(() => {
    if (highestAlert === 'ok') {
      return {}
    }
    return { clr: highestAlert as PushButtonAnnunciator }
  }, [highestAlert])

  const backlitButtons = useMemo(
    () =>
      PUSH_BUTTONS.filter((button) => {
        if (button.group === 'system') {
          return commandStatus === 'connected'
        }
        return socketStatus === 'connected'
      }).map((button) => button.id),
    [commandStatus, socketStatus]
  )

  return (
    <AutopilotProvider>
      <div className="app" data-theme={theme}>
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
          <div className="app__header-controls">
            <ThemeSelector />
            <div className="app__status">
              Backend: /api/health · Telemetry: {socketStatus} · Commands: {commandStatus}
            </div>
          </div>
        </header>
        <main className="app__main">
          <DisplayShell title="Primary Flight Display" className="panel--pfd">
            <PfdDisplay telemetry={telemetry} socketStatus={socketStatus} />
          </DisplayShell>
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
                onEvent={handleButtonEvent}
                activeButtons={commandStatus === 'connected' ? ['sync'] : []}
                backlitButtons={backlitButtons}
                annunciatorButtons={annunciatorButtons}
                guardedButtons={['reset']}
              />
              <JoystickPanel />
              <KeymapPanel />
              <KeyboardShortcutLegend />
            </div>
            <AutopilotPanel />
          </section>
          <DisplayShell title="Multi-Function Display" className="panel--mfd">
            <MfdDisplay telemetry={telemetry} />
          </DisplayShell>
        </main>
      </div>
    </AutopilotProvider>
  )
}
