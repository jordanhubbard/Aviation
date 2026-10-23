import { useEffect, useRef } from 'react'

import { buildChordToken, eventToChord, normalizeKey } from './keyboardUtils'

export type KeyboardChord = {
  key: string
  shift?: boolean
  alt?: boolean
  ctrl?: boolean
  meta?: boolean
}

export type KeyboardBinding = {
  id: string
  description: string
  chord?: KeyboardChord
  sequence?: KeyboardChord[]
  handler: (event: KeyboardEvent) => void
  allowRepeat?: boolean
  preventDefault?: boolean
  priority?: number
}

export type KeyboardShortcutLegendItem = {
  id: string
  label: string
  description: string
}

type KeyboardBindingOptions = {
  enabled?: boolean
  sequenceTimeoutMs?: number
}

const matchesChord = (event: KeyboardEvent, chord: KeyboardChord) => {
  const normalizedKey = normalizeKey(event.key)
  if (normalizedKey !== normalizeKey(chord.key)) return false
  if ((chord.shift ?? false) !== event.shiftKey) return false
  if ((chord.alt ?? false) !== event.altKey) return false
  if ((chord.ctrl ?? false) !== event.ctrlKey) return false
  if ((chord.meta ?? false) !== event.metaKey) return false
  return true
}

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT'
}

export const useKeyboardBindings = (bindings: KeyboardBinding[], options: KeyboardBindingOptions = {}) => {
  const bindingsRef = useRef(bindings)
  const sequenceRef = useRef<string[]>([])
  const sequenceTimeoutRef = useRef<number | null>(null)
  const { enabled = true, sequenceTimeoutMs = 650 } = options

  useEffect(() => {
    bindingsRef.current = bindings
  }, [bindings])

  useEffect(() => {
    if (!enabled) return

    const resetSequence = () => {
      sequenceRef.current = []
      if (sequenceTimeoutRef.current) {
        window.clearTimeout(sequenceTimeoutRef.current)
        sequenceTimeoutRef.current = null
      }
    }

    const scheduleSequenceReset = () => {
      if (sequenceTimeoutRef.current) {
        window.clearTimeout(sequenceTimeoutRef.current)
      }
      sequenceTimeoutRef.current = window.setTimeout(() => {
        sequenceRef.current = []
        sequenceTimeoutRef.current = null
      }, sequenceTimeoutMs)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return

      const nextChord = eventToChord(event)
      const nextToken = buildChordToken(nextChord)
      const activeBindings = bindingsRef.current

      const sequenceBindings = activeBindings
        .filter((binding) => binding.sequence && binding.sequence.length > 0)
        .map((binding) => ({
          binding,
          tokens: binding.sequence!.map(buildChordToken),
        }))

      const nextSequence = [...sequenceRef.current, nextToken]
      const matchingSequences = sequenceBindings.filter((entry) =>
        entry.tokens.slice(0, nextSequence.length).every((token, index) => token === nextSequence[index]),
      )

      if (matchingSequences.length > 0) {
        sequenceRef.current = nextSequence
        scheduleSequenceReset()

        const completed = matchingSequences
          .filter((entry) => entry.tokens.length === nextSequence.length)
          .sort((a, b) => (b.binding.priority ?? 0) - (a.binding.priority ?? 0))

        if (completed.length > 0) {
          const selected = completed[0].binding
          if (selected.preventDefault !== false) event.preventDefault()
          resetSequence()
          selected.handler(event)
          return
        }

        if (matchingSequences.some((entry) => entry.binding.preventDefault !== false)) {
          event.preventDefault()
        }
        return
      }

      resetSequence()

      const matches = activeBindings
        .filter((binding) => binding.chord && matchesChord(event, binding.chord))
        .filter((binding) => binding.allowRepeat || !event.repeat)
        .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))

      if (matches.length === 0) return

      const selected = matches[0]
      if (selected.preventDefault !== false) event.preventDefault()
      selected.handler(event)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      resetSequence()
    }
  }, [enabled, sequenceTimeoutMs])
}
