import { useEffect, useMemo, useState } from 'react'

import {
  buildChordToken,
  eventToChord,
  formatKeymapBinding,
  formatSequence,
  isModifierKey,
} from '../hooks/keyboardUtils'
import { KeyboardChord } from '../hooks/useKeyboardBindings'
import { KeymapEntry, KeymapGroup, useKeymapStore } from '../stores/keymapStore'

const GROUP_LABELS: Record<KeymapGroup, string> = {
  autopilot: 'Autopilot',
  cursor: 'Cursor',
}

const GROUP_ORDER: KeymapGroup[] = ['autopilot', 'cursor']

export const KeymapPanel = () => {
  const keymapEntries = useKeymapStore((state) => state.entries)
  const editingId = useKeymapStore((state) => state.editingId)
  const setEditingId = useKeymapStore((state) => state.setEditingId)
  const setBinding = useKeymapStore((state) => state.setBinding)
  const resetKeymap = useKeymapStore((state) => state.resetKeymap)

  const [sequenceBuffer, setSequenceBuffer] = useState<KeyboardChord[]>([])

  const groupedEntries = useMemo(() => {
    return keymapEntries.reduce<Record<KeymapGroup, KeymapEntry[]>>((accumulator, entry) => {
      accumulator[entry.group] = accumulator[entry.group] ? [...accumulator[entry.group], entry] : [entry]
      return accumulator
    }, { autopilot: [], cursor: [] })
  }, [keymapEntries])

  const conflictIds = useMemo(() => {
    const tokens = new Map<string, string[]>()
    keymapEntries.forEach((entry) => {
      const token =
        entry.binding.kind === 'sequence'
          ? entry.binding.sequence.map(buildChordToken).join('>')
          : buildChordToken(entry.binding.chord)
      const existing = tokens.get(token) ?? []
      tokens.set(token, [...existing, entry.id])
    })
    const conflicts = new Set<string>()
    tokens.forEach((ids) => {
      if (ids.length > 1) {
        ids.forEach((id) => conflicts.add(id))
      }
    })
    return conflicts
  }, [keymapEntries])

  const activeEntry = useMemo(() => keymapEntries.find((entry) => entry.id === editingId) ?? null, [
    editingId,
    keymapEntries,
  ])

  const expectedSteps = activeEntry?.binding.kind === 'sequence' ? activeEntry.binding.sequence.length : 1

  useEffect(() => {
    if (!editingId) {
      setSequenceBuffer([])
      return
    }
    setSequenceBuffer([])
  }, [editingId])

  useEffect(() => {
    if (!editingId || !activeEntry) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || isModifierKey(event.key)) return
      event.preventDefault()
      const chord = eventToChord(event)
      setSequenceBuffer((previous) => {
        const next = [...previous, chord]
        if (next.length >= expectedSteps) {
          if (expectedSteps === 1) {
            setBinding(editingId, { kind: 'chord', chord: next[0] })
          } else {
            setBinding(editingId, { kind: 'sequence', sequence: next.slice(0, expectedSteps) })
          }
          return []
        }
        return next
      })
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeEntry, editingId, expectedSteps, setBinding])

  useEffect(() => {
    if (!editingId || sequenceBuffer.length === 0 || expectedSteps === 1) return
    const timeout = window.setTimeout(() => setSequenceBuffer([]), 1200)
    return () => window.clearTimeout(timeout)
  }, [editingId, expectedSteps, sequenceBuffer])

  const captureHint = activeEntry
    ? `Press ${expectedSteps === 1 ? 'a key' : `step ${sequenceBuffer.length + 1} of ${expectedSteps}`} for ${
        activeEntry.label
      }.`
    : 'Select a shortcut to remap, then press the new keys.'

  return (
    <div className="controls__keymap">
      <div className="controls__keymap-header">
        <span className="controls__keymap-title">Keymap</span>
        <button className="controls__keymap-reset" type="button" onClick={resetKeymap}>
          Reset defaults
        </button>
      </div>
      <div className="controls__keymap-hint">{captureHint}</div>
      {GROUP_ORDER.map((group) => {
        const entries = groupedEntries[group]
        if (!entries.length) return null
        return (
          <div key={group} className="controls__keymap-section">
            <div className="controls__keymap-section-title">{GROUP_LABELS[group]}</div>
            <div className="controls__keymap-rows">
              {entries.map((entry) => {
                const isEditing = entry.id === editingId
                const isConflict = conflictIds.has(entry.id)
                const preview =
                  isEditing && sequenceBuffer.length > 0
                    ? `${formatSequence(sequenceBuffer)} …`
                    : formatKeymapBinding(entry.binding)
                const value = isEditing ? (sequenceBuffer.length ? preview : 'Press keys…') : preview
                return (
                  <div
                    key={entry.id}
                    className={`controls__keymap-row${isConflict ? ' controls__keymap-row--conflict' : ''}`}
                  >
                    <div className="controls__keymap-info">
                      <span className="controls__keymap-label">{entry.label}</span>
                      <span className="controls__keymap-description">{entry.description}</span>
                    </div>
                    <div className="controls__keymap-actions">
                      <span className="controls__keymap-keys">{value}</span>
                      <button
                        className={`controls__keymap-button${isEditing ? ' controls__keymap-button--active' : ''}`}
                        type="button"
                        onClick={() => setEditingId(isEditing ? null : entry.id)}
                      >
                        {isEditing ? 'Cancel' : 'Change'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
