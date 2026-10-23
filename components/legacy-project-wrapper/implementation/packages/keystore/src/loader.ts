/**
 * Secret Loader Utility
 * 
 * Provides a simple interface for applications to load secrets from the keystore
 * with fallback to environment variables for backward compatibility.
 */

import * as path from 'path';
import { SecureKeyStore } from './keystore';

export interface LoaderConfig {
  serviceName: string;
  keystorePath?: string;
  fallbackToEnv?: boolean;
}

/**
 * Secret loader that tries keystore first, then falls back to environment variables
 */
export class SecretLoader {
  private keystore: SecureKeyStore;
  private serviceName: string;
  private fallbackToEnv: boolean;
  
  constructor(config: LoaderConfig) {
    this.serviceName = config.serviceName;
    this.fallbackToEnv = config.fallbackToEnv !== false; // default true
    
    const keystorePath = config.keystorePath || 
      path.join(process.cwd(), '..', '..', '.keystore');
    
    this.keystore = new SecureKeyStore({
      storePath: keystorePath,
    });
  }
  
  /**
   * Get a secret value, with optional fallback to environment variables
   */
  get(key: string): string | undefined {
    // Try keystore first
    const value = this.keystore.getSecret(this.serviceName, key);
    
    if (value !== undefined) {
      return value;
    }
    
    // Fall back to environment variables if enabled
    if (this.fallbackToEnv) {
      return process.env[key];
    }
    
    return undefined;
  }
  
  /**
   * Get a secret value or throw an error if not found
   */
  getRequired(key: string): string {
    const value = this.get(key);
    
    if (value === undefined) {
      throw new Error(
        `Required secret not found: ${this.serviceName}:${key}. ` +
        `Make sure to run 'npm run secrets:migrate' or set the ${key} environment variable.`
      );
    }
    
    return value;
  }
  
  /**
   * Get a secret with a default value
   */
  getWithDefault(key: string, defaultValue: string): string {
    return this.get(key) || defaultValue;
  }
  
  /**
   * Check if a secret exists
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }
  
  /**
   * Get all keys for this service
   */
  listKeys(): string[] {
    return this.keystore.listKeys(this.serviceName);
  }
}

/**
 * Create a secret loader for a service
 */
export function createSecretLoader(serviceName: string, config?: Partial<LoaderConfig>): SecretLoader {
  return new SecretLoader({
    serviceName,
    ...config,
  });
}

