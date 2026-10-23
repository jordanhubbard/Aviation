import { useMemo } from 'react'

import { KeyboardBinding, useKeyboardBindings } from '../hooks/useKeyboardBindings'
import { useKeymapStore } from '../stores/keymapStore'
import { ROTARY_KNOB_MAP } from './rotaryKnobMap'

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
  const headingKnob = ROTARY_KNOB_MAP.heading
  const altitudeKnob = ROTARY_KNOB_MAP.altitude
  const airspeedKnob = ROTARY_KNOB_MAP.airspeed

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
        handler: () => onHeadingStep(-headingKnob.fineStep),
      },
      {
        id: 'heading-decrease-coarse',
        description: 'Heading decrease coarse',
        chord: resolveChord('heading-decrease-coarse', { key: 'h', shift: true }),
        allowRepeat: true,
        priority: 2,
        handler: () => onHeadingStep(-headingKnob.coarseStep),
      },
      {
        id: 'heading-increase',
        description: 'Heading increase fine',
        chord: resolveChord('heading-increase', { key: 'l' }),
        allowRepeat: true,
        handler: () => onHeadingStep(headingKnob.fineStep),
      },
      {
        id: 'heading-increase-coarse',
        description: 'Heading increase coarse',
        chord: resolveChord('heading-increase-coarse', { key: 'l', shift: true }),
        allowRepeat: true,
        priority: 2,
        handler: () => onHeadingStep(headingKnob.coarseStep),
      },
      {
        id: 'altitude-increase',
        description: 'Altitude increase fine',
        chord: resolveChord('altitude-increase', { key: 'a' }),
        allowRepeat: true,
        handler: () => onAltitudeStep(altitudeKnob.fineStep),
      },
      {
        id: 'altitude-increase-coarse',
        description: 'Altitude increase coarse',
        chord: resolveChord('altitude-increase-coarse', { key: 'a', shift: true }),
        allowRepeat: true,
        priority: 2,
        handler: () => onAltitudeStep(altitudeKnob.coarseStep),
      },
      {
        id: 'altitude-decrease',
        description: 'Altitude decrease fine',
        chord: resolveChord('altitude-decrease', { key: 'z' }),
        allowRepeat: true,
        handler: () => onAltitudeStep(-altitudeKnob.fineStep),
      },
      {
        id: 'altitude-decrease-coarse',
        description: 'Altitude decrease coarse',
        chord: resolveChord('altitude-decrease-coarse', { key: 'z', shift: true }),
        allowRepeat: true,
        priority: 2,
        handler: () => onAltitudeStep(-altitudeKnob.coarseStep),
      },
      {
        id: 'airspeed-increase',
        description: 'Airspeed increase fine',
        chord: resolveChord('airspeed-increase', { key: 's' }),
        allowRepeat: true,
        handler: () => onAirspeedStep(airspeedKnob.fineStep),
      },
      {
        id: 'airspeed-increase-coarse',
        description: 'Airspeed increase coarse',
        chord: resolveChord('airspeed-increase-coarse', { key: 's', shift: true }),
        allowRepeat: true,
        priority: 2,
        handler: () => onAirspeedStep(airspeedKnob.coarseStep),
      },
      {
        id: 'airspeed-decrease',
        description: 'Airspeed decrease fine',
        chord: resolveChord('airspeed-decrease', { key: 'x' }),
        allowRepeat: true,
        handler: () => onAirspeedStep(-airspeedKnob.fineStep),
      },
      {
        id: 'airspeed-decrease-coarse',
        description: 'Airspeed decrease coarse',
        chord: resolveChord('airspeed-decrease-coarse', { key: 'x', shift: true }),
        allowRepeat: true,
        priority: 2,
        handler: () => onAirspeedStep(-airspeedKnob.coarseStep),
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
  }, [
    airspeedKnob,
    altitudeKnob,
    headingKnob,
    keymapEntries,
    onAirspeedStep,
    onAltitudeStep,
    onHeadingStep,
    onReset,
    onSync,
  ])

  useKeyboardBindings(bindings, { enabled: !isEditing })

  return null
}
