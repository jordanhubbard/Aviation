/**
 * Configuration management for aviation accident tracker backend
 */

import { config as dotenvConfig } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
dotenvConfig();

export interface AppConfig {
  port: number;
  env: 'development' | 'production' | 'test';
  databasePath: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  ingestion: {
    windowDays: number;
    rateLimitMs: number;
    maxRetries: number;
  };
}

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value && defaultValue === undefined) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value || defaultValue!;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  return value ? parseInt(value, 10) : defaultValue;
}

export const config: AppConfig = {
  port: getEnvNumber('PORT', 8080),
  env: (getEnv('NODE_ENV', 'development') as AppConfig['env']),
  databasePath: getEnv('DATABASE_PATH', path.join(__dirname, '../../data/events.db')),
  logLevel: (getEnv('LOG_LEVEL', 'info') as AppConfig['logLevel']),
  ingestion: {
    windowDays: getEnvNumber('INGESTION_WINDOW_DAYS', 40),
    rateLimitMs: getEnvNumber('INGESTION_RATE_LIMIT_MS', 1000),
    maxRetries: getEnvNumber('INGESTION_MAX_RETRIES', 3)
  }
};
