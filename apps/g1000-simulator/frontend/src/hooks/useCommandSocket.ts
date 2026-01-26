import { useCallback, useEffect, useRef, useState } from 'react'

import type { SocketStatus } from './useTelemetrySocket'

export type CommandMessage =
  | {
      type: 'reset'
    }
  | {
      type: 'set_targets'
      targets: {
        heading_deg?: number
        altitude_ft?: number
        airspeed_kt?: number
      }
    }

const resolveCommandSocketUrl = () => {
  if (typeof window === 'undefined') return null
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const baseUrl = import.meta.env.VITE_WS_URL || `${protocol}://${window.location.host}`
  return `${baseUrl}/ws/commands`
}

export const useCommandSocket = () => {
  const [status, setStatus] = useState<SocketStatus>('connecting')
  const socketRef = useRef<WebSocket | null>(null)

  const sendCommand = useCallback((message: CommandMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message))
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !('WebSocket' in window)) {
      setStatus('unsupported')
      return
    }

    const url = resolveCommandSocketUrl()
    if (!url) {
      setStatus('error')
      return
    }

    const socket = new WebSocket(url)
    socketRef.current = socket
    setStatus('connecting')

    socket.onopen = () => {
      setStatus('connected')
    }
    socket.onclose = () => {
      setStatus('closed')
    }
    socket.onerror = () => {
      setStatus('error')
    }

    return () => {
      socketRef.current = null
      socket.close()
    }
  }, [])

  return { status, sendCommand }
}
