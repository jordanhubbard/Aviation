/**
 * Alert Manager implementation for managing the alert message stack
 */

import {
  Alert,
  AlertLevel,
  AlertSubscriber,
  CreateAlertOptions,
  IAlertManager,
  ALERT_PRIORITY,
  DEFAULT_MAX_VISIBLE_ALERTS,
} from './types';

/**
 * Generate a unique ID for alerts
 */
function generateAlertId(): string {
  return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Sort alerts by priority (highest first), then by timestamp (newest first for same priority)
 */
function sortAlerts(alerts: Alert[]): Alert[] {
  return [...alerts].sort((a, b) => {
    const priorityDiff = ALERT_PRIORITY[b.level] - ALERT_PRIORITY[a.level];
    if (priorityDiff !== 0) return priorityDiff;
    return b.timestamp.getTime() - a.timestamp.getTime();
  });
}

/**
 * AlertManager class implementing the IAlertManager interface
 * Manages a stack of alerts with priority sorting and subscription support
 */
export class AlertManager implements IAlertManager {
  private alerts: Map<string, Alert> = new Map();
  private subscribers: Set<AlertSubscriber> = new Set();
  private auralCallback?: (level: AlertLevel) => void;

  /**
   * Create a new AlertManager
   * @param auralCallback Optional callback to play aural alerts when new alerts are added
   */
  constructor(auralCallback?: (level: AlertLevel) => void) {
    this.auralCallback = auralCallback;
  }

  /**
   * Add a new alert to the stack
   */
  addAlert(options: CreateAlertOptions): Alert {
    const alert: Alert = {
      id: generateAlertId(),
      level: options.level,
      message: options.message,
      timestamp: new Date(),
      acknowledged: false,
      source: options.source,
      details: options.details,
    };

    this.alerts.set(alert.id, alert);
    
    // Play aural alert if callback is configured
    if (this.auralCallback) {
      this.auralCallback(alert.level);
    }

    this.notifySubscribers();
    return alert;
  }

  /**
   * Acknowledge an alert by ID
   */
  acknowledgeAlert(id: string): void {
    const alert = this.alerts.get(id);
    if (alert) {
      alert.acknowledged = true;
      this.notifySubscribers();
    }
  }

  /**
   * Clear (remove) an alert by ID
   */
  clearAlert(id: string): void {
    if (this.alerts.delete(id)) {
      this.notifySubscribers();
    }
  }

  /**
   * Clear all alerts
   */
  clearAllAlerts(): void {
    this.alerts.clear();
    this.notifySubscribers();
  }

  /**
   * Get all alerts sorted by priority (highest first)
   */
  getAlerts(): Alert[] {
    return sortAlerts(Array.from(this.alerts.values()));
  }

  /**
   * Get visible alerts (up to maxVisible, highest priority first)
   * Acknowledged alerts are included but will be rendered dimmed by the UI
   */
  getVisibleAlerts(maxVisible: number = DEFAULT_MAX_VISIBLE_ALERTS): Alert[] {
    return this.getAlerts().slice(0, maxVisible);
  }

  /**
   * Subscribe to alert changes
   * @returns Unsubscribe function
   */
  subscribe(callback: AlertSubscriber): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Set the aural callback for playing alert sounds
   */
  setAuralCallback(callback: (level: AlertLevel) => void): void {
    this.auralCallback = callback;
  }

  /**
   * Notify all subscribers of alert changes
   */
  private notifySubscribers(): void {
    const alerts = this.getAlerts();
    this.subscribers.forEach((callback) => callback(alerts));
  }
}

/**
 * Create a singleton alert manager instance
 */
let defaultManager: AlertManager | null = null;

/**
 * Get the default alert manager instance (singleton)
 */
export function getAlertManager(): AlertManager {
  if (!defaultManager) {
    defaultManager = new AlertManager();
  }
  return defaultManager;
}

/**
 * Reset the default alert manager (useful for testing)
 */
export function resetAlertManager(): void {
  defaultManager = null;
}
