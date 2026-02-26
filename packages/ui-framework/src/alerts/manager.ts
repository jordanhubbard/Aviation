/**
 * Alert Manager implementation for managing the alert message stack
 */

import {
  Alert,
  AlertLevel,
  AlertSubscriber,
  CreateAlertOptions,
  IAlertManager,
  AlertEvent,
  AlertEventCallback,
  ALERT_PRIORITY,
  DEFAULT_MAX_VISIBLE_ALERTS,
} from './types';
import { AlertEventEmitter } from './event-emitter';
import { AlertPersistence } from './persistence';

  /**
   * Create a new AlertManager
   * @param auralCallback Optional callback to play aural alerts when new alerts are added
   * @param persistenceEnabled Whether to enable persistence of alerts to local storage
   */
  constructor(auralCallback?: (level: AlertLevel) => void, persistenceEnabled: boolean = false) {
    this.auralCallback = auralCallback;
    this.persistenceEnabled = persistenceEnabled;
    // Load persisted alerts if persistence is enabled
    if (this.persistenceEnabled) {
      const persisted = AlertPersistence.loadAlerts();
      persisted.forEach((alert) => {
        this.alerts.set(alert.id, alert);
      });
    }
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
  private eventEmitter: AlertEventEmitter = new AlertEventEmitter();
  private auralCallback?: (level: AlertLevel) => void;
  private persistenceEnabled: boolean = false;

  /**
   * Create a new AlertManager
   * @param auralCallback Optional callback to play aural alerts when new alerts are added
   * @param enablePersistence Whether to persist alerts to local storage
   */
  constructor(auralCallback?: (level: AlertLevel) => void, enablePersistence: boolean = false) {
    this.auralCallback = auralCallback;
    this.persistenceEnabled = enablePersistence;
    
    // Load persisted alerts if persistence is enabled
    if (this.persistenceEnabled) {
      const persistedAlerts = AlertPersistence.loadAlerts();
      persistedAlerts.forEach((alert) => {
        this.alerts.set(alert.id, alert);
      });
    }
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
  acknowledgeAlert(id: string): boolean {
    const alert = this.alerts.get(id);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = new Date();
      this.notifySubscribers();
      return true;
    }
    return false;
  }

  /**
   * Acknowledge all unacknowledged alerts
   */
  acknowledgeAllAlerts(): number {
    let count = 0;
    const now = new Date();
    this.alerts.forEach((alert) => {
      if (!alert.acknowledged) {
        alert.acknowledged = true;
        alert.acknowledgedAt = now;
        count++;
      }
    });
    if (count > 0) {
      this.notifySubscribers();
    }
    return count;
  }

  /**
   * Clear (remove) an alert by ID
   */
  clearAlert(id: string): boolean {
    if (this.alerts.delete(id)) {
      this.notifySubscribers();
      return true;
    }
    return false;
  }

  /**
   * Clear all alerts
   */
  clearAllAlerts(): number {
    const count = this.alerts.size;
    this.alerts.clear();
    if (count > 0) {
      this.notifySubscribers();
    }
    return count;
  }

  /**
   * Clear all acknowledged alerts only
   */
  clearAcknowledgedAlerts(): number {
    let count = 0;
    const idsToDelete: string[] = [];
    this.alerts.forEach((alert, id) => {
      if (alert.acknowledged) {
        idsToDelete.push(id);
        count++;
      }
    });
    idsToDelete.forEach((id) => this.alerts.delete(id));
    if (count > 0) {
      this.notifySubscribers();
    }
    return count;
  }

  /**
   * Get unacknowledged alerts only
   */
  getUnacknowledgedAlerts(): Alert[] {
    return this.getAlerts().filter((alert) => !alert.acknowledged);
  }

  /**
   * Get acknowledged alerts only
   */
  getAcknowledgedAlerts(): Alert[] {
    return this.getAlerts().filter((alert) => alert.acknowledged);
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
