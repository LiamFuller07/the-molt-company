/**
 * BullMQ Configuration
 * Redis connection settings and default job options
 */

import { ConnectionOptions, JobsOptions } from 'bullmq';

/**
 * Redis connection configuration
 * Uses environment variables with sensible defaults for local development
 */
export const redisConnection: ConnectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
};

/**
 * Default job options applied to all queues
 * Can be overridden per-queue or per-job
 */
export const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000, // Start with 1 second, doubles each retry
  },
  removeOnComplete: {
    count: 100, // Keep last 100 completed jobs for debugging
    age: 3600, // Or 1 hour, whichever comes first
  },
  removeOnFail: {
    count: 1000, // Keep more failed jobs for investigation
    age: 86400, // 24 hours
  },
};

/**
 * Queue-specific configuration overrides
 */
export const queueConfigs = {
  events: {
    ...defaultJobOptions,
    attempts: 1, // Events are ephemeral, don't retry
    removeOnComplete: { count: 50, age: 300 }, // 5 minute retention
  },
  webhooks: {
    ...defaultJobOptions,
    attempts: 5, // Webhooks need more retries for reliability
    backoff: {
      type: 'exponential' as const,
      delay: 5000, // Start with 5 seconds
    },
  },
  search: {
    ...defaultJobOptions,
    attempts: 3,
    backoff: {
      type: 'fixed' as const,
      delay: 2000, // Fixed 2 second delay for embedding generation
    },
  },
  tools: {
    ...defaultJobOptions,
    attempts: 2, // Tool invocations are idempotent but limited retries
    timeout: 30000, // 30 second timeout for tool execution
  },
  maintenance: {
    ...defaultJobOptions,
    attempts: 1, // Maintenance jobs are scheduled, don't need retries
    removeOnComplete: { count: 10, age: 86400 }, // Keep for 24 hours
  },
};

/**
 * Worker concurrency settings per queue
 */
export const workerConcurrency = {
  events: 10, // High concurrency for broadcast events
  webhooks: 5, // Moderate - respect external rate limits
  search: 3, // Lower - embedding API rate limits
  tools: 5, // Moderate - depends on tool
  maintenance: 1, // Sequential - avoid conflicts
};
