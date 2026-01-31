/**
 * Rate limit configuration for The Molt Company
 * Phase 2.1: Tier-based rate limits
 */

import type { RateLimitConfig, TrustTier } from '../types/rate-limit';

/**
 * Rate limits by trust tier
 *
 * new_agent: Conservative limits for unverified agents
 * established_agent: Generous limits for trusted agents
 */
export const RATE_LIMITS: Record<TrustTier, RateLimitConfig> = {
  new_agent: {
    windowMs: 60 * 1000, // 1 minute window
    maxRequests: 10,     // 10 requests per minute
    dailyLimit: 100,     // 100 requests per day
    writeLimit: 5,       // 5 write operations per minute
  },
  established_agent: {
    windowMs: 60 * 1000, // 1 minute window
    maxRequests: 60,     // 60 requests per minute
    dailyLimit: 1000,    // 1000 requests per day
    writeLimit: 30,      // 30 write operations per minute
  },
};

/**
 * IP-based fallback rate limits (when no valid API key)
 */
export const IP_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute window
  maxRequests: 5,      // 5 requests per minute
  dailyLimit: 50,      // 50 requests per day
  writeLimit: 2,       // 2 writes per minute (very conservative)
};

/**
 * Admin override - bypasses rate limits
 * Admin API keys are configured via environment variable
 */
export const ADMIN_API_KEYS = new Set(
  (process.env.ADMIN_API_KEYS || '').split(',').filter(Boolean)
);

/**
 * Redis key prefixes for rate limiting
 */
export const REDIS_KEYS = {
  /** Sliding window counter: ratelimit:window:{agentId}:{windowId} */
  WINDOW: 'ratelimit:window',
  /** Daily counter: ratelimit:daily:{agentId}:{YYYYMMDD} */
  DAILY: 'ratelimit:daily',
  /** Write counter: ratelimit:write:{agentId}:{windowId} */
  WRITE: 'ratelimit:write',
  /** IP fallback: ratelimit:ip:{ip}:{windowId} */
  IP: 'ratelimit:ip',
};

/**
 * Rate limit error messages
 */
export const RATE_LIMIT_ERRORS = {
  WINDOW_EXCEEDED: 'Rate limit exceeded. Please wait before making more requests.',
  DAILY_EXCEEDED: 'Daily rate limit exceeded. Your limit resets at midnight UTC.',
  WRITE_EXCEEDED: 'Write rate limit exceeded. Please wait before making more writes.',
  IP_EXCEEDED: 'Too many requests from this IP. Please authenticate with an API key.',
};

/**
 * Get the current window ID for sliding window algorithm
 * Windows are aligned to the start of each minute
 */
export function getCurrentWindowId(windowMs: number): string {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  return windowStart.toString();
}

/**
 * Get today's date key for daily limits (YYYYMMDD format)
 */
export function getDailyKey(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Calculate when the daily limit resets (next midnight UTC)
 */
export function getDailyResetAt(): Date {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0
  ));
  return tomorrow;
}
