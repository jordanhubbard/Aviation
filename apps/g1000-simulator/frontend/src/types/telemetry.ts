export type TelemetrySnapshot = {
  position: {
    latitude_deg: number
    longitude_deg: number
    altitude_ft: number
  }
  attitude: {
    heading_deg: number
    pitch_deg: number
    roll_deg: number
    true_heading_deg?: number
    yaw_deg?: number
    slip_skid_deg?: number
    magnetic_variation_deg?: number
  }
  adc: {
    ias_kt: number
    cas_kt: number
    tas_kt: number
    pressure_altitude_ft: number
    density_altitude_ft: number
    vertical_speed_fpm: number
    oat_c: number
  }
  gps: {
    latitude_deg: number
    longitude_deg: number
    altitude_ft: number
    ground_speed_kt: number
    track_deg: number
    waas_available: boolean
    waas_enabled: boolean
    raim_available: boolean
    raim_ok: boolean
    fix_valid: boolean
    horizontal_accuracy_m: number
    vertical_accuracy_m: number
  }
  adf: {
    tuned_frequency_khz: number
    station_ident: string
    station_name: string
    bearing_deg: number
    relative_bearing_deg: number
    distance_nm: number
    signal_strength: number
    receiving: boolean
  }
  dme: {
    tuned_frequency_mhz: number
    station_ident: string
    station_name: string
    slant_range_nm: number
    ground_speed_kt: number
    signal_strength: number
    receiving: boolean
  }
  autopilot: {
    master_on: boolean
    lateral_mode: string
    vertical_mode: string
    lateral_armed: string
    vertical_armed: string
    target_vertical_speed_fpm: number
    bank_limit_active: boolean
    pitch_limit_active: boolean
    disconnect_reason: string
  }
  audio_panel: {
    com1_enabled: boolean
    com2_enabled: boolean
    nav1_enabled: boolean
    nav2_enabled: boolean
    adf_enabled: boolean
    marker_enabled: boolean
    speaker_enabled: boolean
    headphone_enabled: boolean
    com1_volume: number
    com2_volume: number
    nav1_volume: number
    nav2_volume: number
    adf_volume: number
    marker_volume: number
    adf_audio_level: number
    marker_audio_level: number
    marker_outer_active: boolean
    marker_middle_active: boolean
    marker_inner_active: boolean
  }
  transponder: {
    mode: string
    squawk_code: string
    ident_active: boolean
    ident_remaining_sec: number
  }
  velocity: {
    airspeed_kt: number
    vertical_speed_fpm: number
    turn_rate_dps: number
  }
  targets: {
    heading_deg: number
    altitude_ft: number
    airspeed_kt: number
  }
  timestamp: number
}

export type TelemetryUpdate = {
  position?: Partial<TelemetrySnapshot['position']>
  attitude?: Partial<TelemetrySnapshot['attitude']>
  adc?: Partial<TelemetrySnapshot['adc']>
  gps?: Partial<TelemetrySnapshot['gps']>
  adf?: Partial<TelemetrySnapshot['adf']>
  dme?: Partial<TelemetrySnapshot['dme']>
  autopilot?: Partial<TelemetrySnapshot['autopilot']>
  audio_panel?: Partial<TelemetrySnapshot['audio_panel']>
  transponder?: Partial<TelemetrySnapshot['transponder']>
  velocity?: Partial<TelemetrySnapshot['velocity']>
  targets?: Partial<TelemetrySnapshot['targets']>
  timestamp?: number
}
