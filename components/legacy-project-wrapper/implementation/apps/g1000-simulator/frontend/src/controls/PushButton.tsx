import { useCallback, useEffect, useRef, useState } from 'react'

import type { PushButtonAnnunciator, PushButtonDefinition } from './pushButtonMap'

type PushButtonProps = {
  button: PushButtonDefinition
  active?: boolean
  backlit?: boolean
  disabled?: boolean
  guarded?: boolean
  annunciator?: PushButtonAnnunciator
  holdDelayMs?: number
  onPress: (button: PushButtonDefinition) => void
  onLongPress?: (button: PushButtonDefinition) => void
}

export const PushButton = ({
  button,
  active = false,
  backlit = false,
  disabled = false,
  guarded = false,
  annunciator,
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

  const className = [
    'controls__button',
    backlit && 'controls__button--backlit',
    active && 'controls__button--active',
    pressed && 'controls__button--pressed',
    guarded && 'controls__button--guarded',
    annunciator && 'controls__button--annunciator',
    annunciator && `controls__button--annunciator-${annunciator}`,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      className={className}
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
