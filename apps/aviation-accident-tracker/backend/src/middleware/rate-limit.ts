/**
 * Rate Limiting Middleware for Accident Tracker API
 */

import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Rate limiter for public API endpoints
 * 100 requests per hour per IP
 */
export const publicRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again later.',
      retryAfter: res.getHeader('Retry-After'),
      limit: 100,
      window: '1 hour',
    });
  },
});

/**
 * Rate limiter for authenticated API endpoints
 * 1000 requests per hour per API key
 */
export const authenticatedRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000,
  message: {
    error: 'Too many requests with this API key, please try again later.',
    retryAfter: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use API key as identifier instead of IP
    return (req as any).apiKey || req.ip || 'unknown';
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests with this API key. Please try again later.',
      retryAfter: res.getHeader('Retry-After'),
      limit: 1000,
      window: '1 hour',
    });
  },
});

/**
 * Strict rate limiter for ingestion endpoint
 * Admin only - 10 requests per minute
 */
export const ingestionRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: {
    error: 'Too many ingestion requests, please try again later.',
    retryAfter: '1 minute',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many ingestion requests. Please wait before retrying.',
      retryAfter: res.getHeader('Retry-After'),
      limit: 10,
      window: '1 minute',
    });
  },
});
