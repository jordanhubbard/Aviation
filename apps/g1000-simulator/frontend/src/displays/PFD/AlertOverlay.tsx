import type { SocketStatus, TelemetrySnapshot } from '../../hooks/useTelemetrySocket'
import { formatNumber } from './formatters'

type AlertOverlayProps = {
  socketStatus: SocketStatus
  telemetry: TelemetrySnapshot | null
}

type AlertTone = 'ok' | 'caution' | 'warning' | 'info'

const statusToneMap: Record<SocketStatus, AlertTone> = {
  connected: 'ok',
  connecting: 'caution',
  unsupported: 'warning',
  closed: 'warning',
  error: 'warning',
}

export function AlertOverlay({ socketStatus, telemetry }: AlertOverlayProps) {
  const statusLabel = socketStatus === 'connected' ? 'Live' : socketStatus
  const statusTone = statusToneMap[socketStatus]

  const items: Array<{ label: string; value: string; tone: AlertTone }> = [
    { label: 'Data', value: statusLabel, tone: statusTone },
    {
      label: 'ALT SEL',
      value: formatNumber(telemetry?.targets.altitude_ft, ' ft'),
      tone: 'info',
    },
    {
      label: 'HDG SEL',
      value: formatNumber(telemetry?.targets.heading_deg, '°'),
      tone: 'info',
    },
    {
      label: 'SPD SEL',
      value: formatNumber(telemetry?.targets.airspeed_kt, ' kt'),
      tone: 'info',
    },
  ]

  return (
    <div className="pfd__alerts">
      {items.map((item) => (
        <div key={item.label} className={`pfd__alert pfd__alert--${item.tone}`}>
          <span className="pfd__alert-label">{item.label}</span>
          <span className="pfd__alert-value">{item.value}</span>
        </div>
      ))}
    </div>
  )
}
