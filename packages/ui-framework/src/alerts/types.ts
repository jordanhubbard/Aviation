/**
 * Alert types and interfaces for the aviation alert system
 */

/**
 * Alert severity levels following aviation standards
 * - warning: Immediate action required (red)
 * - caution: Awareness required, potential action needed (amber/yellow)
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
}

/**
 * Alert manager interface for managing the alert stack
 */
export interface IAlertManager {
  /**
   * Add a new alert to the stack
   * @param alert - The alert to add (id and timestamp will be auto-generated if not provided)
   */
  addAlert(alert: Omit<Alert, 'id' | 'timestamp' | 'acknowledged'> & Partial<Pick<Alert, 'id' | 'timestamp'>>): Alert;

  /**
   * Acknowledge an alert (dims it in the display)
   * @param id - The alert ID to acknowledge
   */
  acknowledgeAlert(id: string): void;

  /**
   * Clear/remove an alert from the stack
   * @param id - The alert ID to clear
   */
  clearAlert(id: string): void;

  /**
   * Clear all alerts
   */
  clearAllAlerts(): void;

  /**
   * Get all alerts sorted by priority (highest first) and timestamp
   */
  getAlerts(): Alert[];

  /**
   * Get the top N alerts for display
   * @param count - Number of alerts to return (default: 3)
   */
  getVisibleAlerts(count?: number): Alert[];

  /**
   * Subscribe to alert changes
   * @param callback - Function called when alerts change
   * @returns Unsubscribe function
   */
  subscribe(callback: (alerts: Alert[]) => void): () => void;
}

/**
 * Priority weights for alert levels (higher = more important)
 */
export const ALERT_PRIORITY: Record<AlertLevel, number> = {
  warning: 3,
  caution: 2,
  advisory: 1,
};

/**
 * Maximum number of alerts to display simultaneously
 */
export const MAX_VISIBLE_ALERTS = 3;
