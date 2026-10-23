import type { KeyboardChord } from './useKeyboardBindings'

const KEY_LABELS: Record<string, string> = {
  arrowup: 'Arrow Up',
  arrowdown: 'Arrow Down',
  arrowleft: 'Arrow Left',
  arrowright: 'Arrow Right',
  escape: 'Esc',
  enter: 'Enter',
  space: 'Space',
  tab: 'Tab',
  backspace: 'Backspace',
  delete: 'Delete',
}

export type KeymapBindingLike =
  | { kind: 'chord'; chord: KeyboardChord }
  | { kind: 'sequence'; sequence: KeyboardChord[] }

export const normalizeKey = (key: string) => {
  if (key === ' ') return 'space'
  return key.toLowerCase()
}

export const buildChordToken = (chord: KeyboardChord) => {
  const parts = [
    chord.ctrl ? 'ctrl' : null,
    chord.alt ? 'alt' : null,
    chord.shift ? 'shift' : null,
    chord.meta ? 'meta' : null,
    normalizeKey(chord.key),
  ].filter(Boolean)
  return parts.join('+')
}

export const eventToChord = (event: KeyboardEvent): KeyboardChord => ({
  key: normalizeKey(event.key),
  shift: event.shiftKey,
  alt: event.altKey,
  ctrl: event.ctrlKey,
  meta: event.metaKey,
})

export const isModifierKey = (key: string) => {
  const normalized = normalizeKey(key)
  return normalized === 'shift' || normalized === 'control' || normalized === 'alt' || normalized === 'meta'
}

const formatKey = (key: string) => {
  const normalized = normalizeKey(key)
  const label = KEY_LABELS[normalized]
  if (label) return label
  if (normalized.length === 1) return normalized.toUpperCase()
  return normalized.replace(/(^.|-.)/g, (match) => match.replace('-', ' ').toUpperCase())
}

export const formatChord = (chord: KeyboardChord) => {
  const parts = [
    chord.ctrl ? 'Ctrl' : null,
    chord.alt ? 'Alt' : null,
    chord.shift ? 'Shift' : null,
    chord.meta ? 'Cmd' : null,
    formatKey(chord.key),
  ].filter(Boolean)
  return parts.join('+')
}

export const formatSequence = (sequence: KeyboardChord[]) =>
  sequence.map((chord) => formatChord(chord)).join(' then ')

export const formatKeymapBinding = (binding: KeymapBindingLike) => {
  if (binding.kind === 'sequence') return formatSequence(binding.sequence)
  return formatChord(binding.chord)
}
