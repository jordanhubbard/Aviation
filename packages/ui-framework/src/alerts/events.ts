/**
 * Alert events for UI layer communication
 * These events are emitted when alert state changes occur
 */

import { Alert, AlertLevel } from './types';

/**
 * Event types for alert state changes
 */
export type AlertEventType =
  | 'alert:added'
  | 'alert:acknowledged'
  | 'alert:cleared'
  | 'alert:cleared-all'
  | 'alert:state-changed';

/**
 * Base alert event interface
 */
export interface AlertEventBase {
  type: AlertEventType;
  timestamp: Date;
}

/**
 * Event emitted when a new alert is added
 */
export interface AlertAddedEvent extends AlertEventBase {
  type: 'alert:added';
  alert: Alert;
}

/**
 * Event emitted when an alert is acknowledged
 */
export interface AlertAcknowledgedEvent extends AlertEventBase {
  type: 'alert:acknowledged';
  alertId: string;
  alert: Alert;
}

/**
 * Event emitted when a single alert is cleared
 */
export interface AlertClearedEvent extends AlertEventBase {
  type: 'alert:cleared';
  alertId: string;
  /** The alert that was cleared (for reference) */
  alert: Alert;
}

/**
 * Event emitted when all alerts are cleared
 */
export interface AlertClearedAllEvent extends AlertEventBase {
  type: 'alert:cleared-all';
  /** Count of alerts that were cleared */
  count: number;
}

/**
 * Event emitted on any state change (general notification)
 */
export interface AlertStateChangedEvent extends AlertEventBase {
  type: 'alert:state-changed';
  alerts: Alert[];
  /** Counts by acknowledgment status */
  unacknowledgedCount: number;
  acknowledgedCount: number;
  /** Counts by level */
  countByLevel: Record<AlertLevel, number>;
}

/**
 * Union type of all alert events
 */
export type AlertEvent =
  | AlertAddedEvent
  | AlertAcknowledgedEvent
  | AlertClearedEvent
  | AlertClearedAllEvent
  | AlertStateChangedEvent;

/**
 * Event listener callback type
 */
export type AlertEventListener<T extends AlertEvent = AlertEvent> = (event: T) => void;

/**
 * Type-safe event listener map
 */
export type AlertEventListenerMap = {
  'alert:added': AlertEventListener<AlertAddedEvent>;
  'alert:acknowledged': AlertEventListener<AlertAcknowledgedEvent>;
  'alert:cleared': AlertEventListener<AlertClearedEvent>;
  'alert:cleared-all': AlertEventListener<AlertClearedAllEvent>;
  'alert:state-changed': AlertEventListener<AlertStateChangedEvent>;
};

/**
 * Create an alert state summary for state-changed events
 */
export function createAlertStateSummary(alerts: Alert[]): Pick<AlertStateChangedEvent, 'unacknowledgedCount' | 'acknowledgedCount' | 'countByLevel'> {
  const unacknowledgedCount = alerts.filter(a => !a.acknowledged).length;
  const acknowledgedCount = alerts.filter(a => a.acknowledged).length;
  const countByLevel: Record<AlertLevel, number> = {
    warning: 0,
    caution: 0,
    advisory: 0,
  };
  
  for (const alert of alerts) {
    countByLevel[alert.level]++;
  }
  
  return { unacknowledgedCount, acknowledgedCount, countByLevel };
}
