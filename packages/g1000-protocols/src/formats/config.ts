export const CONFIG_SCHEMA_VERSION = "1.0.0";

export interface DisplayConfig {
  theme?: string;
  units?: "imperial" | "metric";
  brightness?: number;
}

export interface SimulatorConfig {
  aircraft?: string;
  autopilot_enabled?: boolean;
  update_rate_hz?: number;
}

export interface NavigationConfig {
  nav_database_version?: string;
  map_range_nm?: number;
}

export interface G1000Config {
  version: string;
  display?: DisplayConfig;
  simulator?: SimulatorConfig;
  navigation?: NavigationConfig;
}

type RecordValue = Record<string, unknown>;

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === "object" && value !== null;

const isString = (value: unknown): value is string => typeof value === "string";

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isDisplayConfig = (value: unknown): value is DisplayConfig =>
  isRecord(value)
  && (value.theme === undefined || isString(value.theme))
  && (value.units === undefined
    || value.units === "imperial"
    || value.units === "metric")
  && (value.brightness === undefined || isNumber(value.brightness));

const isSimulatorConfig = (value: unknown): value is SimulatorConfig =>
  isRecord(value)
  && (value.aircraft === undefined || isString(value.aircraft))
  && (value.autopilot_enabled === undefined || isBoolean(value.autopilot_enabled))
  && (value.update_rate_hz === undefined || isNumber(value.update_rate_hz));

const isNavigationConfig = (value: unknown): value is NavigationConfig =>
  isRecord(value)
  && (value.nav_database_version === undefined
    || isString(value.nav_database_version))
  && (value.map_range_nm === undefined || isNumber(value.map_range_nm));

export const isG1000Config = (value: unknown): value is G1000Config =>
  isRecord(value)
  && isString(value.version)
  && (value.display === undefined || isDisplayConfig(value.display))
  && (value.simulator === undefined || isSimulatorConfig(value.simulator))
  && (value.navigation === undefined || isNavigationConfig(value.navigation));
