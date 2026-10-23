/**
 * Database Factory
 * 
 * Factory pattern implementation for creating database connections
 * Supports both SQLite and PostgreSQL backends
 */

import { DatabaseConfig, DatabaseType } from './database-config';

export interface IDatabase {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  query(sql: string, params?: any[]): Promise<any>;
  run(sql: string, params?: any[]): Promise<{ lastID?: number; changes?: number }>;
  transaction<T>(callback: () => Promise<T>): Promise<T>;
}

export interface SQLiteDatabase extends IDatabase {
  type: 'sqlite';
  getFilename(): string;
}

export interface PostgreSQLDatabase extends IDatabase {
  type: 'postgresql';
  getPoolSize(): number;
}

/**
 * Create a database instance based on configuration
 */
export async function createDatabase(config: DatabaseConfig): Promise<IDatabase> {
  if (config.type === 'sqlite') {
    const { SQLiteDatabase } = await import('./adapters/sqlite-adapter');
    return new SQLiteDatabase(config.sqlite!);
  } else if (config.type === 'postgresql') {
    const { PostgreSQLDatabase } = await import('./adapters/postgresql-adapter');
    return new PostgreSQLDatabase(config.postgresql!);
  }

  throw new Error(`Unsupported database type: ${config.type}`);
}

/**
 * Database connection pool manager
 */
export class DatabasePool {
  private static instance: DatabasePool;
  private db: IDatabase | null = null;
  private config: DatabaseConfig;

  private constructor(config: DatabaseConfig) {
    this.config = config;
  }

  static getInstance(config: DatabaseConfig): DatabasePool {
    if (!DatabasePool.instance) {
      DatabasePool.instance = new DatabasePool(config);
    }
    return DatabasePool.instance;
  }

  async getConnection(): Promise<IDatabase> {
    if (!this.db) {
      this.db = await createDatabase(this.config);
      await this.db.connect();
    }
    return this.db;
  }

  async closeConnection(): Promise<void> {
    if (this.db) {
      await this.db.disconnect();
      this.db = null;
    }
  }

  isConnected(): boolean {
    return this.db?.isConnected() ?? false;
  }
}
