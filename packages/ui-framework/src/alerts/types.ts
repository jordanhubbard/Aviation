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
  | 'alert:added'
  | 'alert:acknowledged'
  | 'alert:cleared'
  | 'alert:cleared-all'
  | 'alerts:changed';

/**
 * Alert event payload for event emissions
 */
export interface AlertEvent {
  type: AlertEventType;
  alert?: Alert;
  alerts: Alert[];
  timestamp: Date;
}

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
  /** Subscribe to alert changes */
  subscribe(callback: AlertSubscriber): () => void;
  /** Subscribe to specific alert events */
  on(eventType: AlertEventType, callback: AlertEventCallback): () => void;
  /** Get count of unacknowledged alerts */
  getUnacknowledgedCount(): number;
  /** Check if there are any unacknowledged alerts */
  hasUnacknowledgedAlerts(): boolean;
}

/**
 * Callback type for alert subscriptions
 */
export type AlertSubscriber = (alerts: Alert[]) => void;

/**
 * Callback type for alert event subscriptions
 */
export type AlertEventCallback = (event: AlertEvent) => void;

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
