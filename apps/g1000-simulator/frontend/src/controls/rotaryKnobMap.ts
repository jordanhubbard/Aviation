export type RotaryKnobId = 'fms' | 'heading' | 'course' | 'altitude' | 'range' | 'airspeed'

export type RotaryKnobRing = 'outer' | 'inner'

export type RotaryKnobDirection = 'clockwise' | 'counterclockwise'

export type RotaryKnobDetentConfig = {
  dragThresholdPx: number
  wheelStep: number
}

export type RotaryKnobAccelerationConfig = {
  minIntervalMs: number
  maxIntervalMs: number
  multiplierStep: number
  maxMultiplier: number
}

export type RotaryKnobDefinition = {
  id: RotaryKnobId
  label: string
  description: string
  unit?: string
  coarseStep: number
  fineStep: number
  detent: RotaryKnobDetentConfig
  acceleration: RotaryKnobAccelerationConfig
}

export const ROTARY_KNOB_FOCUS_TIMEOUT_MS = 3200

const DEFAULT_DETENT: RotaryKnobDetentConfig = {
  dragThresholdPx: 14,
  wheelStep: 80,
}

const DEFAULT_ACCELERATION: RotaryKnobAccelerationConfig = {
  minIntervalMs: 90,
  maxIntervalMs: 320,
  multiplierStep: 1,
  maxMultiplier: 4,
}

export const ROTARY_KNOBS: RotaryKnobDefinition[] = [
  {
    id: 'fms',
    label: 'FMS',
    description: 'Flight management system selection',
    coarseStep: 1,
    fineStep: 1,
    detent: DEFAULT_DETENT,
    acceleration: DEFAULT_ACCELERATION,
  },
  {
    id: 'heading',
    label: 'HDG',
    description: 'Heading bug adjustment',
    unit: '°',
    coarseStep: 10,
    fineStep: 1,
    detent: DEFAULT_DETENT,
    acceleration: DEFAULT_ACCELERATION,
  },
  {
    id: 'course',
    label: 'CRS',
    description: 'Course selector adjustment',
    unit: '°',
    coarseStep: 10,
    fineStep: 1,
    detent: DEFAULT_DETENT,
    acceleration: DEFAULT_ACCELERATION,
  },
  {
    id: 'altitude',
    label: 'ALT',
    description: 'Altitude bug adjustment',
    unit: ' ft',
    coarseStep: 500,
    fineStep: 100,
    detent: DEFAULT_DETENT,
    acceleration: DEFAULT_ACCELERATION,
  },
  {
    id: 'range',
    label: 'RNG',
    description: 'Map range adjustment',
    unit: ' nm',
    coarseStep: 5,
    fineStep: 1,
    detent: DEFAULT_DETENT,
    acceleration: DEFAULT_ACCELERATION,
  },
  {
    id: 'airspeed',
    label: 'SPD',
    description: 'Airspeed bug adjustment',
    unit: ' kt',
    coarseStep: 5,
    fineStep: 1,
    detent: DEFAULT_DETENT,
    acceleration: DEFAULT_ACCELERATION,
  },
]

export const ROTARY_KNOB_MAP = ROTARY_KNOBS.reduce(
  (accumulator, knob) => ({ ...accumulator, [knob.id]: knob }),
  {} as Record<RotaryKnobId, RotaryKnobDefinition>,
)
