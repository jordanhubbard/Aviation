import { create } from 'zustand'

import {
  ROTARY_KNOB_FOCUS_TIMEOUT_MS,
  RotaryKnobDirection,
  RotaryKnobId,
  RotaryKnobRing,
} from '../controls/rotaryKnobMap'

export type RotaryKnobEvent = {
  knobId: RotaryKnobId
  ring: RotaryKnobRing
  direction: RotaryKnobDirection
  detents: number
  multiplier: number
  delta: number
}

type RotaryKnobState = {
  activeKnobId: RotaryKnobId | null
  activeRing: RotaryKnobRing | null
  lastEvent: RotaryKnobEvent | null
  lastEventAt: number | null
}

type RotaryKnobActions = {
  recordEvent: (event: RotaryKnobEvent) => void
  clearFocus: () => void
}

let focusTimeout: number | null = null

export const useRotaryKnobStore = create<RotaryKnobState & RotaryKnobActions>((set) => ({
  activeKnobId: null,
  activeRing: null,
  lastEvent: null,
  lastEventAt: null,
  recordEvent: (event) => {
    if (focusTimeout && typeof window !== 'undefined') {
      window.clearTimeout(focusTimeout)
      focusTimeout = null
    }
    const timestamp = Date.now()
    set({
      activeKnobId: event.knobId,
      activeRing: event.ring,
      lastEvent: event,
      lastEventAt: timestamp,
    })
    if (typeof window !== 'undefined') {
      focusTimeout = window.setTimeout(() => {
        set({ activeKnobId: null, activeRing: null })
      }, ROTARY_KNOB_FOCUS_TIMEOUT_MS)
    }
  },
  clearFocus: () => {
    if (focusTimeout && typeof window !== 'undefined') {
      window.clearTimeout(focusTimeout)
      focusTimeout = null
    }
    set({ activeKnobId: null, activeRing: null })
  },
}))

export const useActiveRotaryKnob = () =>
  useRotaryKnobStore((state) => ({
    activeKnobId: state.activeKnobId,
    activeRing: state.activeRing,
  }))
