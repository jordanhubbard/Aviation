/**
 * Authentication Middleware for Accident Tracker API
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from '../db';

export interface ApiKey {
  id: number;
  key: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
  rate_limit: number;
  requests_count: number;
}

/**
 * Generate a secure API key
 */
export function generateApiKey(): string {
  return `avt_${crypto.randomBytes(32).toString('hex')}`;
}

/**
 * Middleware to require API key authentication
 */
export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key is required. Provide it in the X-API-Key header.',
    });
  }

  if (!apiKey.startsWith('avt_')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key format.',
    });
  }

  try {
    // Validate API key
    const key = await db
      .prepare('SELECT * FROM api_keys WHERE key = ? AND is_active = 1')
      .get(apiKey) as ApiKey | undefined;

    if (!key) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or inactive API key.',
      });
    }

    // Update last used timestamp and increment request count
    await db
      .prepare('UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP, requests_count = requests_count + 1 WHERE id = ?')
      .run(key.id);

    // Attach API key info to request
    (req as any).apiKey = key.key;
    (req as any).apiKeyInfo = key;

    next();
  } catch (error) {
    console.error('API key validation error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to validate API key.',
    });
  }
}

/**
 * Middleware for admin-only endpoints
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.headers['authorization']?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Admin authentication required.',
    });
  }

  // Simple token-based admin auth (should use proper JWT in production)
  const adminToken = process.env.ADMIN_TOKEN || 'admin-secret-token';

  if (token !== adminToken) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required.',
    });
  }

  next();
}

/**
 * Initialize API keys table
 */
export async function initApiKeysTable() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_used_at TEXT,
      is_active INTEGER DEFAULT 1,
      rate_limit INTEGER DEFAULT 1000,
      requests_count INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key);
    CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);
  `);
}
