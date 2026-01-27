export type AutopilotLateralMode = "ROL" | "HDG" | "NAV" | "APR" | "BC";
export type AutopilotVerticalMode = "PIT" | "VS" | "ALT" | "ALTS" | "GS" | "GP";
export type TransponderMode = "OFF" | "STBY" | "A" | "C" | "S";

export interface TelemetryPosition {
  latitude_deg: number;
  longitude_deg: number;
  altitude_ft: number;
}

export interface TelemetryAttitude {
  heading_deg: number;
  pitch_deg: number;
  roll_deg: number;
  true_heading_deg?: number;
  yaw_deg?: number;
  slip_skid_deg?: number;
  magnetic_variation_deg?: number;
}

export interface TelemetryAdc {
  ias_kt: number;
  cas_kt: number;
  tas_kt: number;
  pressure_altitude_ft: number;
  density_altitude_ft: number;
  vertical_speed_fpm: number;
  oat_c: number;
}

export interface TelemetryGps {
  latitude_deg: number;
  longitude_deg: number;
  altitude_ft: number;
  ground_speed_kt: number;
  track_deg: number;
  waas_available: boolean;
  waas_enabled: boolean;
  raim_available: boolean;
  raim_ok: boolean;
  fix_valid: boolean;
  horizontal_accuracy_m: number;
  vertical_accuracy_m: number;
}

export interface TelemetryAdf {
  tuned_frequency_khz: number;
  station_ident: string;
  station_name: string;
  bearing_deg: number;
  relative_bearing_deg: number;
  distance_nm: number;
  signal_strength: number;
  receiving: boolean;
}

export interface TelemetryDme {
  tuned_frequency_mhz: number;
  station_ident: string;
  station_name: string;
  slant_range_nm: number;
  ground_speed_kt: number;
  signal_strength: number;
  receiving: boolean;
}

export interface TelemetryAutopilot {
  master_on: boolean;
  lateral_mode: AutopilotLateralMode | string;
  vertical_mode: AutopilotVerticalMode | string;
  lateral_armed: string;
  vertical_armed: string;
  target_vertical_speed_fpm: number;
  bank_limit_active: boolean;
  pitch_limit_active: boolean;
  disconnect_reason: string;
}

export interface TelemetryAudioPanel {
  com1_enabled: boolean;
  com2_enabled: boolean;
  nav1_enabled: boolean;
  nav2_enabled: boolean;
  adf_enabled: boolean;
  marker_enabled: boolean;
  speaker_enabled: boolean;
  headphone_enabled: boolean;
  com1_volume: number;
  com2_volume: number;
  nav1_volume: number;
  nav2_volume: number;
  adf_volume: number;
  marker_volume: number;
  adf_audio_level: number;
  marker_audio_level: number;
  marker_outer_active: boolean;
  marker_middle_active: boolean;
  marker_inner_active: boolean;
}

export interface TelemetryTransponder {
  mode: TransponderMode | string;
  squawk_code: string;
  ident_active: boolean;
  ident_remaining_sec: number;
}

export interface TelemetryVelocity {
  airspeed_kt: number;
  vertical_speed_fpm: number;
  turn_rate_dps: number;
}

export interface TelemetryTargets {
  heading_deg: number;
  altitude_ft: number;
  airspeed_kt: number;
}

export interface TelemetryMetadata {
  schemaVersion?: string;
  source?: string;
}

export interface TelemetrySnapshot {
  position: TelemetryPosition;
  attitude: TelemetryAttitude;
  adc: TelemetryAdc;
  gps: TelemetryGps;
  adf: TelemetryAdf;
  dme: TelemetryDme;
  autopilot: TelemetryAutopilot;
  audio_panel: TelemetryAudioPanel;
  transponder: TelemetryTransponder;
  velocity: TelemetryVelocity;
  targets: TelemetryTargets;
  timestamp: number;
  metadata?: TelemetryMetadata;
  legacy?: Record<string, unknown>;
}

export type TelemetryUpdate = {
  position?: Partial<TelemetryPosition>;
  attitude?: Partial<TelemetryAttitude>;
  adc?: Partial<TelemetryAdc>;
  gps?: Partial<TelemetryGps>;
  adf?: Partial<TelemetryAdf>;
  dme?: Partial<TelemetryDme>;
  autopilot?: Partial<TelemetryAutopilot>;
  audio_panel?: Partial<TelemetryAudioPanel>;
  transponder?: Partial<TelemetryTransponder>;
  velocity?: Partial<TelemetryVelocity>;
  targets?: Partial<TelemetryTargets>;
  timestamp?: number;
  metadata?: TelemetryMetadata;
  legacy?: Record<string, unknown>;
};

export type TelemetryPayload = TelemetrySnapshot | TelemetryUpdate;

type RecordValue = Record<string, unknown>;

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === "object" && value !== null;

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

const isString = (value: unknown): value is string => typeof value === "string";

const isOptionalNumber = (value: unknown): value is number | undefined =>
  value === undefined || isNumber(value);

const isOptionalBoolean = (value: unknown): value is boolean | undefined =>
  value === undefined || isBoolean(value);

const isOptionalString = (value: unknown): value is string | undefined =>
  value === undefined || isString(value);

const isTelemetryPosition = (value: unknown): value is TelemetryPosition =>
  isRecord(value)
  && isNumber(value.latitude_deg)
  && isNumber(value.longitude_deg)
  && isNumber(value.altitude_ft);

const isTelemetryAttitude = (value: unknown): value is TelemetryAttitude =>
  isRecord(value)
  && isNumber(value.heading_deg)
  && isNumber(value.pitch_deg)
  && isNumber(value.roll_deg)
  && isOptionalNumber(value.true_heading_deg)
  && isOptionalNumber(value.yaw_deg)
  && isOptionalNumber(value.slip_skid_deg)
  && isOptionalNumber(value.magnetic_variation_deg);

const isTelemetryAdc = (value: unknown): value is TelemetryAdc =>
  isRecord(value)
  && isNumber(value.ias_kt)
  && isNumber(value.cas_kt)
  && isNumber(value.tas_kt)
  && isNumber(value.pressure_altitude_ft)
  && isNumber(value.density_altitude_ft)
  && isNumber(value.vertical_speed_fpm)
  && isNumber(value.oat_c);

const isTelemetryGps = (value: unknown): value is TelemetryGps =>
  isRecord(value)
  && isNumber(value.latitude_deg)
  && isNumber(value.longitude_deg)
  && isNumber(value.altitude_ft)
  && isNumber(value.ground_speed_kt)
  && isNumber(value.track_deg)
  && isBoolean(value.waas_available)
  && isBoolean(value.waas_enabled)
  && isBoolean(value.raim_available)
  && isBoolean(value.raim_ok)
  && isBoolean(value.fix_valid)
  && isNumber(value.horizontal_accuracy_m)
  && isNumber(value.vertical_accuracy_m);

const isTelemetryAdf = (value: unknown): value is TelemetryAdf =>
  isRecord(value)
  && isNumber(value.tuned_frequency_khz)
  && isString(value.station_ident)
  && isString(value.station_name)
  && isNumber(value.bearing_deg)
  && isNumber(value.relative_bearing_deg)
  && isNumber(value.distance_nm)
  && isNumber(value.signal_strength)
  && isBoolean(value.receiving);

const isTelemetryDme = (value: unknown): value is TelemetryDme =>
  isRecord(value)
  && isNumber(value.tuned_frequency_mhz)
  && isString(value.station_ident)
  && isString(value.station_name)
  && isNumber(value.slant_range_nm)
  && isNumber(value.ground_speed_kt)
  && isNumber(value.signal_strength)
  && isBoolean(value.receiving);

const isTelemetryAutopilot = (value: unknown): value is TelemetryAutopilot =>
  isRecord(value)
  && isBoolean(value.master_on)
  && isString(value.lateral_mode)
  && isString(value.vertical_mode)
  && isString(value.lateral_armed)
  && isString(value.vertical_armed)
  && isNumber(value.target_vertical_speed_fpm)
  && isBoolean(value.bank_limit_active)
  && isBoolean(value.pitch_limit_active)
  && isString(value.disconnect_reason);

const isTelemetryAudioPanel = (value: unknown): value is TelemetryAudioPanel =>
  isRecord(value)
  && isBoolean(value.com1_enabled)
  && isBoolean(value.com2_enabled)
  && isBoolean(value.nav1_enabled)
  && isBoolean(value.nav2_enabled)
  && isBoolean(value.adf_enabled)
  && isBoolean(value.marker_enabled)
  && isBoolean(value.speaker_enabled)
  && isBoolean(value.headphone_enabled)
  && isNumber(value.com1_volume)
  && isNumber(value.com2_volume)
  && isNumber(value.nav1_volume)
  && isNumber(value.nav2_volume)
  && isNumber(value.adf_volume)
  && isNumber(value.marker_volume)
  && isNumber(value.adf_audio_level)
  && isNumber(value.marker_audio_level)
  && isBoolean(value.marker_outer_active)
  && isBoolean(value.marker_middle_active)
  && isBoolean(value.marker_inner_active);

const isTelemetryTransponder = (value: unknown): value is TelemetryTransponder =>
  isRecord(value)
  && isString(value.mode)
  && isString(value.squawk_code)
  && isBoolean(value.ident_active)
  && isNumber(value.ident_remaining_sec);

const isTelemetryVelocity = (value: unknown): value is TelemetryVelocity =>
  isRecord(value)
  && isNumber(value.airspeed_kt)
  && isNumber(value.vertical_speed_fpm)
  && isNumber(value.turn_rate_dps);

const isTelemetryTargets = (value: unknown): value is TelemetryTargets =>
  isRecord(value)
  && isNumber(value.heading_deg)
  && isNumber(value.altitude_ft)
  && isNumber(value.airspeed_kt);

const isPartialPosition = (value: unknown): value is Partial<TelemetryPosition> =>
  isRecord(value)
  && isOptionalNumber(value.latitude_deg)
  && isOptionalNumber(value.longitude_deg)
  && isOptionalNumber(value.altitude_ft);

const isPartialAttitude = (value: unknown): value is Partial<TelemetryAttitude> =>
  isRecord(value)
  && isOptionalNumber(value.heading_deg)
  && isOptionalNumber(value.pitch_deg)
  && isOptionalNumber(value.roll_deg)
  && isOptionalNumber(value.true_heading_deg)
  && isOptionalNumber(value.yaw_deg)
  && isOptionalNumber(value.slip_skid_deg)
  && isOptionalNumber(value.magnetic_variation_deg);

const isPartialAdc = (value: unknown): value is Partial<TelemetryAdc> =>
  isRecord(value)
  && isOptionalNumber(value.ias_kt)
  && isOptionalNumber(value.cas_kt)
  && isOptionalNumber(value.tas_kt)
  && isOptionalNumber(value.pressure_altitude_ft)
  && isOptionalNumber(value.density_altitude_ft)
  && isOptionalNumber(value.vertical_speed_fpm)
  && isOptionalNumber(value.oat_c);

const isPartialGps = (value: unknown): value is Partial<TelemetryGps> =>
  isRecord(value)
  && isOptionalNumber(value.latitude_deg)
  && isOptionalNumber(value.longitude_deg)
  && isOptionalNumber(value.altitude_ft)
  && isOptionalNumber(value.ground_speed_kt)
  && isOptionalNumber(value.track_deg)
  && isOptionalBoolean(value.waas_available)
  && isOptionalBoolean(value.waas_enabled)
  && isOptionalBoolean(value.raim_available)
  && isOptionalBoolean(value.raim_ok)
  && isOptionalBoolean(value.fix_valid)
  && isOptionalNumber(value.horizontal_accuracy_m)
  && isOptionalNumber(value.vertical_accuracy_m);

const isPartialAdf = (value: unknown): value is Partial<TelemetryAdf> =>
  isRecord(value)
  && isOptionalNumber(value.tuned_frequency_khz)
  && isOptionalString(value.station_ident)
  && isOptionalString(value.station_name)
  && isOptionalNumber(value.bearing_deg)
  && isOptionalNumber(value.relative_bearing_deg)
  && isOptionalNumber(value.distance_nm)
  && isOptionalNumber(value.signal_strength)
  && isOptionalBoolean(value.receiving);

const isPartialDme = (value: unknown): value is Partial<TelemetryDme> =>
  isRecord(value)
  && isOptionalNumber(value.tuned_frequency_mhz)
  && isOptionalString(value.station_ident)
  && isOptionalString(value.station_name)
  && isOptionalNumber(value.slant_range_nm)
  && isOptionalNumber(value.ground_speed_kt)
  && isOptionalNumber(value.signal_strength)
  && isOptionalBoolean(value.receiving);

const isPartialAutopilot = (
  value: unknown,
): value is Partial<TelemetryAutopilot> =>
  isRecord(value)
  && isOptionalBoolean(value.master_on)
  && isOptionalString(value.lateral_mode)
  && isOptionalString(value.vertical_mode)
  && isOptionalString(value.lateral_armed)
  && isOptionalString(value.vertical_armed)
  && isOptionalNumber(value.target_vertical_speed_fpm)
  && isOptionalBoolean(value.bank_limit_active)
  && isOptionalBoolean(value.pitch_limit_active)
  && isOptionalString(value.disconnect_reason);

const isPartialAudioPanel = (
  value: unknown,
): value is Partial<TelemetryAudioPanel> =>
  isRecord(value)
  && isOptionalBoolean(value.com1_enabled)
  && isOptionalBoolean(value.com2_enabled)
  && isOptionalBoolean(value.nav1_enabled)
  && isOptionalBoolean(value.nav2_enabled)
  && isOptionalBoolean(value.adf_enabled)
  && isOptionalBoolean(value.marker_enabled)
  && isOptionalBoolean(value.speaker_enabled)
  && isOptionalBoolean(value.headphone_enabled)
  && isOptionalNumber(value.com1_volume)
  && isOptionalNumber(value.com2_volume)
  && isOptionalNumber(value.nav1_volume)
  && isOptionalNumber(value.nav2_volume)
  && isOptionalNumber(value.adf_volume)
  && isOptionalNumber(value.marker_volume)
  && isOptionalNumber(value.adf_audio_level)
  && isOptionalNumber(value.marker_audio_level)
  && isOptionalBoolean(value.marker_outer_active)
  && isOptionalBoolean(value.marker_middle_active)
  && isOptionalBoolean(value.marker_inner_active);

const isPartialTransponder = (
  value: unknown,
): value is Partial<TelemetryTransponder> =>
  isRecord(value)
  && isOptionalString(value.mode)
  && isOptionalString(value.squawk_code)
  && isOptionalBoolean(value.ident_active)
  && isOptionalNumber(value.ident_remaining_sec);

const isPartialVelocity = (value: unknown): value is Partial<TelemetryVelocity> =>
  isRecord(value)
  && isOptionalNumber(value.airspeed_kt)
  && isOptionalNumber(value.vertical_speed_fpm)
  && isOptionalNumber(value.turn_rate_dps);

const isPartialTargets = (value: unknown): value is Partial<TelemetryTargets> =>
  isRecord(value)
  && isOptionalNumber(value.heading_deg)
  && isOptionalNumber(value.altitude_ft)
  && isOptionalNumber(value.airspeed_kt);

const isTelemetryMetadata = (
  value: unknown,
): value is TelemetryMetadata | undefined =>
  value === undefined
  || (isRecord(value)
    && isOptionalString(value.schemaVersion)
    && isOptionalString(value.source));

export const isTelemetrySnapshot = (
  value: unknown,
): value is TelemetrySnapshot =>
  isRecord(value)
  && isTelemetryPosition(value.position)
  && isTelemetryAttitude(value.attitude)
  && isTelemetryAdc(value.adc)
  && isTelemetryGps(value.gps)
  && isTelemetryAdf(value.adf)
  && isTelemetryDme(value.dme)
  && isTelemetryAutopilot(value.autopilot)
  && isTelemetryAudioPanel(value.audio_panel)
  && isTelemetryTransponder(value.transponder)
  && isTelemetryVelocity(value.velocity)
  && isTelemetryTargets(value.targets)
  && isNumber(value.timestamp)
  && isTelemetryMetadata(value.metadata)
  && (value.legacy === undefined || isRecord(value.legacy));

export const isTelemetryUpdate = (
  value: unknown,
): value is TelemetryUpdate =>
  isRecord(value)
  && (value.position === undefined || isPartialPosition(value.position))
  && (value.attitude === undefined || isPartialAttitude(value.attitude))
  && (value.adc === undefined || isPartialAdc(value.adc))
  && (value.gps === undefined || isPartialGps(value.gps))
  && (value.adf === undefined || isPartialAdf(value.adf))
  && (value.dme === undefined || isPartialDme(value.dme))
  && (value.autopilot === undefined || isPartialAutopilot(value.autopilot))
  && (value.audio_panel === undefined || isPartialAudioPanel(value.audio_panel))
  && (value.transponder === undefined || isPartialTransponder(value.transponder))
  && (value.velocity === undefined || isPartialVelocity(value.velocity))
  && (value.targets === undefined || isPartialTargets(value.targets))
  && (value.timestamp === undefined || isNumber(value.timestamp))
  && isTelemetryMetadata(value.metadata)
  && (value.legacy === undefined || isRecord(value.legacy));
