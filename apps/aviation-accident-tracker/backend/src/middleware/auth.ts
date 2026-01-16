/**
 * Authentication Middleware for Accident Tracker API
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
// import { db } from '../db'; // TODO: Implement proper DB connection

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
    // TODO: Implement proper API key validation
    // For now, accept any API key for development
    (req as any).apiKey = apiKey;
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
  // TODO: Implement proper API keys table initialization
  console.log('API keys table initialization skipped (not implemented)');
}
