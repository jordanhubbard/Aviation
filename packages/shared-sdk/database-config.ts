/**
 * Database Configuration Module
 * 
 * Provides abstraction layer for SQLite (local persistence) and PostgreSQL (multi-user deployments)
 * Supports environment-based configuration for seamless switching between storage backends
 */

import * as path from 'path';

export type DatabaseType = 'sqlite' | 'postgresql';

export interface DatabaseConfig {
  type: DatabaseType;
  sqlite?: SQLiteConfig;
  postgresql?: PostgreSQLConfig;
}

export interface SQLiteConfig {
  filename: string;
  memory?: boolean;
  verbose?: boolean;
}

export interface PostgreSQLConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  connectionTimeoutMillis?: number;
  idleTimeoutMillis?: number;
  max?: number; // max pool size
}

/**
 * Get database configuration from environment variables
 * 
 * Environment Variables:
 * - DB_TYPE: 'sqlite' or 'postgresql' (default: 'sqlite')
 * - SQLITE_PATH: Path to SQLite database file (default: './data/app.db')
 * - SQLITE_MEMORY: Use in-memory SQLite (default: false)
 * - PG_HOST: PostgreSQL host (default: 'localhost')
 * - PG_PORT: PostgreSQL port (default: 5432)
 * - PG_DATABASE: PostgreSQL database name
 * - PG_USER: PostgreSQL user
 * - PG_PASSWORD: PostgreSQL password
 * - PG_SSL: Use SSL for PostgreSQL (default: false)
 */
export function getDatabaseConfig(): DatabaseConfig {
  const dbType = (process.env.DB_TYPE || 'sqlite') as DatabaseType;

  const config: DatabaseConfig = {
    type: dbType,
  };

  if (dbType === 'sqlite') {
    config.sqlite = {
      filename: process.env.SQLITE_PATH || path.join(process.cwd(), 'data', 'app.db'),
      memory: process.env.SQLITE_MEMORY === 'true',
      verbose: process.env.SQLITE_VERBOSE === 'true',
    };
  } else if (dbType === 'postgresql') {
    config.postgresql = {
      host: process.env.PG_HOST || 'localhost',
      port: parseInt(process.env.PG_PORT || '5432', 10),
      database: process.env.PG_DATABASE || 'aviation',
      user: process.env.PG_USER || 'postgres',
      password: process.env.PG_PASSWORD || '',
      ssl: process.env.PG_SSL === 'true',
      connectionTimeoutMillis: parseInt(process.env.PG_CONNECTION_TIMEOUT || '5000', 10),
      idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT || '30000', 10),
      max: parseInt(process.env.PG_POOL_MAX || '20', 10),
    };
  }

  return config;
}

/**
 * Validate database configuration
 */
export function validateDatabaseConfig(config: DatabaseConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.type) {
    errors.push('Database type is required');
  }

  if (config.type === 'sqlite' && config.sqlite) {
    if (!config.sqlite.filename && !config.sqlite.memory) {
      errors.push('SQLite filename or memory flag is required');
    }
  } else if (config.type === 'postgresql' && config.postgresql) {
    const pg = config.postgresql;
    if (!pg.host) errors.push('PostgreSQL host is required');
    if (!pg.database) errors.push('PostgreSQL database name is required');
    if (!pg.user) errors.push('PostgreSQL user is required');
    if (pg.port < 1 || pg.port > 65535) errors.push('PostgreSQL port must be between 1 and 65535');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get connection string for database
 */
export function getConnectionString(config: DatabaseConfig): string {
  if (config.type === 'sqlite' && config.sqlite) {
    if (config.sqlite.memory) {
      return ':memory:';
    }
    return `sqlite://${config.sqlite.filename}`;
  } else if (config.type === 'postgresql' && config.postgresql) {
    const pg = config.postgresql;
    const protocol = pg.ssl ? 'postgresql+ssl' : 'postgresql';
    return `${protocol}://${pg.user}:${pg.password}@${pg.host}:${pg.port}/${pg.database}`;
  }

  throw new Error('Invalid database configuration');
}
