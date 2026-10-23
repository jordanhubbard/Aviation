import { useCallback, useEffect, useRef, useState } from 'react'

export type SocketStatus = 'unsupported' | 'connecting' | 'connected' | 'closed' | 'error'

type WebSocketClientOptions = {
  url: string | null
  protocols?: string | string[]
  shouldReconnect?: boolean
  reconnectDelayMs?: number
  maxReconnectDelayMs?: number
  onMessage?: (message: string) => void
  onOpen?: () => void
  onClose?: () => void
  onError?: () => void
}

type WebSocketClientState = {
  status: SocketStatus
  send: (payload: unknown) => void
}

export const useWebSocketClient = ({
  url,
  protocols,
  shouldReconnect = true,
  reconnectDelayMs = 1000,
  maxReconnectDelayMs = 15000,
  onMessage,
  onOpen,
  onClose,
  onError,
}: WebSocketClientOptions): WebSocketClientState => {
  const [status, setStatus] = useState<SocketStatus>('connecting')
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const reconnectAttemptRef = useRef(0)
  const handlersRef = useRef({ onMessage, onOpen, onClose, onError })

  useEffect(() => {
    handlersRef.current = { onMessage, onOpen, onClose, onError }
  }, [onMessage, onOpen, onClose, onError])

  useEffect(() => {
    if (typeof window === 'undefined' || !('WebSocket' in window)) {
      setStatus('unsupported')
      return
    }

    if (!url) {
      setStatus('error')
      return
    }

    let isActive = true

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
    }

    const scheduleReconnect = (connect: () => void) => {
      if (!shouldReconnect) {
        return
      }
      const attempt = reconnectAttemptRef.current
      const delay = Math.min(maxReconnectDelayMs, reconnectDelayMs * 2 ** attempt)
      reconnectAttemptRef.current += 1
      clearReconnectTimer()
      reconnectTimerRef.current = window.setTimeout(() => {
        connect()
      }, delay)
    }

    const connect = () => {
      if (!isActive) {
        return
      }
      setStatus('connecting')
      const socket = new WebSocket(url, protocols)
      socketRef.current = socket

      socket.onopen = () => {
        if (!isActive) {
          return
        }
        reconnectAttemptRef.current = 0
        setStatus('connected')
        handlersRef.current.onOpen?.()
      }

      socket.onmessage = (event) => {
        if (typeof event.data === 'string') {
          handlersRef.current.onMessage?.(event.data)
        }
      }

      socket.onclose = () => {
        if (!isActive) {
          return
        }
        setStatus('closed')
        handlersRef.current.onClose?.()
        scheduleReconnect(connect)
      }

      socket.onerror = () => {
        if (!isActive) {
          return
        }
        setStatus('error')
        handlersRef.current.onError?.()
        socket.close()
      }
    }

    connect()

    return () => {
      isActive = false
      clearReconnectTimer()
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [url, protocols, shouldReconnect, reconnectDelayMs, maxReconnectDelayMs])

  const send = useCallback((payload: unknown) => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      return
    }
    const message = typeof payload === 'string' ? payload : JSON.stringify(payload)
    socketRef.current.send(message)
  }, [])

  return { status, send }
}
