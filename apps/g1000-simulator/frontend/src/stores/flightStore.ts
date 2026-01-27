import { create } from 'zustand'

import type { SocketStatus } from '../hooks/useWebSocketClient'
import type { TelemetrySnapshot } from '../types/telemetry'

type FlightState = {
  telemetry: TelemetrySnapshot | null
  socketStatus: SocketStatus
  lastUpdated: number | null
}

type FlightActions = {
  setTelemetry: (telemetry: TelemetrySnapshot | null) => void
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
  setSocketStatus: (socketStatus) => set({ socketStatus }),
  reset: () => set(defaultState),
}))

export const useFlightTelemetry = () => useFlightStore((state) => state.telemetry)
export const useFlightSocketStatus = () => useFlightStore((state) => state.socketStatus)
export const useFlightLastUpdated = () => useFlightStore((state) => state.lastUpdated)
