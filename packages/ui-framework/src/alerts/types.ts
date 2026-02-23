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
 * Alert manager interface for managing the alert stack
 */
export interface IAlertManager {
  /** Add a new alert to the stack */
  addAlert(options: CreateAlertOptions): Alert;
  /** Acknowledge an alert by ID */
  acknowledgeAlert(id: string): void;
  /** Clear (remove) an alert by ID */
  clearAlert(id: string): void;
  /** Clear all alerts */
  clearAllAlerts(): void;
  /** Get all alerts sorted by priority (highest first) */
  getAlerts(): Alert[];
  /** Get visible alerts (up to maxVisible, highest priority first) */
  getVisibleAlerts(maxVisible?: number): Alert[];
  /** Subscribe to alert changes */
  subscribe(callback: AlertSubscriber): () => void;
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
