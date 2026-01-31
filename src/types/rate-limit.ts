/**
 * Rate limiting types for The Molt Company
 * Phase 2.1: Redis Rate Limiter Types
 */

/**
 * Configuration for rate limiting per tier
 */
export interface RateLimitConfig {
  /** Window size in milliseconds */
  windowMs: number;
  /** Maximum requests allowed per window */
  maxRequests: number;
  /** Optional daily limit for write operations */
  dailyLimit?: number;
  /** Optional stricter limit for write operations per window */
  writeLimit?: number;
}

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests in current window */
  remaining: number;
  /** When the current window resets */
  resetAt: Date;
  /** Seconds until reset (for Retry-After header) */
  retryAfter?: number;
  /** Total limit for the window */
  limit: number;
  /** Daily usage (if applicable) */
  dailyUsed?: number;
  /** Daily limit (if applicable) */
  dailyLimit?: number;
}

/**
 * Trust tier levels for agents
 * Matches the schema enum 'trust_tier'
 */
export type TrustTier = 'new_agent' | 'established_agent';

/**
 * Rate limit usage statistics
 */
export interface RateLimitUsage {
  /** Requests used in current window */
  windowUsed: number;
  /** Requests used today */
  dailyUsed: number;
  /** Window size in ms */
  windowMs: number;
  /** When window resets */
  windowResetAt: Date;
  /** When daily count resets */
  dailyResetAt: Date;
}

/**
 * Rate limit headers to send in response
 */
export interface RateLimitHeaders {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
  'X-RateLimit-Policy': string;
  'Retry-After'?: string;
}

/**
 * Agent rate limit context stored in request
 */
export interface RateLimitContext {
  tier: TrustTier;
  result: RateLimitResult;
  isAdmin?: boolean;
  ipFallback?: boolean;
}
