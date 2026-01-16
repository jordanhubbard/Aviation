/**
 * Authentication Middleware for Accident Tracker API
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

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
 * NOTE: Currently simplified - API key validation not fully implemented
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

  // TODO: Implement proper API key validation with database
  // For now, accept any properly formatted key
  (req as any).apiKey = apiKey;
  next();
}

/**
 * Validate an API key (simplified version)
 */
export async function validateApiKey(apiKey: string): Promise<boolean> {
  // TODO: Implement proper database-backed validation
  return apiKey.startsWith('avt_');
}

/**
 * Middleware for admin-only endpoints
 */
export async function adminAuth(req: Request, res: Response, next: NextFunction) {
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
 * API key authentication middleware (alias for backward compatibility)
 */
export const apiKeyAuth = requireApiKey;
