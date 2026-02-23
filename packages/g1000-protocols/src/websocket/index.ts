export {
  WEBSOCKET_PROTOCOL_VERSION,
  WEBSOCKET_TOPICS,
} from "./schema";
export type {
  CommandTopic,
  SystemTopic,
  TelemetryTopic,
  WebSocketChannel,
  WebSocketCommandMessage,
  WebSocketEnvelope,
  WebSocketErrorPayload,
  WebSocketMessageType,
  WebSocketStatusPayload,
  WebSocketSystemMessage,
  WebSocketTelemetryMessage,
  WebSocketTopic,
} from "./schema";
export {
  isTelemetrySnapshot,
  isTelemetryUpdate,
} from "./telemetry";
export type {
  AutopilotLateralMode,
  AutopilotVerticalMode,
  TelemetryAdc,
  TelemetryAdf,
  TelemetryAudioPanel,
  TelemetryAttitude,
  TelemetryAutopilot,
  TelemetryDme,
  TelemetryGps,
  TelemetryMetadata,
  TelemetryPayload,
  TelemetryPosition,
  TelemetrySnapshot,
  TelemetryTargets,
  TelemetryTransponder,
  TelemetryUpdate,
  TelemetryVelocity,
  TransponderMode,
} from "./telemetry";
export { isCommandPayload } from "./commands";

// New WebSocket client implementation
export class WebSocketClient {
  constructor(url: string) {
    // Initialize WebSocket connection
  }

  sendMessage(message: WebSocketCommandMessage) {
    // Serialize and send message
  }

  onMessage(callback: (message: WebSocketTelemetryMessage) => void) {
    // Handle incoming messages
  }

  close() {
    // Close WebSocket connection
  }
}
export type {
  CommandMessage,
  CommandName,
  CommandPayload,
  CommandPayloadBase,
  ResetCommandPayload,
  SetAdfCommandPayload,
  SetAudioPanelCommandPayload,
  SetAutopilotCommandPayload,
  SetDmeCommandPayload,
  SetTargetsCommandPayload,
  SetTransponderCommandPayload,
} from "./commands";
