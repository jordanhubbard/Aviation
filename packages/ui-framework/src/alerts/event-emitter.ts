/**
 * Event emitter for alert events
 * Provides a pub/sub mechanism for alert state changes
 */

import { AlertEvent, AlertEventCallback } from './types';

/**
 * Simple event emitter for alert events
 */
export class AlertEventEmitter {
  private listeners: Set<AlertEventCallback> = new Set();

  /**
   * Subscribe to alert events
   * @param callback Function to call when an event is emitted
   * @returns Unsubscribe function
   */
  on(callback: AlertEventCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Emit an alert event to all listeners
   */
  emit(event: AlertEvent): void {
    this.listeners.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in alert event listener:', error);
      }
    });
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(): void {
    this.listeners.clear();
  }

  /**
   * Get the number of listeners
   */
  listenerCount(): number {
    return this.listeners.size;
  }
}
