import { create } from 'zustand'
import { isTelemetrySnapshot } from '@aviation/g1000-protocols'

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
    if (isTelemetrySnapshot(telemetryUpdate)) {
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
        adc: {
          ...state.telemetry.adc,
          ...(telemetryUpdate.adc ?? {}),
        },
        gps: {
          ...state.telemetry.gps,
          ...(telemetryUpdate.gps ?? {}),
        },
        adf: {
          ...state.telemetry.adf,
          ...(telemetryUpdate.adf ?? {}),
        },
        dme: {
          ...state.telemetry.dme,
          ...(telemetryUpdate.dme ?? {}),
        },
        autopilot: {
          ...state.telemetry.autopilot,
          ...(telemetryUpdate.autopilot ?? {}),
        },
        audio_panel: {
          ...state.telemetry.audio_panel,
          ...(telemetryUpdate.audio_panel ?? {}),
        },
        transponder: {
          ...state.telemetry.transponder,
          ...(telemetryUpdate.transponder ?? {}),
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
