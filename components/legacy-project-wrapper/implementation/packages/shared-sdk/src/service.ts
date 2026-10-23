/**
 * Base Service interface for background services
 */
export interface ServiceConfig {
  name: string;
  port?: number;
  enabled: boolean;
  autoStart?: boolean;
}

export interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'error';
  uptime?: number;
  lastError?: string;
}

/**
 * Abstract base class for background services
 */
export abstract class BackgroundService {
  protected config: ServiceConfig;
  protected isRunning: boolean = false;
  protected startTime?: Date;

  constructor(config: ServiceConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error(`Service ${this.config.name} is already running`);
    }
    
    console.log(`Starting service: ${this.config.name}`);
    await this.onStart();
    this.isRunning = true;
    this.startTime = new Date();
    console.log(`Service ${this.config.name} started successfully`);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      throw new Error(`Service ${this.config.name} is not running`);
    }
    
    console.log(`Stopping service: ${this.config.name}`);
    await this.onStop();
    this.isRunning = false;
    console.log(`Service ${this.config.name} stopped successfully`);
  }

  getStatus(): ServiceStatus {
    return {
      name: this.config.name,
      status: this.isRunning ? 'running' : 'stopped',
      uptime: this.startTime ? Date.now() - this.startTime.getTime() : undefined,
    };
  }

  protected abstract onStart(): Promise<void>;
  protected abstract onStop(): Promise<void>;
}
