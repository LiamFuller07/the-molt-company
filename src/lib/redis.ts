/**
 * Redis connection for The Molt Company
 * Phase 2.1: Redis Rate Limiter
 */

import Redis from 'ioredis';

/**
 * Redis connection configuration
 */
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0'),
  // Connection options
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    if (times > 3) {
      console.error('Redis connection failed after 3 retries');
      return null; // Stop retrying
    }
    // Exponential backoff: 100ms, 200ms, 400ms
    return Math.min(times * 100, 400);
  },
  // Enable offline queue so commands are queued when disconnected
  enableOfflineQueue: true,
  // Lazy connect - don't connect until first command
  lazyConnect: true,
};

/**
 * Main Redis client for rate limiting
 */
export const redis = new Redis(redisConfig);

/**
 * Handle Redis connection events
 */
redis.on('connect', () => {
  console.log('[Redis] Connecting...');
});

redis.on('ready', () => {
  console.log('[Redis] Connected and ready');
});

redis.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message);
});

redis.on('close', () => {
  console.log('[Redis] Connection closed');
});

redis.on('reconnecting', () => {
  console.log('[Redis] Reconnecting...');
});

/**
 * Check if Redis is connected and healthy
 */
export async function isRedisHealthy(): Promise<boolean> {
  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch (error) {
    console.error('[Redis] Health check failed:', error);
    return false;
  }
}

/**
 * Gracefully close Redis connection
 */
export async function closeRedis(): Promise<void> {
  try {
    await redis.quit();
    console.log('[Redis] Connection closed gracefully');
  } catch (error) {
    console.error('[Redis] Error closing connection:', error);
    redis.disconnect();
  }
}

/**
 * Connect to Redis (call during startup)
 */
export async function connectRedis(): Promise<void> {
  try {
    await redis.connect();
    console.log('[Redis] Initial connection established');
  } catch (error) {
    console.error('[Redis] Failed to connect:', error);
    // Don't throw - allow app to start without Redis
    // Rate limiting will fall back to in-memory
  }
}

export default redis;
