/**
 * rateLimiter.ts — sliding-window IP-based rate limiter middleware.
 *
 * Uses an in-process Map keyed by IP (or custom key) with a sliding window
 * algorithm: each request stores a timestamp; stale entries older than
 * `windowMs` are pruned on every check.
 *
 * Headers added to every response:
 *   X-RateLimit-Limit     — max requests per window
 *   X-RateLimit-Remaining — requests remaining this window
 *   X-RateLimit-Reset     — Unix timestamp (seconds) when the window resets
 *
 * When the limit is exceeded:
 *   HTTP 429 Too Many Requests
 *   Retry-After: <seconds until oldest request ages out>
 *   Content-Type: application/json
 *   { error: "Too many requests", retryAfter: <n> }
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';

export interface RateLimiterOptions {
  /** Maximum requests allowed in the window (default: 100) */
  max?: number;
  /** Window duration in milliseconds (default: 60_000 = 1 min) */
  windowMs?: number;
  /** HTTP status code for rate-limited responses (default: 429) */
  statusCode?: number;
  /**
   * Function that returns the rate-limit key for a request.
   * Default: req.ip (supports X-Forwarded-For when trust proxy is set).
   */
  keyGenerator?: (req: Request) => string;
  /**
   * IPs (or key values) that are never rate-limited.
   * Useful for internal health-check IPs or trusted CI addresses.
   */
  whitelist?: string[];
  /**
   * Routes that skip rate limiting (matched by req.path prefix).
   * Default: ['/health', '/metrics']
   */
  skip?: string[];
  /**
   * Custom message object for 429 responses.
   * Default: { error: 'Too many requests', retryAfter: <n> }
   */
  message?: object | ((retryAfter: number) => object);
  /** Optional logger (default: no logging) */
  onLimitReached?: (req: Request, key: string) => void;
}

/** Internal per-key record */
interface WindowRecord {
  timestamps: number[];  // sorted ascending array of request timestamps (ms)
}

/** Rate limiter instance returned by createRateLimiter */
export interface RateLimiter {
  /** Express middleware */
  middleware: RequestHandler;
  /** Current in-flight store (for testing / inspection) */
  store: Map<string, WindowRecord>;
  /** Reset the count for a specific key */
  reset(key: string): void;
  /** Reset all keys */
  resetAll(): void;
}

const DEFAULT_SKIP_PATHS = ['/health', '/metrics', '/ready', '/live'];

/**
 * Creates a new rate limiter middleware instance with the given options.
 *
 * Usage:
 *   const limiter = createRateLimiter({ max: 100, windowMs: 60_000 });
 *   app.use(limiter.middleware);
 *
 *   // Or per-route:
 *   const strictLimiter = createRateLimiter({ max: 10, windowMs: 10_000 });
 *   app.use('/api/search', strictLimiter.middleware);
 */
export function createRateLimiter(options: RateLimiterOptions = {}): RateLimiter {
  const max         = options.max       ?? 100;
  const windowMs    = options.windowMs  ?? 60_000;
  const statusCode  = options.statusCode ?? 429;
  const whitelist   = new Set(options.whitelist ?? []);
  const skipPaths   = options.skip ?? DEFAULT_SKIP_PATHS;

  const keyGenerator = options.keyGenerator ??
    ((req: Request) => req.ip ?? (req.socket.remoteAddress || 'unknown'));

  const store = new Map<string, WindowRecord>();

  function getRecord(key: string, now: number): WindowRecord {
    let rec = store.get(key);
    if (!rec) {
      rec = { timestamps: [] };
      store.set(key, rec);
    }
    // Prune timestamps outside the window
    const cutoff = now - windowMs;
    rec.timestamps = rec.timestamps.filter(ts => ts > cutoff);
    return rec;
  }

  const middleware: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
    // Skip configured paths
    if (skipPaths.some(p => req.path === p || req.path.startsWith(p + '/'))) {
      next();
      return;
    }

    const key = keyGenerator(req);

    // Whitelist bypass
    if (whitelist.has(key)) {
      next();
      return;
    }

    const now = Date.now();
    const rec = getRecord(key, now);

    const remaining = Math.max(0, max - rec.timestamps.length);
    const resetTime = rec.timestamps.length > 0
      ? Math.ceil((rec.timestamps[0] + windowMs) / 1000)  // oldest + window
      : Math.ceil((now + windowMs) / 1000);

    // Set headers on every response (including allowed ones)
    res.setHeader('X-RateLimit-Limit',     String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, remaining - 1)));
    res.setHeader('X-RateLimit-Reset',     String(resetTime));

    if (rec.timestamps.length >= max) {
      // Rate limit exceeded
      const oldestTs = rec.timestamps[0];
      const retryAfterMs = oldestTs + windowMs - now;
      const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));

      res.setHeader('Retry-After', String(retryAfterSec));
      res.setHeader('X-RateLimit-Remaining', '0');

      if (options.onLimitReached) {
        options.onLimitReached(req, key);
      }

      const body = typeof options.message === 'function'
        ? options.message(retryAfterSec)
        : options.message ?? { error: 'Too many requests', retryAfter: retryAfterSec };

      res.status(statusCode).json(body);
      return;
    }

    // Request allowed — record timestamp
    rec.timestamps.push(now);
    next();
  };

  return {
    middleware,
    store,
    reset(key: string) { store.delete(key); },
    resetAll()         { store.clear(); },
  };
}
