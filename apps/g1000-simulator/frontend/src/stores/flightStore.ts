import create from 'zustand'

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
    hasBoolean(payload.autopilot?.master_on) &&
    hasString(payload.autopilot?.lateral_mode) &&
    hasString(payload.autopilot?.vertical_mode) &&
    hasString(payload.autopilot?.lateral_armed) &&
    hasString(payload.autopilot?.vertical_armed) &&
    hasNumber(payload.autopilot?.target_vertical_speed_fpm) &&
    hasBoolean(payload.autopilot?.bank_limit_active) &&
    hasBoolean(payload.autopilot?.pitch_limit_active) &&
    hasString(payload.autopilot?.disconnect_reason) &&
    hasBoolean(payload.audio_panel?.com1_enabled) &&
    hasBoolean(payload.audio_panel?.com2_enabled) &&
    hasBoolean(payload.audio_panel?.nav1_enabled) &&
    hasBoolean(payload.audio_panel?.nav2_enabled) &&
    hasBoolean(payload.audio_panel?.adf_enabled) &&
    hasBoolean(payload.audio_panel?.marker_enabled) &&
    hasBoolean(payload.audio_panel?.speaker_enabled) &&
    hasBoolean(payload.audio_panel?.headphone_enabled) &&
    hasNumber(payload.audio_panel?.com1_volume) &&
    hasNumber(payload.audio_panel?.com2_volume) &&
    hasNumber(payload.audio_panel?.nav1_volume) &&
    hasNumber(payload.audio_panel?.nav2_volume) &&
    hasNumber(payload.audio_panel?.adf_volume) &&
    hasNumber(payload.audio_panel?.marker_volume) &&
    hasNumber(payload.audio_panel?.adf_audio_level) &&
    hasNumber(payload.audio_panel?.marker_audio_level) &&
    hasBoolean(payload.audio_panel?.marker_outer_active) &&
    hasBoolean(payload.audio_panel?.marker_middle_active) &&
    hasBoolean(payload.audio_panel?.marker_inner_active) &&
    hasString(payload.transponder?.mode) &&
    hasString(payload.transponder?.squawk_code) &&
    hasBoolean(payload.transponder?.ident_active) &&
    hasNumber(payload.transponder?.ident_remaining_sec) &&
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
