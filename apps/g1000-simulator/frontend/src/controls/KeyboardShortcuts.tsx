import { useMemo } from 'react'

import { KeyboardBinding, KeyboardShortcutLegendItem, useKeyboardBindings } from '../hooks/useKeyboardBindings'

type KeyboardShortcutsProps = {
  onHeadingStep: (delta: number) => void
  onAltitudeStep: (delta: number) => void
  onAirspeedStep: (delta: number) => void
  onReset: () => void
  onSync: () => void
}

export const AUTOPILOT_SHORTCUTS: KeyboardShortcutLegendItem[] = [
  { id: 'heading', label: 'H/L', description: 'heading (shift=coarse)' },
  { id: 'altitude', label: 'A/Z', description: 'altitude (shift=coarse)' },
  { id: 'airspeed', label: 'S/X', description: 'speed (shift=coarse)' },
  { id: 'reset', label: 'R', description: 'reset' },
  { id: 'sync', label: 'T', description: 'sync' },
]

export const KeyboardShortcuts = ({
  onHeadingStep,
  onAltitudeStep,
  onAirspeedStep,
  onReset,
  onSync,
}: KeyboardShortcutsProps) => {
  const bindings = useMemo<KeyboardBinding[]>(
    () => [
      {
        id: 'heading-decrease',
        description: 'Heading decrease fine',
        chord: { key: 'h' },
        allowRepeat: true,
        handler: () => onHeadingStep(-1),
      },
      {
        id: 'heading-decrease-coarse',
        description: 'Heading decrease coarse',
        chord: { key: 'h', shift: true },
        allowRepeat: true,
        priority: 2,
        handler: () => onHeadingStep(-10),
      },
      {
        id: 'heading-increase',
        description: 'Heading increase fine',
        chord: { key: 'l' },
        allowRepeat: true,
        handler: () => onHeadingStep(1),
      },
      {
        id: 'heading-increase-coarse',
        description: 'Heading increase coarse',
        chord: { key: 'l', shift: true },
        allowRepeat: true,
        priority: 2,
        handler: () => onHeadingStep(10),
      },
      {
        id: 'altitude-increase',
        description: 'Altitude increase fine',
        chord: { key: 'a' },
        allowRepeat: true,
        handler: () => onAltitudeStep(100),
      },
      {
        id: 'altitude-increase-coarse',
        description: 'Altitude increase coarse',
        chord: { key: 'a', shift: true },
        allowRepeat: true,
        priority: 2,
        handler: () => onAltitudeStep(500),
      },
      {
        id: 'altitude-decrease',
        description: 'Altitude decrease fine',
        chord: { key: 'z' },
        allowRepeat: true,
        handler: () => onAltitudeStep(-100),
      },
      {
        id: 'altitude-decrease-coarse',
        description: 'Altitude decrease coarse',
        chord: { key: 'z', shift: true },
        allowRepeat: true,
        priority: 2,
        handler: () => onAltitudeStep(-500),
      },
      {
        id: 'airspeed-increase',
        description: 'Airspeed increase fine',
        chord: { key: 's' },
        allowRepeat: true,
        handler: () => onAirspeedStep(1),
      },
      {
        id: 'airspeed-increase-coarse',
        description: 'Airspeed increase coarse',
        chord: { key: 's', shift: true },
        allowRepeat: true,
        priority: 2,
        handler: () => onAirspeedStep(5),
      },
      {
        id: 'airspeed-decrease',
        description: 'Airspeed decrease fine',
        chord: { key: 'x' },
        allowRepeat: true,
        handler: () => onAirspeedStep(-1),
      },
      {
        id: 'airspeed-decrease-coarse',
        description: 'Airspeed decrease coarse',
        chord: { key: 'x', shift: true },
        allowRepeat: true,
        priority: 2,
        handler: () => onAirspeedStep(-5),
      },
      {
        id: 'reset',
        description: 'Reset targets',
        chord: { key: 'r' },
        handler: () => onReset(),
      },
      {
        id: 'sync',
        description: 'Sync targets',
        chord: { key: 't' },
        handler: () => onSync(),
      },
    ],
    [onAirspeedStep, onAltitudeStep, onHeadingStep, onReset, onSync],
  )

  useKeyboardBindings(bindings)

  return null
}
