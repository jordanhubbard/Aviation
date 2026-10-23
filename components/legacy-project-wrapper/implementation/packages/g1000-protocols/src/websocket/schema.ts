export const WEBSOCKET_PROTOCOL_VERSION = "1.0.0";

export type WebSocketChannel =
  | "telemetry"
  | "command"
  | "display"
  | "navigation"
  | "system"
  | "alerts";

export type TelemetryTopic =
  | "telemetry.flight_state"
  | "telemetry.navigation"
  | "telemetry.display.pfd"
  | "telemetry.display.mfd"
  | "telemetry.engine";

export type CommandTopic =
  | "command.targets"
  | "command.autopilot"
  | "command.radio"
  | "command.audio"
  | "command.transponder"
  | "command.flight_plan"
  | "command.simulator";

export type SystemTopic = "system.status" | "system.alert";

export type WebSocketTopic = TelemetryTopic | CommandTopic | SystemTopic;

export type WebSocketMessageType =
  | "telemetry"
  | "command"
  | "system"
  | "ack"
  | "error"
  | "ping"
  | "pong";

export interface WebSocketEnvelope<TPayload = unknown> {
  version: string;
  messageId: string;
  timestamp: string;
  type: WebSocketMessageType;
  topic?: WebSocketTopic;
  payload?: TPayload;
  status?: string;
  correlationId?: string;
  source?: string;
}

export interface WebSocketStatusPayload {
  status: "connected" | "updated" | "error";
  detail?: string;
}

export interface WebSocketErrorPayload {
  code: string;
  message: string;
  detail?: string;
}

export type WebSocketTelemetryMessage<TPayload = unknown> =
  WebSocketEnvelope<TPayload> & {
    type: "telemetry";
    topic: TelemetryTopic;
  };

export type WebSocketCommandMessage<TPayload = unknown> =
  WebSocketEnvelope<TPayload> & {
    type: "command";
    topic: CommandTopic;
  };

export type WebSocketSystemMessage<TPayload = unknown> =
  WebSocketEnvelope<TPayload> & {
    type: "system";
    topic: SystemTopic;
  };

export const WEBSOCKET_TOPICS = {
  telemetry: {
    flightState: "telemetry.flight_state" as TelemetryTopic,
    navigation: "telemetry.navigation" as TelemetryTopic,
    displayPfd: "telemetry.display.pfd" as TelemetryTopic,
    displayMfd: "telemetry.display.mfd" as TelemetryTopic,
    engine: "telemetry.engine" as TelemetryTopic,
  },
  command: {
    targets: "command.targets" as CommandTopic,
    autopilot: "command.autopilot" as CommandTopic,
    radio: "command.radio" as CommandTopic,
    audio: "command.audio" as CommandTopic,
    transponder: "command.transponder" as CommandTopic,
    flightPlan: "command.flight_plan" as CommandTopic,
    simulator: "command.simulator" as CommandTopic,
  },
  system: {
    status: "system.status" as SystemTopic,
    alert: "system.alert" as SystemTopic,
  },
} as const;
