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
const hasString = (value: unknown): value is string => typeof value === 'string'
const hasBoolean = (value: unknown): value is boolean => typeof value === 'boolean'

const isFullTelemetry = (payload: TelemetrySnapshot | TelemetryUpdate): payload is TelemetrySnapshot => {
  return (
    hasNumber(payload.timestamp) &&
    hasNumber(payload.position?.latitude_deg) &&
    hasNumber(payload.position?.longitude_deg) &&
    hasNumber(payload.position?.altitude_ft) &&
    hasNumber(payload.attitude?.heading_deg) &&
    hasNumber(payload.attitude?.pitch_deg) &&
    hasNumber(payload.attitude?.roll_deg) &&
    hasNumber(payload.adc?.ias_kt) &&
    hasNumber(payload.adc?.cas_kt) &&
    hasNumber(payload.adc?.tas_kt) &&
    hasNumber(payload.adc?.pressure_altitude_ft) &&
    hasNumber(payload.adc?.density_altitude_ft) &&
    hasNumber(payload.adc?.vertical_speed_fpm) &&
    hasNumber(payload.adc?.oat_c) &&
    hasNumber(payload.gps?.latitude_deg) &&
    hasNumber(payload.gps?.longitude_deg) &&
    hasNumber(payload.gps?.altitude_ft) &&
    hasNumber(payload.gps?.ground_speed_kt) &&
    hasNumber(payload.gps?.track_deg) &&
    hasNumber(payload.adf?.tuned_frequency_khz) &&
    hasString(payload.adf?.station_ident) &&
    hasString(payload.adf?.station_name) &&
    hasNumber(payload.adf?.bearing_deg) &&
    hasNumber(payload.adf?.relative_bearing_deg) &&
    hasNumber(payload.adf?.distance_nm) &&
    hasNumber(payload.adf?.signal_strength) &&
    hasBoolean(payload.adf?.receiving) &&
    hasNumber(payload.dme?.tuned_frequency_mhz) &&
    hasString(payload.dme?.station_ident) &&
    hasString(payload.dme?.station_name) &&
    hasNumber(payload.dme?.slant_range_nm) &&
    hasNumber(payload.dme?.ground_speed_kt) &&
    hasNumber(payload.dme?.signal_strength) &&
    hasBoolean(payload.dme?.receiving) &&
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
