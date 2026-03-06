import create from 'zustand'

export type CursorMode = 'inactive' | 'active'
export type CursorFocusTarget = 'aircraft'
export type CursorAction = 'activate' | 'deactivate' | 'move' | 'select' | 'cancel'

export type CursorCalibration = {
  deadzone: number
  sensitivity: number
}

export type CursorConfig = {
  speed: number
  acceleration: number
}

export type CursorPosition = {
  x: number
  y: number
}

type CursorState = {
  mode: CursorMode
  position: CursorPosition
  focusTarget: CursorFocusTarget | null
  lastAction: CursorAction | null
  calibration: CursorCalibration
  config: CursorConfig
}

type CursorActions = {
  setCursorMode: (mode: CursorMode) => void
  toggleCursorMode: () => void
  setCursorPosition: (position: CursorPosition) => void
  moveCursor: (deltaX: number, deltaY: number) => void
  setFocusTarget: (focusTarget: CursorFocusTarget | null) => void
  selectTarget: () => void
  cancelCursor: () => void
  setCalibration: (calibration: CursorCalibration) => void
  centerCursor: () => void
}

const CALIBRATION_STORAGE_ID = ['g1000', 'cursor', 'calibration'].join('-')

const DEFAULT_CALIBRATION: CursorCalibration = {
  deadzone: 0.18,
  sensitivity: 1,
}

const DEFAULT_CONFIG: CursorConfig = {
  speed: 0.03,
  acceleration: 1.4,
}

const DEFAULT_POSITION: CursorPosition = {
  x: 0.5,
  y: 0.5,
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const loadCalibration = (): CursorCalibration => {
  if (typeof window === 'undefined') return DEFAULT_CALIBRATION
  try {
    const stored = window.localStorage.getItem(CALIBRATION_STORAGE_ID)
    if (!stored) return DEFAULT_CALIBRATION
    const parsed = JSON.parse(stored)
    if (
      typeof parsed?.deadzone === 'number' &&
      typeof parsed?.sensitivity === 'number' &&
      parsed.deadzone >= 0 &&
      parsed.deadzone <= 0.4 &&
      parsed.sensitivity >= 0.5 &&
      parsed.sensitivity <= 2.5
    ) {
      return parsed
    }
  } catch {
    return DEFAULT_CALIBRATION
  }
  return DEFAULT_CALIBRATION
}

const persistCalibration = (calibration: CursorCalibration) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CALIBRATION_STORAGE_ID, JSON.stringify(calibration))
  } catch {
    return
  }
}

const defaultState: CursorState = {
  mode: 'inactive',
  position: DEFAULT_POSITION,
  focusTarget: null,
  lastAction: null,
  calibration: DEFAULT_CALIBRATION,
  config: DEFAULT_CONFIG,
}

const initialState: CursorState = {
  ...defaultState,
  calibration: loadCalibration(),
}

export const useCursorStore = create<CursorState & CursorActions>((set) => ({
  ...initialState,
  setCursorMode: (mode) =>
    set((state) => ({
      mode,
      lastAction: mode === 'active' ? 'activate' : 'deactivate',
      focusTarget: mode === 'inactive' ? null : state.focusTarget,
    })),
  toggleCursorMode: () =>
    set((state) => ({
      mode: state.mode === 'active' ? 'inactive' : 'active',
      lastAction: state.mode === 'active' ? 'deactivate' : 'activate',
      focusTarget: state.mode === 'active' ? null : state.focusTarget,
    })),
  setCursorPosition: (position) =>
    set(() => ({
      position: {
        x: clamp(position.x, 0.05, 0.95),
        y: clamp(position.y, 0.05, 0.95),
      },
      lastAction: 'move',
    })),
  moveCursor: (deltaX, deltaY) =>
    set((state) => ({
      position: {
        x: clamp(state.position.x + deltaX, 0.05, 0.95),
        y: clamp(state.position.y + deltaY, 0.05, 0.95),
      },
      lastAction: 'move',
    })),
  setFocusTarget: (focusTarget) => set({ focusTarget }),
  selectTarget: () =>
    set((state) => ({
      mode: 'active',
      lastAction: 'select',
      focusTarget: state.focusTarget,
    })),
  cancelCursor: () => set({ mode: 'inactive', lastAction: 'cancel', focusTarget: null }),
  setCalibration: (calibration) => {
    const nextCalibration = {
      deadzone: clamp(calibration.deadzone, 0, 0.4),
      sensitivity: clamp(calibration.sensitivity, 0.5, 2.5),
    }
    persistCalibration(nextCalibration)
    set({ calibration: nextCalibration })
  },
  centerCursor: () => set({ position: DEFAULT_POSITION, lastAction: 'move' }),
}))

export const useCursorMode = () => useCursorStore((state) => state.mode)
export const useCursorPosition = () => useCursorStore((state) => state.position)
export const useCursorCalibration = () => useCursorStore((state) => state.calibration)
export const useCursorConfig = () => useCursorStore((state) => state.config)
export const useCursorFocusTarget = () => useCursorStore((state) => state.focusTarget)
export const useCursorLastAction = () => useCursorStore((state) => state.lastAction)
