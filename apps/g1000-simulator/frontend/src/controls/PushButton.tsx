import { useCallback, useEffect, useRef, useState } from 'react'

import type { PushButtonDefinition } from './pushButtonMap'

type PushButtonProps = {
  button: PushButtonDefinition
  active?: boolean
  disabled?: boolean
  guarded?: boolean
  holdDelayMs?: number
  onPress: (button: PushButtonDefinition) => void
  onLongPress?: (button: PushButtonDefinition) => void
}

export const PushButton = ({
  button,
  active = false,
  disabled = false,
  guarded = false,
  holdDelayMs = 650,
  onPress,
  onLongPress,
}: PushButtonProps) => {
  const [pressed, setPressed] = useState(false)
  const holdTimeoutRef = useRef<number | null>(null)
  const holdTriggeredRef = useRef(false)

  const clearHoldTimeout = useCallback(() => {
    if (holdTimeoutRef.current) {
      window.clearTimeout(holdTimeoutRef.current)
      holdTimeoutRef.current = null
    }
  }, [])

  const resetHold = useCallback(() => {
    clearHoldTimeout()
    holdTriggeredRef.current = false
  }, [clearHoldTimeout])

  const startHoldTimer = useCallback(() => {
    if (!onLongPress) return
    clearHoldTimeout()
    holdTimeoutRef.current = window.setTimeout(() => {
      holdTriggeredRef.current = true
      onLongPress(button)
    }, holdDelayMs)
  }, [button, clearHoldTimeout, holdDelayMs, onLongPress])

  const handlePressStart = useCallback(() => {
    if (disabled) return
    setPressed(true)
    startHoldTimer()
  }, [disabled, startHoldTimer])

  const handlePressEnd = useCallback(() => {
    if (disabled) return
    const wasHoldTriggered = holdTriggeredRef.current
    setPressed(false)
    resetHold()
    if (!wasHoldTriggered) {
      onPress(button)
    }
  }, [button, disabled, onPress, resetHold])

  const handlePressCancel = useCallback(() => {
    setPressed(false)
    resetHold()
  }, [resetHold])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return
      if (event.key !== ' ' && event.key !== 'Enter') return
      if (event.repeat) return
      event.preventDefault()
      handlePressStart()
    },
    [disabled, handlePressStart]
  )

  const handleKeyUp = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return
      if (event.key !== ' ' && event.key !== 'Enter') return
      event.preventDefault()
      handlePressEnd()
    },
    [disabled, handlePressEnd]
  )

  useEffect(() => {
    return () => clearHoldTimeout()
  }, [clearHoldTimeout])

  return (
    <button
      className={`controls__button${active ? ' controls__button--active' : ''}${
        pressed ? ' controls__button--pressed' : ''
      }${guarded ? ' controls__button--guarded' : ''}`}
      type="button"
      onPointerDown={handlePressStart}
      onPointerUp={handlePressEnd}
      onPointerLeave={handlePressCancel}
      onPointerCancel={handlePressCancel}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      disabled={disabled}
      aria-pressed={pressed || active}
    >
      {button.label}
    </button>
  )
}
