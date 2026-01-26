import { useEffect, useState } from 'react'

export type SocketStatus = 'unsupported' | 'connecting' | 'connected' | 'closed' | 'error'

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
  const [status, setStatus] = useState<SocketStatus>('connecting')
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !('WebSocket' in window)) {
      setStatus('unsupported')
      return
    }

    const url = resolveWebSocketUrl()
    if (!url) {
      setStatus('error')
      return
    }

    const socket = new WebSocket(url)
    setStatus('connecting')

    let pingTimer: number | null = null

    socket.onopen = () => {
      setStatus('connected')
      pingTimer = window.setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'ping' }))
        }
      }, 5000)
    }
    socket.onmessage = (event) => {
      if (typeof event.data !== 'string') return
      try {
        const message = JSON.parse(event.data)
        if (message?.type === 'telemetry' && message.payload) {
          setTelemetry(message.payload as TelemetrySnapshot)
        }
      } catch (error) {
        setStatus('error')
      }
    }
    socket.onclose = () => {
      if (pingTimer) {
        window.clearInterval(pingTimer)
      }
      setStatus('closed')
    }
    socket.onerror = () => {
      if (pingTimer) {
        window.clearInterval(pingTimer)
      }
      setStatus('error')
    }

    return () => {
      if (pingTimer) {
        window.clearInterval(pingTimer)
      }
      socket.close()
    }
  }, [])

  return { status, telemetry }
}
