import * as lockfile from 'proper-lockfile';
import { performance } from 'node:perf_hooks';
import { assertTestDataForRun, parseE2ERunId, tagTestData, type E2ERunId } from '@aviation/shared-sdk/e2e';
import * as crypto from 'crypto';
import fs from 'node:fs';
import * as path from 'path';

/**
 * Secure key store interface
 */
export interface SecureKeyStoreConfig {
  storePath?: string;
  encryptionKey?: string;
  testRunId?: string;
}

export interface SecretEntry {
  service: string;
  key: string;
  value: string;
  createdAt: Date;
  updatedAt: Date;
  readonly is_test_data?: true;
  readonly test_run_id?: string;
}

/**
 * Secure key store for managing API keys and secrets
 * 
 * This provides a secure way for services to store and retrieve API keys
 * that are needed to access external services.
 */
export class SecureKeyStore {
  private storePath: string;
  private encryptionKey: Buffer;
  private secrets: Map<string, SecretEntry>;
  private loadFailed = false;
  private readonly testRunId?: E2ERunId;

  constructor(config: SecureKeyStoreConfig = {}) {
    this.storePath = config.storePath || path.join(process.cwd(), '.keystore');
    this.testRunId = config.testRunId === undefined ? undefined : parseE2ERunId(config.testRunId);
    
    // In production, this should come from a secure source like environment variables
    // or a hardware security module (HSM)
    const key = config.encryptionKey || process.env.KEYSTORE_ENCRYPTION_KEY || 'default-key-change-in-production';
    
    // Use a unique salt per installation for better security
    // In production, consider storing this salt separately or deriving from system ID
    const salt = crypto.createHash('sha256').update(this.storePath).digest();
    this.encryptionKey = crypto.scryptSync(key, salt, 32);
    
    this.secrets = new Map();
    this.loadSecrets();
  }

  /**
   * Store a secret for a service
   */
  setSecret(service: string, key: string, value: string): void {
    this.withWriteLock(() => {
      const entry: SecretEntry = {
        service, key, value,
        createdAt: this.secrets.get(`${service}:${key}`)?.createdAt || new Date(),
        updatedAt: new Date(),
      };
      this.secrets.set(`${service}:${key}`, this.testRunId ? tagTestData(this.testRunId, entry) : entry);
    });
  }

  /**
   * Retrieve a secret for a service
   */
  getSecret(service: string, key: string): string | undefined {
    const entry = this.secrets.get(`${service}:${key}`);
    return entry?.value;
  }

  /**
   * Delete a secret for a service
   */
  deleteSecret(service: string, key: string): boolean {
    this.assertReadable();
    if (!fs.existsSync(this.storePath)) { this.secrets = new Map(); return false; }
    return this.withWriteLock(() => this.secrets.delete(`${service}:${key}`), changed => changed);
  }

  /**
   * List all keys for a service
   */
  listKeys(service: string): string[] {
    const keys: string[] = [];
    for (const [key, entry] of this.secrets.entries()) {
      if (entry.service === service) {
        keys.push(entry.key);
      }
    }
    return keys;
  }

  /**
   * Encrypt data
   */
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt data
   */
  private decrypt(text: string): string {
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private withWriteLock<T>(mutate: () => T, changed: (result: T) => boolean = () => true): T {
    this.assertReadable();
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true, mode: 0o700 });
    const started = performance.now();
    let release: (() => void) | undefined;
    while (!release) {
      try { release = lockfile.lockSync(this.storePath, { realpath: false, stale: 60_000 }); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ELOCKED' || performance.now() - started >= 5000) {
          throw new Error('Keystore write lock unavailable');
        }
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
      }
    }
    let previous: Map<string, SecretEntry> | undefined;
    try {
      this.loadSecrets();
      this.assertReadable();
      previous = new Map(this.secrets);
      const result = mutate();
      if (changed(result)) this.saveSecrets();
      return result;
    } catch (error) {
      if (previous) this.secrets = previous;
      throw error;
    } finally { release(); }
  }

  /** Reject writes and machine reads after an unsuccessful load. */
  assertReadable(): void {
    if (this.loadFailed) throw new Error('Keystore could not be loaded');
  }

  /** Ownership metadata only; secret values are deliberately absent. */
  listEntries(): Array<Omit<SecretEntry, 'value'>> {
    this.assertReadable();
    return [...this.secrets.values()].map(entry => ({
      service: entry.service, key: entry.key,
      createdAt: new Date(entry.createdAt), updatedAt: new Date(entry.updatedAt),
      ...(entry.is_test_data === true ? { is_test_data: true as const, test_run_id: entry.test_run_id } : {}),
    }));
  }

  /**
   * Load secrets from disk
   */
  private loadSecrets(): void {
    this.secrets = new Map();
    try {
      if (fs.existsSync(this.storePath)) {
        const encrypted = fs.readFileSync(this.storePath, 'utf8');
        const decrypted = this.decrypt(encrypted);
        const data = JSON.parse(decrypted);
        if (this.testRunId) {
          for (const entry of Object.values(data)) assertTestDataForRun(entry, this.testRunId);
        } else if (Object.values(data).some(entry => typeof entry === 'object' && entry !== null
          && ('is_test_data' in entry || 'test_run_id' in entry))) {
          throw new Error('Test entries require an explicit run identity');
        }
        
        this.secrets = new Map(
          Object.entries(data).map(([key, value]: [string, any]) => [
            key,
            {
              ...value,
              createdAt: new Date(value.createdAt),
              updatedAt: new Date(value.updatedAt),
            },
          ])
        );
      }
    } catch (error) {
      console.error('Failed to load secrets');
      this.loadFailed = true;
      this.secrets = new Map();
    }
  }

  /**
   * Save secrets to disk
   */
  private saveSecrets(): void {
    this.assertReadable();
    try {
      const data = Object.fromEntries(this.secrets.entries());
      const json = JSON.stringify(data);
      const encrypted = this.encrypt(json);
      
      const dir = path.dirname(this.storePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      const temporary = path.join(dir, `.${path.basename(this.storePath)}.${crypto.randomUUID()}.tmp`);
      try {
        fs.writeFileSync(temporary, encrypted, { mode: 0o600, flag: 'wx' });
        fs.renameSync(temporary, this.storePath);
      } finally { fs.rmSync(temporary, { force: true }); }
    } catch (error) {
      console.error('Failed to save secrets:', error);
      throw error;
    }
  }
}
