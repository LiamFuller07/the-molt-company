/**
 * Rate Limiter Service for The Molt Company
 * Phase 2.1: Redis-based sliding window rate limiting
 *
 * Uses a sliding window counter algorithm for accurate rate limiting:
 * - Combines current and previous window counts with weighted average
 * - Provides smooth rate limiting without sudden resets
 * - Tracks both per-minute and daily limits
 */

import { redis } from '../lib/redis';
import {
  RATE_LIMITS,
  IP_RATE_LIMIT,
  REDIS_KEYS,
  getCurrentWindowId,
  getDailyKey,
  getDailyResetAt,
} from '../config/rate-limits';
import type {
  TrustTier,
  RateLimitResult,
  RateLimitUsage,
  RateLimitHeaders,
  RateLimitConfig,
} from '../types/rate-limit';

/**
 * Check rate limit for an agent using sliding window counter
 *
 * @param agentId - The agent's UUID
 * @param tier - The agent's trust tier
 * @param isWrite - Whether this is a write operation (stricter limits)
 * @returns Rate limit result with allowed status and metadata
 */
export async function checkLimit(
  agentId: string,
  tier: TrustTier,
  isWrite: boolean = false
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[tier];
  const limit = isWrite && config.writeLimit ? config.writeLimit : config.maxRequests;
  const windowMs = config.windowMs;
  const now = Date.now();

  // Calculate window IDs
  const currentWindowId = getCurrentWindowId(windowMs);
  const previousWindowId = (parseInt(currentWindowId) - windowMs).toString();

  // Redis keys
  const keyPrefix = isWrite ? REDIS_KEYS.WRITE : REDIS_KEYS.WINDOW;
  const currentKey = `${keyPrefix}:${agentId}:${currentWindowId}`;
  const previousKey = `${keyPrefix}:${agentId}:${previousWindowId}`;
  const dailyKey = `${REDIS_KEYS.DAILY}:${agentId}:${getDailyKey()}`;

  try {
    // Get all counts in a single pipeline
    const pipeline = redis.pipeline();
    pipeline.get(currentKey);
    pipeline.get(previousKey);
    pipeline.get(dailyKey);
    const results = await pipeline.exec();

    const currentCount = parseInt((results?.[0]?.[1] as string) || '0');
    const previousCount = parseInt((results?.[1]?.[1] as string) || '0');
    const dailyCount = parseInt((results?.[2]?.[1] as string) || '0');

    // Calculate sliding window count
    // Weight = how far we are into the current window (0 to 1)
    const windowPosition = (now % windowMs) / windowMs;
    const slidingCount = Math.floor(
      previousCount * (1 - windowPosition) + currentCount
    );

    // Calculate reset time
    const windowResetAt = new Date(parseInt(currentWindowId) + windowMs);
    const dailyResetAt = getDailyResetAt();

    // Check daily limit first (if configured)
    if (config.dailyLimit && dailyCount >= config.dailyLimit) {
      const retryAfter = Math.ceil((dailyResetAt.getTime() - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetAt: dailyResetAt,
        retryAfter,
        limit: config.dailyLimit,
        dailyUsed: dailyCount,
        dailyLimit: config.dailyLimit,
      };
    }

    // Check window limit
    if (slidingCount >= limit) {
      const retryAfter = Math.ceil((windowResetAt.getTime() - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetAt: windowResetAt,
        retryAfter,
        limit,
        dailyUsed: dailyCount,
        dailyLimit: config.dailyLimit,
      };
    }

    // Request is allowed
    return {
      allowed: true,
      remaining: limit - slidingCount - 1, // -1 for current request
      resetAt: windowResetAt,
      limit,
      dailyUsed: dailyCount,
      dailyLimit: config.dailyLimit,
    };
  } catch (error) {
    console.error('[RateLimiter] Redis error, allowing request:', error);
    // On Redis error, allow the request (fail open)
    return {
      allowed: true,
      remaining: limit,
      resetAt: new Date(now + windowMs),
      limit,
    };
  }
}

/**
 * Increment the rate limit counter after a request
 *
 * @param agentId - The agent's UUID
 * @param tier - The agent's trust tier
 * @param isWrite - Whether this is a write operation
 */
export async function incrementCounter(
  agentId: string,
  tier: TrustTier,
  isWrite: boolean = false
): Promise<void> {
  const config = RATE_LIMITS[tier];
  const windowMs = config.windowMs;
  const currentWindowId = getCurrentWindowId(windowMs);

  // Redis keys
  const keyPrefix = isWrite ? REDIS_KEYS.WRITE : REDIS_KEYS.WINDOW;
  const currentKey = `${keyPrefix}:${agentId}:${currentWindowId}`;
  const dailyKey = `${REDIS_KEYS.DAILY}:${agentId}:${getDailyKey()}`;

  // TTL: 2 windows for sliding window, 25 hours for daily (handles timezone edge cases)
  const windowTtl = Math.ceil((windowMs * 2) / 1000);
  const dailyTtl = 25 * 60 * 60; // 25 hours

  try {
    const pipeline = redis.pipeline();
    pipeline.incr(currentKey);
    pipeline.expire(currentKey, windowTtl);
    pipeline.incr(dailyKey);
    pipeline.expire(dailyKey, dailyTtl);
    await pipeline.exec();
  } catch (error) {
    console.error('[RateLimiter] Failed to increment counter:', error);
    // Don't throw - rate limiting is best-effort
  }
}

/**
 * Check rate limit for an IP address (fallback when no API key)
 *
 * @param ip - The client IP address
 * @returns Rate limit result
 */
export async function checkIpLimit(ip: string): Promise<RateLimitResult> {
  const config = IP_RATE_LIMIT;
  const windowMs = config.windowMs;
  const now = Date.now();

  const currentWindowId = getCurrentWindowId(windowMs);
  const previousWindowId = (parseInt(currentWindowId) - windowMs).toString();

  const currentKey = `${REDIS_KEYS.IP}:${ip}:${currentWindowId}`;
  const previousKey = `${REDIS_KEYS.IP}:${ip}:${previousWindowId}`;

  try {
    const pipeline = redis.pipeline();
    pipeline.get(currentKey);
    pipeline.get(previousKey);
    const results = await pipeline.exec();

    const currentCount = parseInt((results?.[0]?.[1] as string) || '0');
    const previousCount = parseInt((results?.[1]?.[1] as string) || '0');

    const windowPosition = (now % windowMs) / windowMs;
    const slidingCount = Math.floor(
      previousCount * (1 - windowPosition) + currentCount
    );

    const windowResetAt = new Date(parseInt(currentWindowId) + windowMs);

    if (slidingCount >= config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: windowResetAt,
        retryAfter: Math.ceil((windowResetAt.getTime() - now) / 1000),
        limit: config.maxRequests,
      };
    }

    return {
      allowed: true,
      remaining: config.maxRequests - slidingCount - 1,
      resetAt: windowResetAt,
      limit: config.maxRequests,
    };
  } catch (error) {
    console.error('[RateLimiter] Redis error on IP check:', error);
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAt: new Date(now + windowMs),
      limit: config.maxRequests,
    };
  }
}

/**
 * Increment IP-based rate limit counter
 *
 * @param ip - The client IP address
 */
export async function incrementIpCounter(ip: string): Promise<void> {
  const windowMs = IP_RATE_LIMIT.windowMs;
  const currentWindowId = getCurrentWindowId(windowMs);
  const currentKey = `${REDIS_KEYS.IP}:${ip}:${currentWindowId}`;
  const windowTtl = Math.ceil((windowMs * 2) / 1000);

  try {
    const pipeline = redis.pipeline();
    pipeline.incr(currentKey);
    pipeline.expire(currentKey, windowTtl);
    await pipeline.exec();
  } catch (error) {
    console.error('[RateLimiter] Failed to increment IP counter:', error);
  }
}

/**
 * Get current rate limit usage for an agent
 *
 * @param agentId - The agent's UUID
 * @param tier - The agent's trust tier
 * @returns Current usage statistics
 */
export async function getUsage(
  agentId: string,
  tier: TrustTier
): Promise<RateLimitUsage> {
  const config = RATE_LIMITS[tier];
  const windowMs = config.windowMs;
  const now = Date.now();
  const currentWindowId = getCurrentWindowId(windowMs);

  const currentKey = `${REDIS_KEYS.WINDOW}:${agentId}:${currentWindowId}`;
  const dailyKey = `${REDIS_KEYS.DAILY}:${agentId}:${getDailyKey()}`;

  try {
    const pipeline = redis.pipeline();
    pipeline.get(currentKey);
    pipeline.get(dailyKey);
    const results = await pipeline.exec();

    const windowUsed = parseInt((results?.[0]?.[1] as string) || '0');
    const dailyUsed = parseInt((results?.[1]?.[1] as string) || '0');

    return {
      windowUsed,
      dailyUsed,
      windowMs,
      windowResetAt: new Date(parseInt(currentWindowId) + windowMs),
      dailyResetAt: getDailyResetAt(),
    };
  } catch (error) {
    console.error('[RateLimiter] Failed to get usage:', error);
    return {
      windowUsed: 0,
      dailyUsed: 0,
      windowMs,
      windowResetAt: new Date(now + windowMs),
      dailyResetAt: getDailyResetAt(),
    };
  }
}

/**
 * Reset daily counters for all agents
 * This should be called by a cron job at midnight UTC
 */
export async function resetDailyCounters(): Promise<void> {
  // Daily counters auto-expire via TTL, but this can be used
  // for manual resets or specific agent resets
  const pattern = `${REDIS_KEYS.DAILY}:*:${getDailyKey()}`;

  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`[RateLimiter] Reset ${keys.length} daily counters`);
    }
  } catch (error) {
    console.error('[RateLimiter] Failed to reset daily counters:', error);
  }
}

/**
 * Reset rate limits for a specific agent
 * Use for admin actions or testing
 *
 * @param agentId - The agent's UUID
 */
export async function resetAgentLimits(agentId: string): Promise<void> {
  const patterns = [
    `${REDIS_KEYS.WINDOW}:${agentId}:*`,
    `${REDIS_KEYS.WRITE}:${agentId}:*`,
    `${REDIS_KEYS.DAILY}:${agentId}:*`,
  ];

  try {
    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }
    console.log(`[RateLimiter] Reset limits for agent: ${agentId}`);
  } catch (error) {
    console.error('[RateLimiter] Failed to reset agent limits:', error);
  }
}

/**
 * Generate rate limit headers for HTTP response
 *
 * @param result - The rate limit result
 * @param tier - The agent's trust tier (for policy info)
 * @returns Headers object to set on response
 */
export function getRateLimitHeaders(
  result: RateLimitResult,
  tier?: TrustTier
): RateLimitHeaders {
  const headers: RateLimitHeaders = {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': Math.max(0, result.remaining).toString(),
    'X-RateLimit-Reset': result.resetAt.toISOString(),
    'X-RateLimit-Policy': tier
      ? `${result.limit};w=${RATE_LIMITS[tier].windowMs / 1000}`
      : `${result.limit};w=60`,
  };

  if (!result.allowed && result.retryAfter) {
    headers['Retry-After'] = result.retryAfter.toString();
  }

  return headers;
}

/**
 * Format 429 rate limit error response
 */
export interface RateLimitErrorResponse {
  success: false;
  error: string;
  code: 'rate_limited';
  retryAfter: number;
  hint: string;
  usage?: {
    windowUsed: number;
    windowLimit: number;
    dailyUsed?: number;
    dailyLimit?: number;
  };
}

/**
 * Create rate limit error response body
 */
export function createRateLimitError(
  result: RateLimitResult,
  message: string
): RateLimitErrorResponse {
  return {
    success: false,
    error: 'rate_limited',
    code: 'rate_limited',
    retryAfter: result.retryAfter || 60,
    hint: message,
    usage: {
      windowUsed: result.limit - result.remaining,
      windowLimit: result.limit,
      dailyUsed: result.dailyUsed,
      dailyLimit: result.dailyLimit,
    },
  };
}
