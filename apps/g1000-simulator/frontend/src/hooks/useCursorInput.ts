import { useEffect, useRef } from 'react'

import { useCursorStore } from '../stores/cursorStore'

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT'
}

const applyDeadzone = (value: number, deadzone: number) => {
  const magnitude = Math.abs(value)
  if (magnitude <= deadzone) return 0
  const normalized = (magnitude - deadzone) / (1 - deadzone)
  return Math.sign(value) * normalized
}

export const useCursorInput = () => {
  const {
    mode,
    calibration,
    config,
    setCursorMode,
    moveCursor,
    selectTarget,
    cancelCursor,
  } = useCursorStore((state) => ({
    mode: state.mode,
    calibration: state.calibration,
    config: state.config,
    setCursorMode: state.setCursorMode,
    moveCursor: state.moveCursor,
    selectTarget: state.selectTarget,
    cancelCursor: state.cancelCursor,
  }))

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return

      const stepBase = config.speed * calibration.sensitivity
      const step = event.shiftKey ? stepBase * config.acceleration : stepBase

      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault()
          if (mode === 'inactive') setCursorMode('active')
          moveCursor(0, -step)
          return
        case 'ArrowDown':
          event.preventDefault()
          if (mode === 'inactive') setCursorMode('active')
          moveCursor(0, step)
          return
        case 'ArrowLeft':
          event.preventDefault()
          if (mode === 'inactive') setCursorMode('active')
          moveCursor(-step, 0)
          return
        case 'ArrowRight':
          event.preventDefault()
          if (mode === 'inactive') setCursorMode('active')
          moveCursor(step, 0)
          return
        case 'Enter':
        case ' ': {
          event.preventDefault()
          if (mode === 'inactive') {
            setCursorMode('active')
            return
          }
          selectTarget()
          return
        }
        case 'Escape':
          event.preventDefault()
          cancelCursor()
          return
        default:
          return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [calibration.sensitivity, cancelCursor, config.acceleration, config.speed, mode, moveCursor, selectTarget, setCursorMode])

  const rafRef = useRef<number | null>(null)
  const prevButtonsRef = useRef<boolean[]>([])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      return
    }
    let active = true

    const pollGamepad = () => {
      if (!active) return
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : []
      const gamepad = gamepads?.[0]
      if (gamepad) {
        const buttons = gamepad.buttons
        const dpadX = (buttons[15]?.pressed ? 1 : 0) - (buttons[14]?.pressed ? 1 : 0)
        const dpadY = (buttons[13]?.pressed ? 1 : 0) - (buttons[12]?.pressed ? 1 : 0)
        const axisX = gamepad.axes?.[0] ?? 0
        const axisY = gamepad.axes?.[1] ?? 0

        const effectiveX = dpadX !== 0 ? dpadX : applyDeadzone(axisX, calibration.deadzone)
        const effectiveY = dpadY !== 0 ? dpadY : applyDeadzone(axisY, calibration.deadzone)

        if (effectiveX !== 0 || effectiveY !== 0) {
          if (mode === 'inactive') setCursorMode('active')
          const stepScale = config.speed * calibration.sensitivity
          const accelX = 1 + config.acceleration * Math.abs(effectiveX)
          const accelY = 1 + config.acceleration * Math.abs(effectiveY)
          moveCursor(effectiveX * stepScale * accelX, effectiveY * stepScale * accelY)
        }

        const nextButtons = buttons.map((button) => button.pressed)
        const prevButtons = prevButtonsRef.current
        const centerPressed = nextButtons[0] && !prevButtons[0]
        const cancelPressed = nextButtons[1] && !prevButtons[1]

        if (centerPressed) {
          if (mode === 'inactive') {
            setCursorMode('active')
          } else {
            selectTarget()
          }
        }

        if (cancelPressed) {
          cancelCursor()
        }

        prevButtonsRef.current = nextButtons
      }

      rafRef.current = window.requestAnimationFrame(pollGamepad)
    }

    rafRef.current = window.requestAnimationFrame(pollGamepad)
    return () => {
      active = false
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current)
      }
    }
  }, [calibration.deadzone, calibration.sensitivity, cancelCursor, config.acceleration, config.speed, mode, moveCursor, selectTarget, setCursorMode])
}
