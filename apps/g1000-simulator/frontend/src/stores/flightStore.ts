import { create } from 'zustand'

import type { SocketStatus } from '../hooks/useWebSocketClient'
import type { TelemetrySnapshot, TelemetryUpdate } from '../types/telemetry'

type FlightState = {
  telemetry: TelemetrySnapshot | null
  socketStatus: SocketStatus
  lastUpdated: number | null
}

type FlightActions = {
  setTelemetry: (telemetry: TelemetrySnapshot | null) => void
  applyTelemetryUpdate: (telemetry: TelemetrySnapshot | TelemetryUpdate | null) => void
  setSocketStatus: (status: SocketStatus) => void
  reset: () => void
}

const defaultState: FlightState = {
  telemetry: null,
  socketStatus: 'connecting',
  lastUpdated: null,
}

const hasNumber = (value: unknown): value is number => typeof value === 'number'

const isFullTelemetry = (payload: TelemetrySnapshot | TelemetryUpdate): payload is TelemetrySnapshot => {
  return (
    hasNumber(payload.timestamp) &&
    hasNumber(payload.position?.latitude_deg) &&
    hasNumber(payload.position?.longitude_deg) &&
    hasNumber(payload.position?.altitude_ft) &&
    hasNumber(payload.attitude?.heading_deg) &&
    hasNumber(payload.attitude?.pitch_deg) &&
    hasNumber(payload.attitude?.roll_deg) &&
    hasNumber(payload.velocity?.airspeed_kt) &&
    hasNumber(payload.velocity?.vertical_speed_fpm) &&
    hasNumber(payload.velocity?.turn_rate_dps) &&
    hasNumber(payload.targets?.heading_deg) &&
    hasNumber(payload.targets?.altitude_ft) &&
    hasNumber(payload.targets?.airspeed_kt)
  )
}

export const useFlightStore = create<FlightState & FlightActions>((set) => ({
  ...defaultState,
  setTelemetry: (telemetry) =>
    set({
      telemetry,
      lastUpdated: telemetry?.timestamp ?? null,
    }),
  applyTelemetryUpdate: (telemetryUpdate) => {
    if (!telemetryUpdate) {
      set({ telemetry: null, lastUpdated: null })
      return
    }
    if (isFullTelemetry(telemetryUpdate)) {
      set({ telemetry: telemetryUpdate, lastUpdated: telemetryUpdate.timestamp })
      return
    }
    set((state) => {
      if (!state.telemetry) {
        return state
      }
      const nextTelemetry: TelemetrySnapshot = {
        position: {
          ...state.telemetry.position,
          ...telemetryUpdate.position,
        },
        attitude: {
          ...state.telemetry.attitude,
          ...telemetryUpdate.attitude,
        },
        velocity: {
          ...state.telemetry.velocity,
          ...telemetryUpdate.velocity,
        },
        targets: {
          ...state.telemetry.targets,
          ...telemetryUpdate.targets,
        },
        timestamp: telemetryUpdate.timestamp ?? state.telemetry.timestamp,
      }
      return { telemetry: nextTelemetry, lastUpdated: nextTelemetry.timestamp }
    })
  },
  setSocketStatus: (socketStatus) => set({ socketStatus }),
  reset: () => set(defaultState),
}))

export const useFlightTelemetry = () => useFlightStore((state) => state.telemetry)
export const useFlightSocketStatus = () => useFlightStore((state) => state.socketStatus)
export const useFlightLastUpdated = () => useFlightStore((state) => state.lastUpdated)
