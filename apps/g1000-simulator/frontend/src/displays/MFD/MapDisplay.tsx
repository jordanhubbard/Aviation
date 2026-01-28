import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

import { TelemetrySnapshot } from '../../hooks/useTelemetrySocket'
import { useCursorStore } from '../../stores/cursorStore'

type MapDisplayProps = {
  telemetry: TelemetrySnapshot | null
}

const formatCoordinate = (value: number | null) =>
  value === null ? '---' : `${value.toFixed(2)}°`

export const MapDisplay = ({ telemetry }: MapDisplayProps) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const holdTimeoutRef = useRef<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const { mode, position, focusTarget, setCursorMode, setCursorPosition, setFocusTarget } = useCursorStore(
    (state) => ({
      mode: state.mode,
      position: state.position,
      focusTarget: state.focusTarget,
      setCursorMode: state.setCursorMode,
      setCursorPosition: state.setCursorPosition,
      setFocusTarget: state.setFocusTarget,
    }),
  )
  const isActive = mode === 'active'
  const latitude = telemetry?.position.latitude_deg ?? null
  const longitude = telemetry?.position.longitude_deg ?? null
  const groundTrack = telemetry?.attitude.heading_deg ?? null
  const cursorStyle = useMemo(
    () => ({
      left: `${position.x * 100}%`,
      top: `${position.y * 100}%`,
    }),
    [position.x, position.y],
  )

  const updateCursorFromClient = useCallback(
    (clientX: number, clientY: number) => {
      if (!mapRef.current) return
      const rect = mapRef.current.getBoundingClientRect()
      const nextX = (clientX - rect.left) / rect.width
      const nextY = (clientY - rect.top) / rect.height
      setCursorPosition({ x: nextX, y: nextY })
    },
    [setCursorPosition],
  )

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!mapRef.current || event.button !== 0) return
      event.preventDefault()
      const { clientX, clientY } = event
      mapRef.current.setPointerCapture(event.pointerId)
      if (isActive) {
        setIsDragging(true)
        updateCursorFromClient(clientX, clientY)
        return
      }

      holdTimeoutRef.current = window.setTimeout(() => {
        setCursorMode('active')
        setIsDragging(true)
        updateCursorFromClient(clientX, clientY)
      }, 300)
    },
    [isActive, setCursorMode, updateCursorFromClient],
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isDragging) return
      event.preventDefault()
      updateCursorFromClient(event.clientX, event.clientY)
    },
    [isDragging, updateCursorFromClient],
  )

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (holdTimeoutRef.current) {
      window.clearTimeout(holdTimeoutRef.current)
      holdTimeoutRef.current = null
    }
    setIsDragging(false)
    mapRef.current?.releasePointerCapture(event.pointerId)
  }, [])

  useEffect(() => () => {
    if (holdTimeoutRef.current) {
      window.clearTimeout(holdTimeoutRef.current)
    }
  }, [])

  const nextFocusTarget = useMemo(() => {
    if (!isActive) return null
    const dx = position.x - 0.5
    const dy = position.y - 0.5
    const distance = Math.sqrt(dx * dx + dy * dy)
    return distance < 0.08 ? 'aircraft' : null
  }, [isActive, position.x, position.y])

  useEffect(() => {
    if (nextFocusTarget !== focusTarget) {
      setFocusTarget(nextFocusTarget)
    }
  }, [focusTarget, nextFocusTarget, setFocusTarget])

  const cursorClassName = useMemo(() => {
    const base = 'mfd__map-cursor'
    const activeClass = isActive ? ' mfd__map-cursor--active' : ''
    const focusClass = nextFocusTarget ? ' mfd__map-cursor--focus' : ''
    return `${base}${activeClass}${focusClass}`
  }, [isActive, nextFocusTarget])

  return (
    <div
      className="mfd__map"
      ref={mapRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <div className="mfd__map-grid" />
      <div className="mfd__map-centerline" />
      <div
        className={`mfd__map-marker${nextFocusTarget ? ' mfd__map-marker--focused' : ''}`}
      >
        <span className="mfd__map-marker-label">ACFT</span>
      </div>
      <div className={cursorClassName} style={cursorStyle}>
        <span className="mfd__map-cursor-dot" />
      </div>
      <div className="mfd__map-overlay">
        <div>
          <span className="mfd__map-label">LAT</span>
          <span className="mfd__map-value">{formatCoordinate(latitude)}</span>
        </div>
        <div>
          <span className="mfd__map-label">LON</span>
          <span className="mfd__map-value">{formatCoordinate(longitude)}</span>
        </div>
        <div>
          <span className="mfd__map-label">TRK</span>
          <span className="mfd__map-value">{groundTrack ? `${Math.round(groundTrack)}°` : '---'}</span>
        </div>
        <div className="mfd__map-status">
          <span className="mfd__map-label">CUR</span>
          <span className="mfd__map-value">{isActive ? 'ON' : 'OFF'}</span>
        </div>
      </div>
      <div className="mfd__map-legend">
        <span className="mfd__legend-item">APT</span>
        <span className="mfd__legend-item">VOR</span>
        <span className="mfd__legend-item">TFC</span>
        <span className="mfd__legend-item">WX</span>
      </div>
    </div>
  )
}
