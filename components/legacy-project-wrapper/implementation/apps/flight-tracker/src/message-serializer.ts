import {
  FlightState,
  PFDUpdate,
  MFDUpdate,
  NAVUpdate,
  SystemStatus,
} from './data-publisher';

export type MessageType =
  | 'FLIGHT_STATE'
  | 'PFD_UPDATE'
  | 'MFD_UPDATE'
  | 'NAV_UPDATE'
  | 'SYSTEM_STATUS';

export interface SerializedMessage {
  type: MessageType;
  timestamp: number;
  payload: unknown;
}

export interface DeserializedMessage<T> {
  type: MessageType;
  timestamp: number;
  payload: T;
}

export class MessageSerializer {
  /**
   * Serialize a message for transmission over WebSocket
   */
  public static serialize<T>(type: MessageType, payload: T): string {
    const message: SerializedMessage = {
      type,
      timestamp: Date.now(),
      payload,
    };
    return JSON.stringify(message);
  }

  /**
   * Deserialize a message received from WebSocket
   */
  public static deserialize<T>(data: string): DeserializedMessage<T> | null {
    try {
      const message = JSON.parse(data) as SerializedMessage;
      return {
        type: message.type as MessageType,
        timestamp: message.timestamp,
        payload: message.payload as T,
      };
    } catch (error) {
      console.error('Failed to deserialize message:', error);
      return null;
    }
  }

  /**
   * Serialize a FLIGHT_STATE message
   */
  public static serializeFlightState(payload: FlightState): string {
    return this.serialize('FLIGHT_STATE', payload);
  }

  /**
   * Serialize a PFD_UPDATE message
   */
  public static serializePFDUpdate(payload: PFDUpdate): string {
    return this.serialize('PFD_UPDATE', payload);
  }

  /**
   * Serialize a MFD_UPDATE message
   */
  public static serializeMFDUpdate(payload: MFDUpdate): string {
    return this.serialize('MFD_UPDATE', payload);
  }

  /**
   * Serialize a NAV_UPDATE message
   */
  public static serializeNAVUpdate(payload: NAVUpdate): string {
    return this.serialize('NAV_UPDATE', payload);
  }

  /**
   * Serialize a SYSTEM_STATUS message
   */
  public static serializeSystemStatus(payload: SystemStatus): string {
    return this.serialize('SYSTEM_STATUS', payload);
  }

  /**
   * Validate message type
   */
  public static isValidMessageType(type: string): type is MessageType {
    return [
      'FLIGHT_STATE',
      'PFD_UPDATE',
      'MFD_UPDATE',
      'NAV_UPDATE',
      'SYSTEM_STATUS',
    ].includes(type);
  }

  /**
   * Get the expected frequency for a message type in Hz
   */
  public static getMessageFrequency(type: MessageType): number {
    switch (type) {
      case 'FLIGHT_STATE':
        return 20; // 20Hz
      case 'PFD_UPDATE':
        return 20; // 20Hz
      case 'MFD_UPDATE':
        return 5; // 5Hz
      case 'NAV_UPDATE':
        return 2; // 2Hz
      case 'SYSTEM_STATUS':
        return 1; // 1Hz
      default:
        return 1;
    }
  }

  /**
   * Get the interval in milliseconds for a message type
   */
  public static getMessageInterval(type: MessageType): number {
    return 1000 / this.getMessageFrequency(type);
  }
}
