/**
 * Retry Configuration
 * Exponential backoff and retry strategies for different job types
 */

import { BackoffOptions } from 'bullmq';

/**
 * Retry strategy types
 */
export type RetryStrategy = 'exponential' | 'fixed' | 'linear';

/**
 * Retry configuration for a queue
 */
export interface RetryConfig {
  maxRetries: number;
  strategy: RetryStrategy;
  initialDelay: number;
  maxDelay: number;
  retryableErrors?: string[];
  nonRetryableErrors?: string[];
}

/**
 * Default retry configurations per queue
 */
export const retryConfigs: Record<string, RetryConfig> = {
  events: {
    maxRetries: 1,
    strategy: 'fixed',
    initialDelay: 100,
    maxDelay: 100,
    // Events are ephemeral - no retries needed
  },
  webhooks: {
    maxRetries: 5,
    strategy: 'exponential',
    initialDelay: 5000, // 5 seconds
    maxDelay: 300000, // 5 minutes
    retryableErrors: [
      'ETIMEDOUT',
      'ECONNREFUSED',
      'ECONNRESET',
      'NetworkError',
      'TimeoutError',
    ],
    nonRetryableErrors: [
      'ValidationError',
      'AuthenticationError',
      '4xx', // Client errors (except 429)
    ],
  },
  search: {
    maxRetries: 3,
    strategy: 'fixed',
    initialDelay: 2000, // 2 seconds
    maxDelay: 2000,
    retryableErrors: [
      'RateLimitError',
      'OpenAIError',
      'EmbeddingError',
    ],
  },
  tools: {
    maxRetries: 2,
    strategy: 'exponential',
    initialDelay: 1000,
    maxDelay: 10000,
    retryableErrors: [
      'TimeoutError',
      'ConnectionError',
    ],
    nonRetryableErrors: [
      'ValidationError',
      'PermissionError',
    ],
  },
  maintenance: {
    maxRetries: 1,
    strategy: 'fixed',
    initialDelay: 60000, // 1 minute
    maxDelay: 60000,
    // Maintenance jobs are scheduled, retry manually if needed
  },
};

/**
 * Get BullMQ backoff options from retry config
 */
export function getBackoffOptions(queueName: string): BackoffOptions {
  const config = retryConfigs[queueName] || retryConfigs.webhooks;

  return {
    type: config.strategy === 'linear' ? 'fixed' : config.strategy,
    delay: config.initialDelay,
  };
}

/**
 * Calculate delay for a specific attempt
 */
export function calculateDelay(
  queueName: string,
  attemptNumber: number
): number {
  const config = retryConfigs[queueName] || retryConfigs.webhooks;

  let delay: number;

  switch (config.strategy) {
    case 'exponential':
      delay = config.initialDelay * Math.pow(2, attemptNumber - 1);
      break;
    case 'linear':
      delay = config.initialDelay * attemptNumber;
      break;
    case 'fixed':
    default:
      delay = config.initialDelay;
  }

  // Cap at max delay
  return Math.min(delay, config.maxDelay);
}

/**
 * Determine if an error should trigger a retry
 */
export function shouldRetry(
  queueName: string,
  error: Error,
  attemptNumber: number
): boolean {
  const config = retryConfigs[queueName] || retryConfigs.webhooks;

  // Check if we've exhausted retries
  if (attemptNumber >= config.maxRetries) {
    return false;
  }

  const errorMessage = error.message || '';
  const errorName = error.name || '';

  // Check non-retryable errors first
  if (config.nonRetryableErrors) {
    for (const pattern of config.nonRetryableErrors) {
      if (errorMessage.includes(pattern) || errorName.includes(pattern)) {
        return false;
      }
    }
  }

  // Check retryable errors if specified
  if (config.retryableErrors && config.retryableErrors.length > 0) {
    for (const pattern of config.retryableErrors) {
      if (errorMessage.includes(pattern) || errorName.includes(pattern)) {
        return true;
      }
    }
    // If retryable errors are specified, only retry those
    return false;
  }

  // Default: retry unless explicitly non-retryable
  return true;
}

/**
 * Get human-readable retry schedule for logging
 */
export function getRetrySchedule(queueName: string): string[] {
  const config = retryConfigs[queueName] || retryConfigs.webhooks;
  const schedule: string[] = [];

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    const delay = calculateDelay(queueName, attempt);
    schedule.push(`Attempt ${attempt}: ${formatDelay(delay)}`);
  }

  return schedule;
}

/**
 * Format delay in human-readable format
 */
function formatDelay(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}
