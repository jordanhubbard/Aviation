import { useEffect, useMemo, useRef } from 'react'

import { useCursorStore } from '../stores/cursorStore'
import { useKeymapStore } from '../stores/keymapStore'
import { KeyboardBinding, useKeyboardBindings } from './useKeyboardBindings'

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
    centerCursor,
  } = useCursorStore((state) => ({
    mode: state.mode,
    calibration: state.calibration,
    config: state.config,
    setCursorMode: state.setCursorMode,
    moveCursor: state.moveCursor,
    selectTarget: state.selectTarget,
    cancelCursor: state.cancelCursor,
    centerCursor: state.centerCursor,
  }))
  const keymapEntries = useKeymapStore((state) => state.entries)
  const isEditing = useKeymapStore((state) => state.editingId !== null)
  const bindings = useMemo<KeyboardBinding[]>(() => {
    const keymap = new Map(keymapEntries.map((entry) => [entry.id, entry.binding]))
    const resolveChord = (id: string, fallback: KeyboardBinding['chord']) => {
      const binding = keymap.get(id)
      if (binding?.kind === 'chord') return binding.chord
      return fallback
    }
    const resolveSequence = (id: string, fallback: KeyboardBinding['sequence']) => {
      const binding = keymap.get(id)
      if (binding?.kind === 'sequence') return binding.sequence
      return fallback
    }
    const stepBase = config.speed * calibration.sensitivity
    const fastStep = stepBase * config.acceleration

    const activateCursor = () => {
      if (mode === 'inactive') {
        setCursorMode('active')
      }
    }

    const moveWith = (dx: number, dy: number) => {
      activateCursor()
      moveCursor(dx, dy)
    }

    return [
      {
        id: 'cursor-up',
        description: 'Move cursor up',
        chord: resolveChord('cursor-up', { key: 'arrowup' }),
        allowRepeat: true,
        handler: () => moveWith(0, -stepBase),
      },
      {
        id: 'cursor-up-fast',
        description: 'Move cursor up fast',
        chord: resolveChord('cursor-up-fast', { key: 'arrowup', shift: true }),
        allowRepeat: true,
        priority: 2,
        handler: () => moveWith(0, -fastStep),
      },
      {
        id: 'cursor-down',
        description: 'Move cursor down',
        chord: resolveChord('cursor-down', { key: 'arrowdown' }),
        allowRepeat: true,
        handler: () => moveWith(0, stepBase),
      },
      {
        id: 'cursor-down-fast',
        description: 'Move cursor down fast',
        chord: resolveChord('cursor-down-fast', { key: 'arrowdown', shift: true }),
        allowRepeat: true,
        priority: 2,
        handler: () => moveWith(0, fastStep),
      },
      {
        id: 'cursor-left',
        description: 'Move cursor left',
        chord: resolveChord('cursor-left', { key: 'arrowleft' }),
        allowRepeat: true,
        handler: () => moveWith(-stepBase, 0),
      },
      {
        id: 'cursor-left-fast',
        description: 'Move cursor left fast',
        chord: resolveChord('cursor-left-fast', { key: 'arrowleft', shift: true }),
        allowRepeat: true,
        priority: 2,
        handler: () => moveWith(-fastStep, 0),
      },
      {
        id: 'cursor-right',
        description: 'Move cursor right',
        chord: resolveChord('cursor-right', { key: 'arrowright' }),
        allowRepeat: true,
        handler: () => moveWith(stepBase, 0),
      },
      {
        id: 'cursor-right-fast',
        description: 'Move cursor right fast',
        chord: resolveChord('cursor-right-fast', { key: 'arrowright', shift: true }),
        allowRepeat: true,
        priority: 2,
        handler: () => moveWith(fastStep, 0),
      },
      {
        id: 'cursor-select',
        description: 'Select cursor focus',
        chord: resolveChord('cursor-select', { key: 'enter' }),
        handler: () => {
          if (mode === 'inactive') {
            setCursorMode('active')
            return
          }
          selectTarget()
        },
      },
      {
        id: 'cursor-select-space',
        description: 'Select cursor focus',
        chord: resolveChord('cursor-select-space', { key: 'space' }),
        handler: () => {
          if (mode === 'inactive') {
            setCursorMode('active')
            return
          }
          selectTarget()
        },
      },
      {
        id: 'cursor-cancel',
        description: 'Cancel cursor mode',
        chord: resolveChord('cursor-cancel', { key: 'escape' }),
        handler: () => cancelCursor(),
      },
      {
        id: 'cursor-center',
        description: 'Center cursor',
        sequence: resolveSequence('cursor-center', [{ key: 'g' }, { key: 'c' }]),
        handler: () => {
          setCursorMode('active')
          centerCursor()
        },
      },
    ]
  }, [
    calibration.sensitivity,
    cancelCursor,
    centerCursor,
    config.acceleration,
    config.speed,
    keymapEntries,
    mode,
    moveCursor,
    selectTarget,
    setCursorMode,
  ])

  useKeyboardBindings(bindings, { enabled: !isEditing })

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
