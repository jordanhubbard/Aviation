/**
 * Base Service interface for background services
 */
import {
  transitionServiceLifecycle,
  type ServiceLifecycleState,
} from './aviation/service-lifecycle.js';

export interface ServiceConfig {
  name: string;
  port?: number;
  enabled: boolean;
  autoStart?: boolean;
}

export interface ServiceStatus {
  name: string;
  status: ServiceLifecycleState;
  uptime?: number;
  lastError?: string;
}

/** Stable adapter error for invalid background-service control requests. */
export class BackgroundServiceError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'BackgroundServiceError';
  }
}

/**
 * Abstract base class for background services
 */
export abstract class BackgroundService {
  protected config: ServiceConfig;
  protected startTime?: Date;
  private lifecycleState: ServiceLifecycleState = 'stopped';
  private lastError?: string;

  constructor(config: ServiceConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    if (!this.config.enabled) {
      throw new BackgroundServiceError(
        'service-disabled',
        `Service ${this.config.name} is disabled`,
      );
    }
    this.lifecycleState = transitionServiceLifecycle(this.lifecycleState, 'start_requested');
    this.lastError = undefined;
    console.log(`Starting service: ${this.config.name}`);
    try {
      await this.onStart();
    } catch (error) {
      this.lifecycleState = transitionServiceLifecycle(this.lifecycleState, 'start_failed');
      this.lastError = error instanceof Error ? error.message : String(error);
      throw error;
    }
    this.lifecycleState = transitionServiceLifecycle(this.lifecycleState, 'start_succeeded');
    this.startTime = new Date();
    console.log(`Service ${this.config.name} started successfully`);
  }

  async stop(): Promise<void> {
    this.lifecycleState = transitionServiceLifecycle(this.lifecycleState, 'stop_requested');
    this.lastError = undefined;
    console.log(`Stopping service: ${this.config.name}`);
    try {
      await this.onStop();
    } catch (error) {
      this.lifecycleState = transitionServiceLifecycle(this.lifecycleState, 'stop_failed');
      this.lastError = error instanceof Error ? error.message : String(error);
      throw error;
    }
    this.lifecycleState = transitionServiceLifecycle(this.lifecycleState, 'stop_succeeded');
    this.startTime = undefined;
    console.log(`Service ${this.config.name} stopped successfully`);
  }

  reset(): void {
    this.lifecycleState = transitionServiceLifecycle(this.lifecycleState, 'reset');
    this.startTime = undefined;
    this.lastError = undefined;
  }

  getStatus(): ServiceStatus {
    return {
      name: this.config.name,
      status: this.lifecycleState,
      ...(this.startTime ? { uptime: Date.now() - this.startTime.getTime() } : {}),
      ...(this.lastError === undefined ? {} : { lastError: this.lastError }),
    };
  }

  protected abstract onStart(): Promise<void>;
  protected abstract onStop(): Promise<void>;
}
