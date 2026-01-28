import { useMemo } from 'react'

import { KeyboardBinding, useKeyboardBindings } from '../hooks/useKeyboardBindings'
import { useKeymapStore } from '../stores/keymapStore'

type KeyboardShortcutsProps = {
  onHeadingStep: (delta: number) => void
  onAltitudeStep: (delta: number) => void
  onAirspeedStep: (delta: number) => void
  onReset: () => void
  onSync: () => void
}

export const KeyboardShortcuts = ({
  onHeadingStep,
  onAltitudeStep,
  onAirspeedStep,
  onReset,
  onSync,
}: KeyboardShortcutsProps) => {
  const keymapEntries = useKeymapStore((state) => state.entries)
  const isEditing = useKeymapStore((state) => state.editingId !== null)

  const bindings = useMemo<KeyboardBinding[]>(() => {
    const keymap = new Map(keymapEntries.map((entry) => [entry.id, entry.binding]))
    const resolveChord = (id: string, fallback: KeyboardBinding['chord']) => {
      const binding = keymap.get(id)
      if (binding?.kind === 'chord') return binding.chord
      return fallback
    }

    return [
      {
        id: 'heading-decrease',
        description: 'Heading decrease fine',
        chord: resolveChord('heading-decrease', { key: 'h' }),
        allowRepeat: true,
        handler: () => onHeadingStep(-1),
      },
      {
        id: 'heading-decrease-coarse',
        description: 'Heading decrease coarse',
        chord: resolveChord('heading-decrease-coarse', { key: 'h', shift: true }),
        allowRepeat: true,
        priority: 2,
        handler: () => onHeadingStep(-10),
      },
      {
        id: 'heading-increase',
        description: 'Heading increase fine',
        chord: resolveChord('heading-increase', { key: 'l' }),
        allowRepeat: true,
        handler: () => onHeadingStep(1),
      },
      {
        id: 'heading-increase-coarse',
        description: 'Heading increase coarse',
        chord: resolveChord('heading-increase-coarse', { key: 'l', shift: true }),
        allowRepeat: true,
        priority: 2,
        handler: () => onHeadingStep(10),
      },
      {
        id: 'altitude-increase',
        description: 'Altitude increase fine',
        chord: resolveChord('altitude-increase', { key: 'a' }),
        allowRepeat: true,
        handler: () => onAltitudeStep(100),
      },
      {
        id: 'altitude-increase-coarse',
        description: 'Altitude increase coarse',
        chord: resolveChord('altitude-increase-coarse', { key: 'a', shift: true }),
        allowRepeat: true,
        priority: 2,
        handler: () => onAltitudeStep(500),
      },
      {
        id: 'altitude-decrease',
        description: 'Altitude decrease fine',
        chord: resolveChord('altitude-decrease', { key: 'z' }),
        allowRepeat: true,
        handler: () => onAltitudeStep(-100),
      },
      {
        id: 'altitude-decrease-coarse',
        description: 'Altitude decrease coarse',
        chord: resolveChord('altitude-decrease-coarse', { key: 'z', shift: true }),
        allowRepeat: true,
        priority: 2,
        handler: () => onAltitudeStep(-500),
      },
      {
        id: 'airspeed-increase',
        description: 'Airspeed increase fine',
        chord: resolveChord('airspeed-increase', { key: 's' }),
        allowRepeat: true,
        handler: () => onAirspeedStep(1),
      },
      {
        id: 'airspeed-increase-coarse',
        description: 'Airspeed increase coarse',
        chord: resolveChord('airspeed-increase-coarse', { key: 's', shift: true }),
        allowRepeat: true,
        priority: 2,
        handler: () => onAirspeedStep(5),
      },
      {
        id: 'airspeed-decrease',
        description: 'Airspeed decrease fine',
        chord: resolveChord('airspeed-decrease', { key: 'x' }),
        allowRepeat: true,
        handler: () => onAirspeedStep(-1),
      },
      {
        id: 'airspeed-decrease-coarse',
        description: 'Airspeed decrease coarse',
        chord: resolveChord('airspeed-decrease-coarse', { key: 'x', shift: true }),
        allowRepeat: true,
        priority: 2,
        handler: () => onAirspeedStep(-5),
      },
      {
        id: 'reset',
        description: 'Reset targets',
        chord: resolveChord('reset', { key: 'r' }),
        handler: () => onReset(),
      },
      {
        id: 'sync',
        description: 'Sync targets',
        chord: resolveChord('sync', { key: 't' }),
        handler: () => onSync(),
      },
    ]
  }, [keymapEntries, onAirspeedStep, onAltitudeStep, onHeadingStep, onReset, onSync])

  useKeyboardBindings(bindings, { enabled: !isEditing })

  return null
}
