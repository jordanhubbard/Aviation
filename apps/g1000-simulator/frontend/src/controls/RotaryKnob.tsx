import { useCallback, useRef } from 'react'
import type { PointerEvent, WheelEvent } from 'react'

import { useActiveRotaryKnob, useRotaryKnobStore } from '../stores/rotaryKnobStore'

import type {
  RotaryKnobDefinition,
  RotaryKnobDirection,
  RotaryKnobRing,
} from './rotaryKnobMap'

type RotaryKnobProps = {
  knob: RotaryKnobDefinition
  onStep: (delta: number) => void
}

type AccelerationState = {
  lastEventAt: number | null
  multiplier: number
}

type DragState = {
  pointerId: number | null
  ring: RotaryKnobRing | null
  lastY: number
  accumulator: number
  lastDragAt: number | null
}

const initialAcceleration = (): Record<RotaryKnobRing, AccelerationState> => ({
  outer: { lastEventAt: null, multiplier: 1 },
  inner: { lastEventAt: null, multiplier: 1 },
})

export const RotaryKnob = ({ knob, onStep }: RotaryKnobProps) => {
  const recordEvent = useRotaryKnobStore((state) => state.recordEvent)
  const { activeKnobId, activeRing } = useActiveRotaryKnob()
  const accelerationRef = useRef(initialAcceleration())
  const dragStateRef = useRef<DragState>({
    pointerId: null,
    ring: null,
    lastY: 0,
    accumulator: 0,
    lastDragAt: null,
  })

  const getMultiplier = useCallback(
    (ring: RotaryKnobRing) => {
      const state = accelerationRef.current[ring]
      const now = Date.now()
      if (state.lastEventAt === null) {
        state.lastEventAt = now
        state.multiplier = 1
        return state.multiplier
      }
      const interval = now - state.lastEventAt
      if (interval <= knob.acceleration.minIntervalMs) {
        state.multiplier = Math.min(
          knob.acceleration.maxMultiplier,
          state.multiplier + knob.acceleration.multiplierStep,
        )
      } else if (interval >= knob.acceleration.maxIntervalMs) {
        state.multiplier = 1
      }
      state.lastEventAt = now
      return state.multiplier
    },
    [knob.acceleration],
  )

  const rotate = useCallback(
    (ring: RotaryKnobRing, direction: RotaryKnobDirection, detents: number) => {
      if (detents === 0) return
      const baseStep = ring === 'outer' ? knob.coarseStep : knob.fineStep
      const multiplier = getMultiplier(ring)
      const sign = direction === 'clockwise' ? 1 : -1
      const delta = detents * baseStep * multiplier * sign
      onStep(delta)
      recordEvent({
        knobId: knob.id,
        ring,
        direction,
        detents,
        multiplier,
        delta,
      })
    },
    [getMultiplier, knob.coarseStep, knob.fineStep, knob.id, onStep, recordEvent],
  )

  const handleWheel = useCallback(
    (ring: RotaryKnobRing) => (event: WheelEvent<HTMLButtonElement>) => {
      event.preventDefault()
      const deltaY = event.deltaY
      if (deltaY === 0) return
      const direction: RotaryKnobDirection = deltaY < 0 ? 'clockwise' : 'counterclockwise'
      const detents = Math.max(1, Math.round(Math.abs(deltaY) / knob.detent.wheelStep))
      rotate(ring, direction, detents)
    },
    [knob.detent.wheelStep, rotate],
  )

  const handlePointerDown = useCallback(
    (ring: RotaryKnobRing) => (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault()
      dragStateRef.current = {
        pointerId: event.pointerId,
        ring,
        lastY: event.clientY,
        accumulator: 0,
        lastDragAt: null,
      }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [],
  )

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      const state = dragStateRef.current
      if (state.pointerId !== event.pointerId || !state.ring) return
      const deltaY = event.clientY - state.lastY
      state.lastY = event.clientY
      state.accumulator += deltaY
      const detentSize = knob.detent.dragThresholdPx
      const rawDetents = Math.trunc(state.accumulator / detentSize)
      if (rawDetents === 0) return
      const direction: RotaryKnobDirection = rawDetents > 0 ? 'counterclockwise' : 'clockwise'
      rotate(state.ring, direction, Math.abs(rawDetents))
      state.accumulator -= rawDetents * detentSize
      state.lastDragAt = Date.now()
    },
    [knob.detent.dragThresholdPx, rotate],
  )

  const handlePointerEnd = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    const state = dragStateRef.current
    if (state.pointerId !== event.pointerId) return
    state.pointerId = null
    state.ring = null
    state.accumulator = 0
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  const handleClick = useCallback(
    (ring: RotaryKnobRing, direction: RotaryKnobDirection) => () => {
      const lastDragAt = dragStateRef.current.lastDragAt
      if (lastDragAt && Date.now() - lastDragAt < 240) {
        dragStateRef.current.lastDragAt = null
        return
      }
      rotate(ring, direction, 1)
    },
    [rotate],
  )

  const outerActive = activeKnobId === knob.id && activeRing === 'outer'
  const innerActive = activeKnobId === knob.id && activeRing === 'inner'
  const outerClassName = ['controls__knob-button', outerActive && 'controls__knob-button--active']
    .filter(Boolean)
    .join(' ')
  const innerClassName = [
    'controls__knob-button',
    'controls__knob-button--fine',
    innerActive && 'controls__knob-button--active',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="controls__knob-actions" aria-label={`${knob.label} knob controls`}>
      <button
        className={outerClassName}
        type="button"
        onClick={handleClick('outer', 'counterclockwise')}
        onWheel={handleWheel('outer')}
        onPointerDown={handlePointerDown('outer')}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        aria-label={`${knob.label} decrease coarse`}
      >
        -{knob.coarseStep}
      </button>
      <button
        className={outerClassName}
        type="button"
        onClick={handleClick('outer', 'clockwise')}
        onWheel={handleWheel('outer')}
        onPointerDown={handlePointerDown('outer')}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        aria-label={`${knob.label} increase coarse`}
      >
        +{knob.coarseStep}
      </button>
      <button
        className={innerClassName}
        type="button"
        onClick={handleClick('inner', 'counterclockwise')}
        onWheel={handleWheel('inner')}
        onPointerDown={handlePointerDown('inner')}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        aria-label={`${knob.label} decrease fine`}
      >
        -{knob.fineStep}
      </button>
      <button
        className={innerClassName}
        type="button"
        onClick={handleClick('inner', 'clockwise')}
        onWheel={handleWheel('inner')}
        onPointerDown={handlePointerDown('inner')}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        aria-label={`${knob.label} increase fine`}
      >
        +{knob.fineStep}
      </button>
    </div>
  )
}
