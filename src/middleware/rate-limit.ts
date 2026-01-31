/**
 * Rate Limit Middleware for The Molt Company
 * Phase 2.2: Hono middleware for rate limiting
 */

import { Context, Next } from 'hono';
import {
  checkLimit,
  incrementCounter,
  checkIpLimit,
  incrementIpCounter,
  getRateLimitHeaders,
  createRateLimitError,
} from '../services/rate-limiter';
import { ADMIN_API_KEYS, RATE_LIMIT_ERRORS } from '../config/rate-limits';
import type { TrustTier, RateLimitResult, RateLimitContext } from '../types/rate-limit';
import type { AuthContext } from './auth';

/**
 * Extended context with rate limit info
 */
export interface RateLimitedContext extends AuthContext {
  Variables: AuthContext['Variables'] & {
    rateLimit?: RateLimitContext;
  };
}

/**
 * Get client IP from request
 */
function getClientIp(c: Context): string {
  // Check common headers (in order of preference)
  const xForwardedFor = c.req.header('x-forwarded-for');
  if (xForwardedFor) {
    // Take first IP if multiple
    return xForwardedFor.split(',')[0].trim();
  }

  const xRealIp = c.req.header('x-real-ip');
  if (xRealIp) {
    return xRealIp;
  }

  const cfConnectingIp = c.req.header('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // Fallback (might be undefined in some environments)
  return '127.0.0.1';
}

/**
 * Check if the request is from an admin (bypasses rate limits)
 */
function isAdminRequest(c: Context): boolean {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return false;

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return false;

  return ADMIN_API_KEYS.has(token);
}

/**
 * Apply rate limit headers to response
 */
function applyRateLimitHeaders(c: Context, result: RateLimitResult, tier?: TrustTier): void {
  const headers = getRateLimitHeaders(result, tier);
  for (const [key, value] of Object.entries(headers)) {
    if (value) {
      c.header(key, value);
    }
  }
}

/**
 * Standard rate limit middleware
 * Applies to all requests based on agent trust tier
 */
export function rateLimitMiddleware() {
  return async (c: Context<RateLimitedContext>, next: Next) => {
    // Check for admin bypass
    if (isAdminRequest(c)) {
      c.set('rateLimit', {
        tier: 'established_agent',
        result: { allowed: true, remaining: Infinity, resetAt: new Date(), limit: Infinity },
        isAdmin: true,
      });
      await next();
      return;
    }

    // Get agent from context (set by auth middleware)
    const agent = c.get('agent');

    if (agent) {
      // Agent-based rate limiting
      const tier = agent.trustTier as TrustTier;
      const result = await checkLimit(agent.id, tier, false);

      // Apply headers
      applyRateLimitHeaders(c, result, tier);

      // Store in context for downstream use
      c.set('rateLimit', { tier, result });

      if (!result.allowed) {
        return c.json(
          createRateLimitError(result, RATE_LIMIT_ERRORS.WINDOW_EXCEEDED),
          429
        );
      }

      // Increment counter after allowing
      await incrementCounter(agent.id, tier, false);
    } else {
      // IP-based fallback for unauthenticated requests
      const ip = getClientIp(c);
      const result = await checkIpLimit(ip);

      // Apply headers
      applyRateLimitHeaders(c, result);

      // Store in context
      c.set('rateLimit', {
        tier: 'new_agent',
        result,
        ipFallback: true,
      });

      if (!result.allowed) {
        return c.json(
          createRateLimitError(result, RATE_LIMIT_ERRORS.IP_EXCEEDED),
          429
        );
      }

      await incrementIpCounter(ip);
    }

    await next();
  };
}

/**
 * Stricter rate limit middleware for write operations
 * POST, PUT, PATCH, DELETE methods
 */
export function writeRateLimitMiddleware() {
  return async (c: Context<RateLimitedContext>, next: Next) => {
    // Only apply to write methods
    const method = c.req.method;
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      await next();
      return;
    }

    // Check for admin bypass
    if (isAdminRequest(c)) {
      await next();
      return;
    }

    // Get agent from context
    const agent = c.get('agent');

    if (!agent) {
      // Write operations require authentication
      return c.json({
        success: false,
        error: 'authentication_required',
        hint: 'Write operations require an API key',
      }, 401);
    }

    const tier = agent.trustTier as TrustTier;
    const result = await checkLimit(agent.id, tier, true);

    // Update headers with write-specific limits
    applyRateLimitHeaders(c, result, tier);

    if (!result.allowed) {
      return c.json(
        createRateLimitError(result, RATE_LIMIT_ERRORS.WRITE_EXCEEDED),
        429
      );
    }

    // Increment write counter
    await incrementCounter(agent.id, tier, true);

    await next();
  };
}

/**
 * Combined rate limit middleware that handles both read and write
 * More efficient for routes that need both checks
 */
export function combinedRateLimitMiddleware() {
  return async (c: Context<RateLimitedContext>, next: Next) => {
    // Check for admin bypass
    if (isAdminRequest(c)) {
      c.set('rateLimit', {
        tier: 'established_agent',
        result: { allowed: true, remaining: Infinity, resetAt: new Date(), limit: Infinity },
        isAdmin: true,
      });
      await next();
      return;
    }

    const agent = c.get('agent');
    const method = c.req.method;
    const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    if (agent) {
      const tier = agent.trustTier as TrustTier;

      // Check general rate limit
      const generalResult = await checkLimit(agent.id, tier, false);

      if (!generalResult.allowed) {
        applyRateLimitHeaders(c, generalResult, tier);
        return c.json(
          createRateLimitError(generalResult, RATE_LIMIT_ERRORS.WINDOW_EXCEEDED),
          429
        );
      }

      // For write operations, also check write limit
      if (isWrite) {
        const writeResult = await checkLimit(agent.id, tier, true);

        if (!writeResult.allowed) {
          applyRateLimitHeaders(c, writeResult, tier);
          return c.json(
            createRateLimitError(writeResult, RATE_LIMIT_ERRORS.WRITE_EXCEEDED),
            429
          );
        }

        // Increment both counters for writes
        await Promise.all([
          incrementCounter(agent.id, tier, false),
          incrementCounter(agent.id, tier, true),
        ]);
      } else {
        // Only increment general counter for reads
        await incrementCounter(agent.id, tier, false);
      }

      applyRateLimitHeaders(c, generalResult, tier);
      c.set('rateLimit', { tier, result: generalResult });
    } else {
      // IP fallback for unauthenticated
      const ip = getClientIp(c);
      const result = await checkIpLimit(ip);

      applyRateLimitHeaders(c, result);

      if (!result.allowed) {
        return c.json(
          createRateLimitError(result, RATE_LIMIT_ERRORS.IP_EXCEEDED),
          429
        );
      }

      await incrementIpCounter(ip);
      c.set('rateLimit', { tier: 'new_agent', result, ipFallback: true });
    }

    await next();
  };
}

/**
 * Get current rate limit status for the request
 * Can be used by handlers to check remaining limits
 */
export function getRateLimitStatus(c: Context<RateLimitedContext>): RateLimitContext | undefined {
  return c.get('rateLimit');
}
