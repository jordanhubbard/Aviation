import { useEffect } from 'react'

import type { TelemetrySnapshot, TelemetryUpdate } from '../types/telemetry'
import { useFlightStore } from '../stores/flightStore'
import { useWebSocketClient } from './useWebSocketClient'

export type { SocketStatus } from './useWebSocketClient'
export type { TelemetrySnapshot } from '../types/telemetry'

const resolveWebSocketUrl = () => {
  if (typeof window === 'undefined') return null
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const baseUrl = import.meta.env.VITE_WS_URL || `${protocol}://${window.location.host}`
  return `${baseUrl}/ws/telemetry`
}

export const useTelemetrySocket = () => {
  const telemetry = useFlightStore((state) => state.telemetry)
  const applyTelemetryUpdate = useFlightStore((state) => state.applyTelemetryUpdate)
  const setSocketStatus = useFlightStore((state) => state.setSocketStatus)
  const flightSocketStatus = useFlightStore((state) => state.socketStatus)
  const url = resolveWebSocketUrl()

  const { status, send } = useWebSocketClient({
    url,
    onMessage: (data) => {
      try {
        const message = JSON.parse(data) as {
          type?: string
          payload?: TelemetrySnapshot | TelemetryUpdate
        }
        if (message?.type === 'telemetry' && message.payload) {
          applyTelemetryUpdate(message.payload)
        }
        if (message?.type === 'telemetry_delta' && message.payload) {
          applyTelemetryUpdate(message.payload)
        }
      } catch (error) {
        applyTelemetryUpdate(null)
      }
    },
  })

  useEffect(() => {
    setSocketStatus(status)
  }, [setSocketStatus, status])

  useEffect(() => {
    if (status !== 'connected') {
      return
    }

    const pingTimer = window.setInterval(() => {
      send({ type: 'ping' })
    }, 5000)

    return () => {
      window.clearInterval(pingTimer)
    }
  }, [status, send])

  return { status: flightSocketStatus, telemetry }
}
