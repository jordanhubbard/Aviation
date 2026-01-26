import { PfdDisplay } from './displays/PFD/PfdDisplay'
import { MfdDisplay } from './displays/MFD/MfdDisplay'
import { useTelemetrySocket } from './hooks/useTelemetrySocket'

export default function App() {
  const { status: socketStatus, telemetry } = useTelemetrySocket()

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

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <p className="app__subtitle">Garmin G1000 Simulator</p>
          <h1 className="app__title">Flight Deck Preview</h1>
        </div>
        <div className="app__status">
          Backend: /api/health · WebSocket: {socketStatus}
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
        </section>
        <section className="panel panel--mfd">
          <h2 className="panel__title">Multi-Function Display</h2>
          <MfdDisplay telemetry={telemetry} />
        </section>
      </main>
    </div>
  )
}
