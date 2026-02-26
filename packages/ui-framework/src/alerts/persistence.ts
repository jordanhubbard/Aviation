/**
 * Alert persistence layer for storing and retrieving alerts from local storage
 */

import { Alert, AlertLevel } from './types';

/**
 * Storage key for persisted alerts
 */
const ALERTS_STORAGE_KEY = 'aviation-alerts';

/**
 * Serializable alert format for storage
 */
interface SerializedAlert {
  id: string;
  level: AlertLevel;
  message: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
  source?: string;
  details?: string;
}

/**
 * Alert persistence manager
 * Handles saving and loading alerts from local storage
 */
export class AlertPersistence {
  /**
   * Save alerts to local storage
   */
  static saveAlerts(alerts: Alert[]): void {
    try {
      const serialized: SerializedAlert[] = alerts.map((alert) => ({
        id: alert.id,
        level: alert.level,
        message: alert.message,
        timestamp: alert.timestamp.toISOString(),
        acknowledged: alert.acknowledged,
        acknowledgedAt: alert.acknowledgedAt?.toISOString(),
        source: alert.source,
        details: alert.details,
      }));
      localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(serialized));
    } catch (error) {
      console.error('Failed to save alerts to local storage:', error);
    }
  }

  /**
   * Load alerts from local storage
   */
  static loadAlerts(): Alert[] {
    try {
      const stored = localStorage.getItem(ALERTS_STORAGE_KEY);
      if (!stored) {
        return [];
      }
      const serialized: SerializedAlert[] = JSON.parse(stored);
      return serialized.map((alert) => ({
        id: alert.id,
        level: alert.level,
        message: alert.message,
        timestamp: new Date(alert.timestamp),
        acknowledged: alert.acknowledged,
        acknowledgedAt: alert.acknowledgedAt ? new Date(alert.acknowledgedAt) : undefined,
        source: alert.source,
        details: alert.details,
      }));
    } catch (error) {
      console.error('Failed to load alerts from local storage:', error);
      return [];
    }
  }

  /**
   * Clear all persisted alerts
   */
  static clearAlerts(): void {
    try {
      localStorage.removeItem(ALERTS_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear alerts from local storage:', error);
    }
  }
}
