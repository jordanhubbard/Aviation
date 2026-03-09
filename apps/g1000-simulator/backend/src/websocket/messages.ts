// WebSocket Protocol Definitions

// Message Types
export enum MessageType {
  FLIGHT_STATE_UPDATE = 'flight_state_update',
  DISPLAY_UPDATE = 'display_update',
  NAVIGATION_UPDATE = 'navigation_update',
  SYSTEM_STATUS = 'system_status',
  ALERT = 'alert',
  COMMAND = 'command',
}

// Message Interfaces
interface BaseMessage {
  type: MessageType;
}

export interface FlightStateUpdateMessage extends BaseMessage {
  type: MessageType.FLIGHT_STATE_UPDATE;
  payload: {
    position: {
      latitude_deg: number;
      longitude_deg: number;
      altitude_ft: number;
    };
    attitude: {
      heading_deg: number;
      pitch_deg: number;
      roll_deg: number;
    };
    velocity: {
      airspeed_kt: number;
      vertical_speed_fpm: number;
    };
    updated_at: string;
  };
}

export interface DisplayUpdateMessage extends BaseMessage {
  type: MessageType.DISPLAY_UPDATE;
  payload: {
    pfd: string; // Example: SVG or JSON representation
    mfd: string; // Example: SVG or JSON representation
  };
}

export interface NavigationUpdateMessage extends BaseMessage {
  type: MessageType.NAVIGATION_UPDATE;
  payload: {
    waypoints: Array<{ lat: number; lon: number; name: string }>;
    active_waypoint: number;
  };
}

export interface SystemStatusMessage extends BaseMessage {
  type: MessageType.SYSTEM_STATUS;
  payload: {
    cpu_usage: number;
    memory_usage: number;
    uptime: number;
  };
}

export interface AlertMessage extends BaseMessage {
  type: MessageType.ALERT;
  payload: {
    level: 'info' | 'warning' | 'error';
    message: string;
  };
}

export interface CommandMessage extends BaseMessage {
  type: MessageType.COMMAND;
  payload: {
    command: string;
    args: Record<string, any>;
  };
}

// Type Guard Functions
export function isFlightStateUpdateMessage(message: any): message is FlightStateUpdateMessage {
  return message.type === MessageType.FLIGHT_STATE_UPDATE;
}

export function isDisplayUpdateMessage(message: any): message is DisplayUpdateMessage {
  return message.type === MessageType.DISPLAY_UPDATE;
}

export function isNavigationUpdateMessage(message: any): message is NavigationUpdateMessage {
  return message.type === MessageType.NAVIGATION_UPDATE;
}

export function isSystemStatusMessage(message: any): message is SystemStatusMessage {
  return message.type === MessageType.SYSTEM_STATUS;
}

export function isAlertMessage(message: any): message is AlertMessage {
  return message.type === MessageType.ALERT;
}

export function isCommandMessage(message: any): message is CommandMessage {
  return message.type === MessageType.COMMAND;
}
