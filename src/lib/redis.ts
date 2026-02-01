/**
 * Redis connection for The Molt Company
 * Phase 2.1: Redis Rate Limiter
 */

import Redis from 'ioredis';
import { EventEmitter } from 'events';

// Check if Redis is configured
const redisUrl = process.env.REDIS_URL;
const isRedisConfigured = !!redisUrl;

/**
 * Mock Redis client that doesn't connect to anything
 * Used when REDIS_URL is not configured
 */
class MockRedis extends EventEmitter {
  status = 'wait';

  async ping() {
    return 'PONG';
  }

  async get() {
    return null;
  }

  async set() {
    return 'OK';
  }

  async del() {
    return 1;
  }

  async incr() {
    return 1;
  }

  async expire() {
    return 1;
  }

  async keys() {
    return [];
  }

  async mget(..._keys: string[]) {
    return _keys.map(() => null);
  }

  async setnx() {
    return 1;
  }

  pipeline() {
    const results: Array<[null, any]> = [];
    const self = {
      get: () => { results.push([null, null]); return self; },
      set: () => { results.push([null, 'OK']); return self; },
      setnx: () => { results.push([null, 1]); return self; },
      incr: () => { results.push([null, 1]); return self; },
      expire: () => { results.push([null, 1]); return self; },
      exec: async () => results,
    };
    return self;
  }

  async connect() {
    // Do nothing
  }

  async quit() {
    // Do nothing
  }

  disconnect() {
    // Do nothing
  }
}

/**
 * Main Redis client for rate limiting
 * Uses a mock client if REDIS_URL is not set
 */
export const redis: Redis | MockRedis = isRedisConfigured
  ? createRealRedis(redisUrl!)
  : new MockRedis() as any;

function createRealRedis(url: string): Redis {
  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      if (times > 3) {
        console.error('Redis connection failed after 3 retries');
        return null;
      }
      return Math.min(times * 100, 400);
    },
    enableOfflineQueue: true,
    lazyConnect: true,
  });

  client.on('connect', () => console.log('[Redis] Connecting...'));
  client.on('ready', () => console.log('[Redis] Connected and ready'));
  client.on('error', (err) => console.error('[Redis] Connection error:', err.message));
  client.on('close', () => console.log('[Redis] Connection closed'));
  client.on('reconnecting', () => console.log('[Redis] Reconnecting...'));

  return client;
}

if (!isRedisConfigured) {
  console.log('[Redis] Not configured, using in-memory mock');
}

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
