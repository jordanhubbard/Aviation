import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Secure key store interface
 */
export interface SecureKeyStoreConfig {
  storePath?: string;
  encryptionKey?: string;
}

export interface SecretEntry {
  service: string;
  key: string;
  value: string;
  createdAt: Date;
  updatedAt: Date;
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

  constructor(config: SecureKeyStoreConfig = {}) {
    this.storePath = config.storePath || path.join(process.cwd(), '.keystore');
    
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
    const entry: SecretEntry = {
      service,
      key,
      value,
      createdAt: this.secrets.get(`${service}:${key}`)?.createdAt || new Date(),
      updatedAt: new Date(),
    };
    
    this.secrets.set(`${service}:${key}`, entry);
    this.saveSecrets();
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
    const deleted = this.secrets.delete(`${service}:${key}`);
    if (deleted) {
      this.saveSecrets();
    }
    return deleted;
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

  /**
   * Load secrets from disk
   */
  private loadSecrets(): void {
    try {
      if (fs.existsSync(this.storePath)) {
        const encrypted = fs.readFileSync(this.storePath, 'utf8');
        const decrypted = this.decrypt(encrypted);
        const data = JSON.parse(decrypted);
        
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
      console.error('Failed to load secrets:', error);
      this.secrets = new Map();
    }
  }

  /**
   * Save secrets to disk
   */
  private saveSecrets(): void {
    try {
      const data = Object.fromEntries(this.secrets.entries());
      const json = JSON.stringify(data);
      const encrypted = this.encrypt(json);
      
      const dir = path.dirname(this.storePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(this.storePath, encrypted, { mode: 0o600 });
    } catch (error) {
      console.error('Failed to save secrets:', error);
      throw error;
    }
  }
}
