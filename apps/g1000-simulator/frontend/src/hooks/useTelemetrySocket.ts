import { useEffect, useState } from 'react'

import { useWebSocketClient } from './useWebSocketClient'

export type { SocketStatus } from './useWebSocketClient'

export type TelemetrySnapshot = {
  position: {
    latitude_deg: number
    longitude_deg: number
    altitude_ft: number
  }
  attitude: {
    heading_deg: number
    pitch_deg: number
    roll_deg: number
  }
  velocity: {
    airspeed_kt: number
    vertical_speed_fpm: number
    turn_rate_dps: number
  }
  targets: {
    heading_deg: number
    altitude_ft: number
    airspeed_kt: number
  }
  timestamp: number
}

const resolveWebSocketUrl = () => {
  if (typeof window === 'undefined') return null
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const baseUrl = import.meta.env.VITE_WS_URL || `${protocol}://${window.location.host}`
  return `${baseUrl}/ws/telemetry`
}

export const useTelemetrySocket = () => {
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot | null>(null)
  const url = resolveWebSocketUrl()

  const { status, send } = useWebSocketClient({
    url,
    onMessage: (data) => {
      try {
        const message = JSON.parse(data)
        if (message?.type === 'telemetry' && message.payload) {
          setTelemetry(message.payload as TelemetrySnapshot)
        }
      } catch (error) {
        setTelemetry(null)
      }
    },
  })

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

  return { status, telemetry }
}
