import type { CommandTopic, WebSocketCommandMessage } from "./schema";

export type CommandName =
  | "reset"
  | "set_targets"
  | "set_adf"
  | "set_dme"
  | "set_autopilot"
  | "set_audio_panel"
  | "set_transponder";

export interface CommandPayloadBase {
  command?: CommandName;
  type?: CommandName;
  requestId?: string;
  legacy?: Record<string, unknown>;
}

export interface ResetCommandPayload extends CommandPayloadBase {
  command?: "reset";
  type?: "reset";
}

export interface SetTargetsCommandPayload extends CommandPayloadBase {
  command?: "set_targets";
  type?: "set_targets";
  targets: {
    heading_deg?: number;
    altitude_ft?: number;
    airspeed_kt?: number;
  };
}

export interface SetAdfCommandPayload extends CommandPayloadBase {
  command?: "set_adf";
  type?: "set_adf";
  frequency_khz: number;
}

export interface SetDmeCommandPayload extends CommandPayloadBase {
  command?: "set_dme";
  type?: "set_dme";
  frequency_mhz: number;
}

export interface SetAutopilotCommandPayload extends CommandPayloadBase {
  command?: "set_autopilot";
  type?: "set_autopilot";
  master_on?: boolean;
  lateral_mode?: string;
  vertical_mode?: string;
  target_vertical_speed_fpm?: number;
}

export interface SetAudioPanelCommandPayload extends CommandPayloadBase {
  command?: "set_audio_panel";
  type?: "set_audio_panel";
  com1_enabled?: boolean;
  com2_enabled?: boolean;
  nav1_enabled?: boolean;
  nav2_enabled?: boolean;
  adf_enabled?: boolean;
  marker_enabled?: boolean;
  speaker_enabled?: boolean;
  headphone_enabled?: boolean;
  com1_volume?: number;
  com2_volume?: number;
  nav1_volume?: number;
  nav2_volume?: number;
  adf_volume?: number;
  marker_volume?: number;
}

export interface SetTransponderCommandPayload extends CommandPayloadBase {
  command?: "set_transponder";
  type?: "set_transponder";
  mode?: string;
  squawk_code?: string | number;
  ident?: boolean;
}

export type CommandPayload =
  | ResetCommandPayload
  | SetTargetsCommandPayload
  | SetAdfCommandPayload
  | SetDmeCommandPayload
  | SetAutopilotCommandPayload
  | SetAudioPanelCommandPayload
  | SetTransponderCommandPayload;

export type CommandMessage<TPayload extends CommandPayload = CommandPayload> =
  WebSocketCommandMessage<TPayload> & {
    topic: CommandTopic;
  };

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

const isCommandName = (value: unknown): value is CommandName =>
  isString(value)
  && [
    "reset",
    "set_targets",
    "set_adf",
    "set_dme",
    "set_autopilot",
    "set_audio_panel",
    "set_transponder",
  ].includes(value);

const resolveCommandName = (value: RecordValue): CommandName | null => {
  if (isCommandName(value.command)) {
    return value.command;
  }
  if (isCommandName(value.type)) {
    return value.type;
  }
  return null;
};

const isTargetsPayload = (value: unknown): value is SetTargetsCommandPayload =>
  isRecord(value)
  && isRecord(value.targets)
  && isOptionalNumber(value.targets.heading_deg)
  && isOptionalNumber(value.targets.altitude_ft)
  && isOptionalNumber(value.targets.airspeed_kt);

export const isCommandPayload = (value: unknown): value is CommandPayload => {
  if (!isRecord(value)) {
    return false;
  }
  const command = resolveCommandName(value);
  if (!command) {
    return false;
  }
  switch (command) {
    case "reset":
      return true;
    case "set_targets":
      return isTargetsPayload(value);
    case "set_adf":
      return isNumber(value.frequency_khz);
    case "set_dme":
      return isNumber(value.frequency_mhz);
    case "set_autopilot":
      return (
        isOptionalBoolean(value.master_on)
        && isOptionalString(value.lateral_mode)
        && isOptionalString(value.vertical_mode)
        && isOptionalNumber(value.target_vertical_speed_fpm)
      );
    case "set_audio_panel":
      return (
        isOptionalBoolean(value.com1_enabled)
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
      );
    case "set_transponder":
      return (
        isOptionalString(value.mode)
        && (value.squawk_code === undefined
          || isString(value.squawk_code)
          || isNumber(value.squawk_code))
        && isOptionalBoolean(value.ident)
      );
    default:
      return false;
  }
};
