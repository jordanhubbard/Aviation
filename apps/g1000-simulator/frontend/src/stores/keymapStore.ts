import { create } from 'zustand'

import type { KeyboardChord } from '../hooks/useKeyboardBindings'

export type KeymapBinding =
  | { kind: 'chord'; chord: KeyboardChord }
  | { kind: 'sequence'; sequence: KeyboardChord[] }

export type KeymapGroup = 'autopilot' | 'cursor'

export type KeymapEntry = {
  id: string
  label: string
  description: string
  group: KeymapGroup
  binding: KeymapBinding
  legend?: boolean
}

type KeymapState = {
  entries: KeymapEntry[]
  editingId: string | null
}

type KeymapActions = {
  setBinding: (id: string, binding: KeymapBinding) => void
  resetKeymap: () => void
  setEditingId: (id: string | null) => void
}

const KEYMAP_STORAGE_ID = ['g1000', 'keymap'].join('-')

const DEFAULT_KEYMAP_ENTRIES: KeymapEntry[] = [
  {
    id: 'heading-decrease',
    label: 'Heading -',
    description: 'Fine step',
    group: 'autopilot',
    binding: { kind: 'chord', chord: { key: 'h' } },
    legend: true,
  },
  {
    id: 'heading-decrease-coarse',
    label: 'Heading -',
    description: 'Coarse step',
    group: 'autopilot',
    binding: { kind: 'chord', chord: { key: 'h', shift: true } },
  },
  {
    id: 'heading-increase',
    label: 'Heading +',
    description: 'Fine step',
    group: 'autopilot',
    binding: { kind: 'chord', chord: { key: 'l' } },
    legend: true,
  },
  {
    id: 'heading-increase-coarse',
    label: 'Heading +',
    description: 'Coarse step',
    group: 'autopilot',
    binding: { kind: 'chord', chord: { key: 'l', shift: true } },
  },
  {
    id: 'altitude-increase',
    label: 'Altitude +',
    description: 'Fine step',
    group: 'autopilot',
    binding: { kind: 'chord', chord: { key: 'a' } },
    legend: true,
  },
  {
    id: 'altitude-increase-coarse',
    label: 'Altitude +',
    description: 'Coarse step',
    group: 'autopilot',
    binding: { kind: 'chord', chord: { key: 'a', shift: true } },
  },
  {
    id: 'altitude-decrease',
    label: 'Altitude -',
    description: 'Fine step',
    group: 'autopilot',
    binding: { kind: 'chord', chord: { key: 'z' } },
    legend: true,
  },
  {
    id: 'altitude-decrease-coarse',
    label: 'Altitude -',
    description: 'Coarse step',
    group: 'autopilot',
    binding: { kind: 'chord', chord: { key: 'z', shift: true } },
  },
  {
    id: 'airspeed-increase',
    label: 'Airspeed +',
    description: 'Fine step',
    group: 'autopilot',
    binding: { kind: 'chord', chord: { key: 's' } },
    legend: true,
  },
  {
    id: 'airspeed-increase-coarse',
    label: 'Airspeed +',
    description: 'Coarse step',
    group: 'autopilot',
    binding: { kind: 'chord', chord: { key: 's', shift: true } },
  },
  {
    id: 'airspeed-decrease',
    label: 'Airspeed -',
    description: 'Fine step',
    group: 'autopilot',
    binding: { kind: 'chord', chord: { key: 'x' } },
    legend: true,
  },
  {
    id: 'airspeed-decrease-coarse',
    label: 'Airspeed -',
    description: 'Coarse step',
    group: 'autopilot',
    binding: { kind: 'chord', chord: { key: 'x', shift: true } },
  },
  {
    id: 'reset',
    label: 'Reset',
    description: 'Targets',
    group: 'autopilot',
    binding: { kind: 'chord', chord: { key: 'r' } },
    legend: true,
  },
  {
    id: 'sync',
    label: 'Sync',
    description: 'Targets',
    group: 'autopilot',
    binding: { kind: 'chord', chord: { key: 't' } },
    legend: true,
  },
  {
    id: 'cursor-up',
    label: 'Cursor up',
    description: 'Fine move',
    group: 'cursor',
    binding: { kind: 'chord', chord: { key: 'arrowup' } },
    legend: true,
  },
  {
    id: 'cursor-up-fast',
    label: 'Cursor up',
    description: 'Fast move',
    group: 'cursor',
    binding: { kind: 'chord', chord: { key: 'arrowup', shift: true } },
  },
  {
    id: 'cursor-down',
    label: 'Cursor down',
    description: 'Fine move',
    group: 'cursor',
    binding: { kind: 'chord', chord: { key: 'arrowdown' } },
    legend: true,
  },
  {
    id: 'cursor-down-fast',
    label: 'Cursor down',
    description: 'Fast move',
    group: 'cursor',
    binding: { kind: 'chord', chord: { key: 'arrowdown', shift: true } },
  },
  {
    id: 'cursor-left',
    label: 'Cursor left',
    description: 'Fine move',
    group: 'cursor',
    binding: { kind: 'chord', chord: { key: 'arrowleft' } },
    legend: true,
  },
  {
    id: 'cursor-left-fast',
    label: 'Cursor left',
    description: 'Fast move',
    group: 'cursor',
    binding: { kind: 'chord', chord: { key: 'arrowleft', shift: true } },
  },
  {
    id: 'cursor-right',
    label: 'Cursor right',
    description: 'Fine move',
    group: 'cursor',
    binding: { kind: 'chord', chord: { key: 'arrowright' } },
    legend: true,
  },
  {
    id: 'cursor-right-fast',
    label: 'Cursor right',
    description: 'Fast move',
    group: 'cursor',
    binding: { kind: 'chord', chord: { key: 'arrowright', shift: true } },
  },
  {
    id: 'cursor-select',
    label: 'Cursor select',
    description: 'Enter',
    group: 'cursor',
    binding: { kind: 'chord', chord: { key: 'enter' } },
    legend: true,
  },
  {
    id: 'cursor-select-space',
    label: 'Cursor select',
    description: 'Space',
    group: 'cursor',
    binding: { kind: 'chord', chord: { key: 'space' } },
  },
  {
    id: 'cursor-cancel',
    label: 'Cursor cancel',
    description: 'Escape',
    group: 'cursor',
    binding: { kind: 'chord', chord: { key: 'escape' } },
    legend: true,
  },
  {
    id: 'cursor-center',
    label: 'Cursor center',
    description: 'Sequence',
    group: 'cursor',
    binding: { kind: 'sequence', sequence: [{ key: 'g' }, { key: 'c' }] },
    legend: true,
  },
]

const isKeyboardChord = (value: unknown): value is KeyboardChord => {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.key === 'string'
}

const normalizeChord = (value: KeyboardChord): KeyboardChord => ({
  key: value.key,
  shift: value.shift ?? false,
  alt: value.alt ?? false,
  ctrl: value.ctrl ?? false,
  meta: value.meta ?? false,
})

const isKeymapBinding = (value: unknown): value is KeymapBinding => {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  if (record.kind === 'chord' && isKeyboardChord(record.chord)) return true
  if (record.kind === 'sequence' && Array.isArray(record.sequence)) {
    return record.sequence.every(isKeyboardChord)
  }
  return false
}

const loadBindings = () => {
  if (typeof window === 'undefined') return {}
  try {
    const stored = window.localStorage.getItem(KEYMAP_STORAGE_ID)
    if (!stored) return {}
    const parsed = JSON.parse(stored)
    const bindings = parsed?.bindings ?? {}
    if (typeof bindings !== 'object' || bindings === null) return {}
    return Object.fromEntries(
      Object.entries(bindings).flatMap(([id, binding]) => {
        if (!isKeymapBinding(binding)) return []
        if (binding.kind === 'chord') return [[id, { kind: 'chord', chord: normalizeChord(binding.chord) }]]
        return [[id, { kind: 'sequence', sequence: binding.sequence.map(normalizeChord) }]]
      }),
    )
  } catch {
    return {}
  }
}

const mergeBindings = (entries: KeymapEntry[], bindings: Record<string, KeymapBinding>) =>
  entries.map((entry) => ({
    ...entry,
    binding: bindings[entry.id] ?? entry.binding,
  }))

const persistBindings = (entries: KeymapEntry[]) => {
  if (typeof window === 'undefined') return
  const bindings = Object.fromEntries(entries.map((entry) => [entry.id, entry.binding]))
  try {
    window.localStorage.setItem(KEYMAP_STORAGE_ID, JSON.stringify({ bindings }))
  } catch {
    return
  }
}

const initialEntries = mergeBindings(DEFAULT_KEYMAP_ENTRIES, loadBindings())

export const useKeymapStore = create<KeymapState & KeymapActions>((set) => ({
  entries: initialEntries,
  editingId: null,
  setBinding: (id, binding) =>
    set((state) => {
      const entries = state.entries.map((entry) =>
        entry.id === id ? { ...entry, binding } : entry,
      )
      persistBindings(entries)
      return { entries, editingId: null }
    }),
  resetKeymap: () => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(KEYMAP_STORAGE_ID)
      } catch (error) {
        void error
      }
    }
    set({ entries: DEFAULT_KEYMAP_ENTRIES, editingId: null })
  },
  setEditingId: (id) => set({ editingId: id }),
}))
