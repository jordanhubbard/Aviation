/**
 * Structured logging for aviation accident tracker
 */

import { config } from './config';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

const LEVEL_MAP = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR
};

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  service: string;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private serviceName = 'accident-tracker';
  private minLevel: LogLevel;

  constructor() {
    this.minLevel = LEVEL_MAP[config.logLevel];
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.minLevel;
  }

  private log(level: LogLevel, levelName: string, message: string, metadata?: Record<string, any>, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: levelName,
      message,
      service: this.serviceName,
      metadata
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }

    const output = JSON.stringify(entry);
    
    if (level >= LogLevel.ERROR) {
      console.error(output);
    } else if (level >= LogLevel.WARN) {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  debug(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, 'debug', message, metadata);
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.INFO, 'info', message, metadata);
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, 'warn', message, metadata);
  }

  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    this.log(LogLevel.ERROR, 'error', message, metadata, error);
  }
}

export const logger = new Logger();
