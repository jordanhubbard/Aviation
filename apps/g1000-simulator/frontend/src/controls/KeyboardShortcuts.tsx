import { useEffect } from 'react'

type KeyboardShortcutsProps = {
  onHeadingStep: (delta: number) => void
  onAltitudeStep: (delta: number) => void
  onAirspeedStep: (delta: number) => void
  onReset: () => void
  onSync: () => void
}

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT'
}

export const KeyboardShortcuts = ({
  onHeadingStep,
  onAltitudeStep,
  onAirspeedStep,
  onReset,
  onSync,
}: KeyboardShortcutsProps) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return

      const key = event.key.toLowerCase()
      if (key === 'h') {
        event.preventDefault()
        onHeadingStep(event.shiftKey ? -10 : -1)
        return
      }
      if (key === 'l') {
        event.preventDefault()
        onHeadingStep(event.shiftKey ? 10 : 1)
        return
      }
      if (key === 'a') {
        event.preventDefault()
        onAltitudeStep(event.shiftKey ? 500 : 100)
        return
      }
      if (key === 'z') {
        event.preventDefault()
        onAltitudeStep(event.shiftKey ? -500 : -100)
        return
      }
      if (key === 's') {
        event.preventDefault()
        onAirspeedStep(event.shiftKey ? 5 : 1)
        return
      }
      if (key === 'x') {
        event.preventDefault()
        onAirspeedStep(event.shiftKey ? -5 : -1)
        return
      }
      if (key === 'r') {
        event.preventDefault()
        onReset()
        return
      }
      if (key === 't') {
        event.preventDefault()
        onSync()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onHeadingStep, onAltitudeStep, onAirspeedStep, onReset, onSync])

  return null
}
