/**
 * Unit Tests: Rate Limiter Service
 *
 * Tests rate limit checking, counter management, sliding window algorithm,
 * and rate limit headers generation
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  RATE_LIMITS,
  IP_RATE_LIMIT,
  REDIS_KEYS,
  getCurrentWindowId,
  getDailyKey,
  getDailyResetAt,
} from '@/config/rate-limits';
import { getRateLimitHeaders, createRateLimitError } from '@/services/rate-limiter';
import type { RateLimitResult, TrustTier } from '@/types/rate-limit';

// ============================================================================
// MOCK REDIS & SLIDING WINDOW ALGORITHM
// ============================================================================

/**
 * In-memory rate limit store for testing
 * Mimics Redis sliding window behavior
 */
class MockRateLimitStore {
  private windowCounters: Map<string, number> = new Map();
  private dailyCounters: Map<string, number> = new Map();

  reset() {
    this.windowCounters.clear();
    this.dailyCounters.clear();
  }

  getWindowCount(agentId: string, windowId: string): number {
    const key = `${agentId}:${windowId}`;
    return this.windowCounters.get(key) || 0;
  }

  incrementWindow(agentId: string, windowId: string): number {
    const key = `${agentId}:${windowId}`;
    const count = (this.windowCounters.get(key) || 0) + 1;
    this.windowCounters.set(key, count);
    return count;
  }

  getDailyCount(agentId: string, dailyKey: string): number {
    const key = `${agentId}:${dailyKey}`;
    return this.dailyCounters.get(key) || 0;
  }

  incrementDaily(agentId: string, dailyKey: string): number {
    const key = `${agentId}:${dailyKey}`;
    const count = (this.dailyCounters.get(key) || 0) + 1;
    this.dailyCounters.set(key, count);
    return count;
  }
}

/**
 * Pure function rate limit checker (no Redis dependency)
 */
function checkRateLimit(
  currentCount: number,
  previousCount: number,
  windowPosition: number,
  limit: number,
  dailyCount: number,
  dailyLimit: number | undefined,
  windowMs: number,
  now: number
): RateLimitResult {
  // Calculate sliding window count
  const slidingCount = Math.floor(previousCount * (1 - windowPosition) + currentCount);

  const currentWindowId = Math.floor(now / windowMs) * windowMs;
  const windowResetAt = new Date(currentWindowId + windowMs);

  // Check daily limit first
  if (dailyLimit && dailyCount >= dailyLimit) {
    const dailyResetAt = getDailyResetAt();
    return {
      allowed: false,
      remaining: 0,
      resetAt: dailyResetAt,
      retryAfter: Math.ceil((dailyResetAt.getTime() - now) / 1000),
      limit: dailyLimit,
      dailyUsed: dailyCount,
      dailyLimit,
    };
  }

  // Check window limit
  if (slidingCount >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: windowResetAt,
      retryAfter: Math.ceil((windowResetAt.getTime() - now) / 1000),
      limit,
      dailyUsed: dailyCount,
      dailyLimit,
    };
  }

  return {
    allowed: true,
    remaining: limit - slidingCount - 1,
    resetAt: windowResetAt,
    limit,
    dailyUsed: dailyCount,
    dailyLimit,
  };
}

// ============================================================================
// TEST FIXTURES
// ============================================================================

const mockStore = new MockRateLimitStore();

// ============================================================================
// TESTS
// ============================================================================

describe('Rate Limiter', () => {
  beforeEach(() => {
    mockStore.reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rate Limit Checking', () => {
    it('allows requests under limit', () => {
      const now = Date.now();
      const config = RATE_LIMITS['new_agent'];

      const result = checkRateLimit(
        5, // current count
        0, // previous count
        0.5, // mid-window
        config.maxRequests, // 10
        50, // daily count
        config.dailyLimit, // 100
        config.windowMs,
        now
      );

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // 10 - 5 - 1
    });

    it('blocks requests over limit', () => {
      const now = Date.now();
      const config = RATE_LIMITS['new_agent'];

      const result = checkRateLimit(
        10, // at limit
        0,
        0.5,
        config.maxRequests, // 10
        50,
        config.dailyLimit,
        config.windowMs,
        now
      );

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('blocks when daily limit exceeded', () => {
      const now = Date.now();
      const config = RATE_LIMITS['new_agent'];

      const result = checkRateLimit(
        5,
        0,
        0.5,
        config.maxRequests,
        100, // at daily limit
        config.dailyLimit, // 100
        config.windowMs,
        now
      );

      expect(result.allowed).toBe(false);
      expect(result.dailyUsed).toBe(100);
      expect(result.dailyLimit).toBe(100);
    });

    it('allows requests when daily limit not set', () => {
      const now = Date.now();

      const result = checkRateLimit(
        5,
        0,
        0.5,
        10,
        999999, // high count but no limit
        undefined, // no daily limit
        60000,
        now
      );

      expect(result.allowed).toBe(true);
    });
  });

  describe('Sliding Window Algorithm', () => {
    it('weights previous window correctly at window start', () => {
      const now = Date.now();
      // At window start (position 0), previous window has full weight
      const windowPosition = 0.0;

      const result = checkRateLimit(
        0, // current: 0
        10, // previous: 10
        windowPosition, // start of window
        10,
        0,
        undefined,
        60000,
        now
      );

      // Sliding count = 10 * (1 - 0) + 0 = 10
      expect(result.allowed).toBe(false);
    });

    it('weights previous window correctly at window end', () => {
      const now = Date.now();
      // At window end (position ~1), previous window has no weight
      const windowPosition = 0.99;

      const result = checkRateLimit(
        0, // current: 0
        100, // previous: 100 (but weighted almost 0)
        windowPosition, // end of window
        10,
        0,
        undefined,
        60000,
        now
      );

      // Sliding count = 100 * (1 - 0.99) + 0 = 1
      expect(result.allowed).toBe(true);
    });

    it('calculates sliding count correctly mid-window', () => {
      const now = Date.now();
      const windowPosition = 0.5;

      const result = checkRateLimit(
        4, // current: 4
        8, // previous: 8
        windowPosition, // mid-window
        10,
        0,
        undefined,
        60000,
        now
      );

      // Sliding count = 8 * 0.5 + 4 = 8
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1); // 10 - 8 - 1
    });
  });

  describe('Window Reset', () => {
    it('resets after window expires', () => {
      const windowMs = 60000; // 1 minute
      const now = Date.now();

      // First check at start of window - at limit
      let result = checkRateLimit(
        10, // at limit
        0,
        0.1, // near start
        10,
        0,
        undefined,
        windowMs,
        now
      );

      expect(result.allowed).toBe(false);

      // Move time forward past window
      vi.advanceTimersByTime(windowMs + 1000);
      const laterNow = Date.now();

      // Now we're in a new window, old counts become "previous"
      result = checkRateLimit(
        0, // new window: 0
        10, // old counts now in previous
        0.02, // very start of new window
        10,
        0,
        undefined,
        windowMs,
        laterNow
      );

      // Previous window is weighted: 10 * (1 - 0.02) = 9.8 -> floor = 9
      // Still almost at limit due to sliding window
      expect(result.remaining).toBe(0); // 10 - 9 - 1 = 0
    });
  });

  describe('Daily Limits', () => {
    it('tracks daily limits separately from window limits', () => {
      const now = Date.now();
      const config = RATE_LIMITS['new_agent'];

      // Under window limit but over daily limit
      const result = checkRateLimit(
        1, // well under window limit
        0,
        0.5,
        config.maxRequests, // 10
        100, // at daily limit
        config.dailyLimit, // 100
        config.windowMs,
        now
      );

      expect(result.allowed).toBe(false);
      expect(result.dailyUsed).toBe(100);
    });

    it('returns daily reset time when daily limit exceeded', () => {
      const now = Date.now();

      const result = checkRateLimit(
        1,
        0,
        0.5,
        10,
        100,
        100,
        60000,
        now
      );

      expect(result.allowed).toBe(false);
      // Reset should be at next midnight UTC
      const expectedReset = getDailyResetAt();
      expect(result.resetAt.getTime()).toBe(expectedReset.getTime());
    });
  });

  describe('Rate Limit Headers', () => {
    it('generates correct headers for allowed request', () => {
      const result: RateLimitResult = {
        allowed: true,
        remaining: 5,
        resetAt: new Date('2025-01-31T12:00:00Z'),
        limit: 10,
      };

      const headers = getRateLimitHeaders(result, 'new_agent');

      expect(headers['X-RateLimit-Limit']).toBe('10');
      expect(headers['X-RateLimit-Remaining']).toBe('5');
      expect(headers['X-RateLimit-Reset']).toBe('2025-01-31T12:00:00.000Z');
      expect(headers['X-RateLimit-Policy']).toContain('10');
      expect(headers['Retry-After']).toBeUndefined();
    });

    it('includes Retry-After for rate limited requests', () => {
      const result: RateLimitResult = {
        allowed: false,
        remaining: 0,
        resetAt: new Date('2025-01-31T12:00:00Z'),
        retryAfter: 30,
        limit: 10,
      };

      const headers = getRateLimitHeaders(result, 'new_agent');

      expect(headers['Retry-After']).toBe('30');
    });

    it('handles negative remaining gracefully', () => {
      const result: RateLimitResult = {
        allowed: false,
        remaining: -5,
        resetAt: new Date('2025-01-31T12:00:00Z'),
        limit: 10,
      };

      const headers = getRateLimitHeaders(result);

      expect(headers['X-RateLimit-Remaining']).toBe('0');
    });
  });

  describe('Rate Limit Error Response', () => {
    it('creates error response with usage info', () => {
      const result: RateLimitResult = {
        allowed: false,
        remaining: 0,
        resetAt: new Date(),
        retryAfter: 45,
        limit: 10,
        dailyUsed: 90,
        dailyLimit: 100,
      };

      const error = createRateLimitError(result, 'Rate limit exceeded');

      expect(error.success).toBe(false);
      expect(error.code).toBe('rate_limited');
      expect(error.retryAfter).toBe(45);
      expect(error.usage?.windowUsed).toBe(10);
      expect(error.usage?.windowLimit).toBe(10);
      expect(error.usage?.dailyUsed).toBe(90);
      expect(error.usage?.dailyLimit).toBe(100);
    });

    it('uses default retry after when not specified', () => {
      const result: RateLimitResult = {
        allowed: false,
        remaining: 0,
        resetAt: new Date(),
        limit: 10,
      };

      const error = createRateLimitError(result, 'Rate limit exceeded');

      expect(error.retryAfter).toBe(60);
    });
  });

  describe('Configuration Helpers', () => {
    it('getCurrentWindowId aligns to window boundaries', () => {
      const windowMs = 60000; // 1 minute

      vi.setSystemTime(new Date('2025-01-31T12:30:45.500Z'));
      const windowId = getCurrentWindowId(windowMs);

      // Should be aligned to 12:30:00
      const expected = new Date('2025-01-31T12:30:00Z').getTime();
      expect(parseInt(windowId)).toBe(expected);
    });

    it('getDailyKey returns correct format', () => {
      vi.setSystemTime(new Date('2025-01-31T12:00:00Z'));
      const key = getDailyKey();

      expect(key).toBe('20250131');
    });

    it('getDailyResetAt returns next midnight UTC', () => {
      vi.setSystemTime(new Date('2025-01-31T12:00:00Z'));
      const resetAt = getDailyResetAt();

      expect(resetAt.toISOString()).toBe('2025-02-01T00:00:00.000Z');
    });
  });

  describe('IP Rate Limiting', () => {
    it('IP rate limit has lower limits than agent tiers', () => {
      expect(IP_RATE_LIMIT.maxRequests).toBeLessThan(RATE_LIMITS['new_agent'].maxRequests);
      expect(IP_RATE_LIMIT.dailyLimit).toBeLessThan(RATE_LIMITS['new_agent'].dailyLimit!);
    });

    it('IP rate limit uses same window size', () => {
      expect(IP_RATE_LIMIT.windowMs).toBe(RATE_LIMITS['new_agent'].windowMs);
    });
  });
});
