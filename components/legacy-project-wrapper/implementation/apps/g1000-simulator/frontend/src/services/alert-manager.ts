import type { SocketStatus, TelemetrySnapshot } from '../hooks/useTelemetrySocket'
import { formatNumber } from '../displays/PFD/formatters'
import {
  highestAlertLevel,
  orderAlerts,
  reconcileAcknowledgements,
} from '@aviation/shared-sdk/aviation/alerts'

export type AlertLevel = 'ok' | 'info' | 'caution' | 'warning'

export type AlertItem = {
  id: string
  label: string
  value: string
  level: AlertLevel
  acknowledgeable: boolean
  acknowledged: boolean
}

export type AlertContext = {
  telemetry: TelemetrySnapshot | null
  socketStatus: SocketStatus
}

const isAcknowledgeable = (level: AlertLevel) => level === 'warning' || level === 'caution'

const statusToneMap: Record<SocketStatus, AlertLevel> = {
  connected: 'ok',
  connecting: 'caution',
  unsupported: 'warning',
  closed: 'warning',
  error: 'warning',
}

export class AlertManager {
  private acknowledgements = new Set<string>()

  acknowledge(id: string) {
    this.acknowledgements.add(id)
  }

  getAlerts(context: AlertContext): AlertItem[] {
    const rawAlerts = this.buildAlerts(context)
    this.acknowledgements = new Set(reconcileAcknowledgements(
      rawAlerts.map((alert) => alert.id),
      [...this.acknowledgements],
    ))

    const alerts = rawAlerts.map((alert) => ({
      ...alert,
      acknowledged: this.acknowledgements.has(alert.id),
    }))

    return orderAlerts(alerts)
  }

  getHighestLevel(alerts: AlertItem[], includeAcknowledged = false): AlertLevel {
    const level = highestAlertLevel(alerts, includeAcknowledged)
    if (level === 'normal') return 'ok'
    if (level === 'advisory') return 'info'
    return level
  }

  private buildAlerts({ telemetry, socketStatus }: AlertContext) {
    const alerts: Array<Omit<AlertItem, 'acknowledged'>> = []
    const statusLabel = socketStatus === 'connected' ? 'Live' : socketStatus

    alerts.push({
      id: 'data-status',
      label: 'Data',
      value: statusLabel,
      level: statusToneMap[socketStatus],
      acknowledgeable: isAcknowledgeable(statusToneMap[socketStatus]),
    })

    alerts.push({
      id: 'alt-sel',
      label: 'ALT SEL',
      value: formatNumber(telemetry?.targets.altitude_ft, ' ft'),
      level: 'info',
      acknowledgeable: false,
    })
    alerts.push({
      id: 'hdg-sel',
      label: 'HDG SEL',
      value: formatNumber(telemetry?.targets.heading_deg, '°'),
      level: 'info',
      acknowledgeable: false,
    })
    alerts.push({
      id: 'spd-sel',
      label: 'SPD SEL',
      value: formatNumber(telemetry?.targets.airspeed_kt, ' kt'),
      level: 'info',
      acknowledgeable: false,
    })

    if (!telemetry) {
      return alerts
    }

    const airspeed = telemetry.velocity.airspeed_kt
    if (airspeed >= 160) {
      alerts.push({
        id: 'overspeed',
        label: 'OVERSPEED',
        value: formatNumber(airspeed, ' kt'),
        level: 'warning',
        acknowledgeable: true,
      })
    } else if (airspeed <= 60) {
      alerts.push({
        id: 'stall',
        label: 'LOW SPD',
        value: formatNumber(airspeed, ' kt'),
        level: 'caution',
        acknowledgeable: true,
      })
    }

    const altitudeDelta = Math.abs(telemetry.position.altitude_ft - telemetry.targets.altitude_ft)
    if (altitudeDelta >= 250) {
      alerts.push({
        id: 'altitude-dev',
        label: 'ALT DEV',
        value: formatNumber(altitudeDelta, ' ft'),
        level: 'caution',
        acknowledgeable: true,
      })
    }

    const headingDelta = Math.abs(
      ((telemetry.attitude.heading_deg - telemetry.targets.heading_deg + 540) % 360) - 180,
    )
    if (headingDelta >= 20) {
      alerts.push({
        id: 'heading-dev',
        label: 'HDG DEV',
        value: formatNumber(headingDelta, '°'),
        level: 'info',
        acknowledgeable: false,
      })
    }

    return alerts
  }
}
