/**
 * Alert types for the aviation alert message stack
 */

/**
 * Alert severity levels following aviation standards
 * - warning: Immediate action required (red)
 * - caution: Awareness required, possible action needed (amber/yellow)
 * - advisory: Information only (blue/white)
 */
export type AlertLevel = 'warning' | 'caution' | 'advisory';

/**
 * Alert interface representing a single alert message
 */
export interface Alert {
  id: string;
  level: AlertLevel;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  /** Timestamp when the alert was acknowledged */
  acknowledgedAt?: Date;
  /** Optional source system that generated the alert */
  source?: string;
  /** Optional additional details */
  details?: string;
}

/**
 * Options for creating a new alert
 */
export interface CreateAlertOptions {
  level: AlertLevel;
  message: string;
  source?: string;
  details?: string;
}

/**
 * Event types emitted by the alert manager
 */
export type AlertEventType =
  | 'alert_added'
  | 'alert_acknowledged'
  | 'alert_cleared'
  | 'alerts_cleared_all';

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
  type: 'alert_added';
  alert: Alert;
}

/**
 * Event emitted when an alert is acknowledged
 */
export interface AlertAcknowledgedEvent extends AlertEventBase {
  type: 'alert_acknowledged';
  alertId: string;
  alert: Alert;
}

/**
 * Event emitted when a single alert is cleared
 */
export interface AlertClearedEvent extends AlertEventBase {
  type: 'alert_cleared';
  alertId: string;
}

/**
 * Event emitted when all alerts are cleared
 */
export interface AlertsClearedAllEvent extends AlertEventBase {
  type: 'alerts_cleared_all';
  clearedCount: number;
}

/**
 * Union type for all alert events
 */
export type AlertEvent =
  | AlertAddedEvent
  | AlertAcknowledgedEvent
  | AlertClearedEvent
  | AlertsClearedAllEvent;

/**
 * Callback type for alert event subscriptions
 */
export type AlertEventListener = (event: AlertEvent) => void;

/**
 * Alert manager interface for managing the alert stack
 */
export interface IAlertManager {
  /** Add a new alert to the stack */
  addAlert(options: CreateAlertOptions): Alert;
  /** Acknowledge an alert by ID */
  acknowledgeAlert(id: string): boolean;
  /** Acknowledge all unacknowledged alerts */
  acknowledgeAllAlerts(): number;
  /** Clear (remove) an alert by ID */
  clearAlert(id: string): boolean;
  /** Clear all alerts */
  clearAllAlerts(): number;
  /** Clear all acknowledged alerts */
  clearAcknowledgedAlerts(): number;
  /** Get all alerts sorted by priority (highest first) */
  getAlerts(): Alert[];
  /** Get unacknowledged alerts only */
  getUnacknowledgedAlerts(): Alert[];
  /** Get acknowledged alerts only */
  getAcknowledgedAlerts(): Alert[];
  /** Get visible alerts (up to maxVisible, highest priority first) */
  getVisibleAlerts(maxVisible?: number): Alert[];
  /** Get alert by ID */
  getAlert(id: string): Alert | undefined;
  /** Check if there are any unacknowledged alerts */
  hasUnacknowledgedAlerts(): boolean;
  /** Get count of unacknowledged alerts */
  getUnacknowledgedCount(): number;
  /** Subscribe to alert list changes */
  subscribe(callback: AlertSubscriber): () => void;
  /** Subscribe to alert events (for UI layer integration) */
  onEvent(listener: AlertEventListener): () => void;
}

/**
 * Callback type for alert subscriptions
 */
export type AlertSubscriber = (alerts: Alert[]) => void;

/**
 * Priority weights for alert levels (higher = more important)
 */
export const ALERT_PRIORITY: Record<AlertLevel, number> = {
  warning: 3,
  caution: 2,
  advisory: 1,
};

/**
 * Default maximum number of visible alerts
 */
export const DEFAULT_MAX_VISIBLE_ALERTS = 3;
