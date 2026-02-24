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
  | 'all_alerts_cleared'
  | 'all_acknowledged';

/**
 * Event payload for alert events
 */
export interface AlertEvent {
  type: AlertEventType;
  timestamp: Date;
  /** The alert involved (not present for clearAll events) */
  alert?: Alert;
  /** All current alerts after the event */
  alerts: Alert[];
}

/**
 * Callback type for alert event subscriptions
 */
export type AlertEventSubscriber = (event: AlertEvent) => void;

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
  /** Get only unacknowledged alerts */
  getUnacknowledgedAlerts(): Alert[];
  /** Get only acknowledged alerts */
  getAcknowledgedAlerts(): Alert[];
  /** Get visible alerts (up to maxVisible, highest priority first) */
  getVisibleAlerts(maxVisible?: number): Alert[];
  /** Get the count of unacknowledged alerts */
  getUnacknowledgedCount(): number;
  /** Check if there are any unacknowledged alerts */
  hasUnacknowledgedAlerts(): boolean;
  /** Subscribe to alert changes (legacy) */
  subscribe(callback: AlertSubscriber): () => void;
  /** Subscribe to alert events with detailed event info */
  subscribeToEvents(callback: AlertEventSubscriber): () => void;
}

/**
 * Callback type for alert subscriptions (legacy)
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
