import { useEffect, useRef, useState } from 'react'

import type { SocketStatus, TelemetrySnapshot } from '../../hooks/useTelemetrySocket'
import { AlertManager, AlertItem } from '../../services/alert-manager'
import { playAlertTone } from '../../services/audio'

type AlertOverlayProps = {
  socketStatus: SocketStatus
  telemetry: TelemetrySnapshot | null
}

export function AlertOverlay({ socketStatus, telemetry }: AlertOverlayProps) {
  const managerRef = useRef(new AlertManager())
  const [updateCount, setUpdateCount] = useState(0)
  const lastToneRef = useRef<'ok' | 'info' | 'caution' | 'warning'>('ok')

  const alerts = managerRef.current.getAlerts({ telemetry, socketStatus })
  const visibleAlerts = alerts.slice(0, 4)
  const highestLevel = managerRef.current.getHighestLevel(alerts)

  useEffect(() => {
    const last = lastToneRef.current
    const levels = { ok: 0, info: 1, caution: 2, warning: 3 }
    if (levels[highestLevel] > levels[last]) {
      playAlertTone(highestLevel)
    }
    lastToneRef.current = highestLevel
  }, [highestLevel, updateCount])

  const handleAcknowledge = (alert: AlertItem) => {
    if (!alert.acknowledgeable || alert.acknowledged) return
    managerRef.current.acknowledge(alert.id)
    setUpdateCount((count) => count + 1)
  }

  return (
    <div className="pfd__alerts">
      {visibleAlerts.map((alert) => (
        <button
          key={alert.id}
          className={`pfd__alert pfd__alert--${alert.level}${
            alert.acknowledged ? ' pfd__alert--acked' : ''
          }${alert.acknowledgeable ? ' pfd__alert--actionable' : ''}`}
          type="button"
          onClick={() => handleAcknowledge(alert)}
          disabled={!alert.acknowledgeable}
          aria-pressed={alert.acknowledged}
        >
          <span className="pfd__alert-label">{alert.label}</span>
          <span className="pfd__alert-value">{alert.value}</span>
        </button>
      ))}
    </div>
  )
}
