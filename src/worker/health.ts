/**
 * Worker Health Check
 * Monitor Redis connection and queue health
 */

import { Redis } from 'ioredis';
import { Queue } from 'bullmq';
import { redisConnection } from './config.js';

/**
 * Health check result
 */
export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  checks: {
    redis: RedisHealthCheck;
    queues: Record<string, QueueHealthCheck>;
    workers: WorkerHealthCheck;
  };
  summary: string;
}

export interface RedisHealthCheck {
  connected: boolean;
  latency: number | null; // ms
  memory: string | null;
  version: string | null;
}

export interface QueueHealthCheck {
  active: boolean;
  waiting: number;
  active_jobs: number;
  failed: number;
  backlogged: boolean;
}

export interface WorkerHealthCheck {
  running: boolean;
  uptime: number;
  processing: number;
}

/**
 * Health checker class
 */
export class HealthChecker {
  private redis: Redis | null = null;
  private queues: Map<string, Queue> = new Map();
  private startTime: Date = new Date();
  private isRunning = false;

  /**
   * Initialize Redis connection for health checks
   */
  async initialize(): Promise<void> {
    const host = typeof redisConnection === 'string'
      ? undefined
      : (redisConnection as { host?: string }).host || 'localhost';
    const port = typeof redisConnection === 'string'
      ? undefined
      : (redisConnection as { port?: number }).port || 6379;
    const password = typeof redisConnection === 'string'
      ? undefined
      : (redisConnection as { password?: string }).password;

    this.redis = new Redis({
      host,
      port,
      password,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null, // Don't retry for health checks
    });

    this.isRunning = true;
  }

  /**
   * Register a queue for health monitoring
   */
  registerQueue(queue: Queue): void {
    this.queues.set(queue.name, queue);
  }

  /**
   * Check Redis health
   */
  async checkRedis(): Promise<RedisHealthCheck> {
    if (!this.redis) {
      return {
        connected: false,
        latency: null,
        memory: null,
        version: null,
      };
    }

    try {
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;

      const info = await this.redis.info('server');
      const memoryInfo = await this.redis.info('memory');

      // Parse version
      const versionMatch = info.match(/redis_version:(\S+)/);
      const version = versionMatch ? versionMatch[1] : null;

      // Parse memory
      const memoryMatch = memoryInfo.match(/used_memory_human:(\S+)/);
      const memory = memoryMatch ? memoryMatch[1] : null;

      return {
        connected: true,
        latency,
        memory,
        version,
      };
    } catch (error) {
      console.error('[Health] Redis check failed:', error);
      return {
        connected: false,
        latency: null,
        memory: null,
        version: null,
      };
    }
  }

  /**
   * Check queue health
   */
  async checkQueues(): Promise<Record<string, QueueHealthCheck>> {
    const results: Record<string, QueueHealthCheck> = {};

    for (const [name, queue] of this.queues) {
      try {
        const counts = await queue.getJobCounts(
          'waiting',
          'active',
          'failed'
        );

        results[name] = {
          active: true,
          waiting: counts.waiting || 0,
          active_jobs: counts.active || 0,
          failed: counts.failed || 0,
          backlogged: (counts.waiting || 0) > 100,
        };
      } catch (error) {
        console.error(`[Health] Queue ${name} check failed:`, error);
        results[name] = {
          active: false,
          waiting: 0,
          active_jobs: 0,
          failed: 0,
          backlogged: false,
        };
      }
    }

    return results;
  }

  /**
   * Check worker health
   */
  checkWorkers(): WorkerHealthCheck {
    const uptime = Math.floor(
      (Date.now() - this.startTime.getTime()) / 1000
    );

    const processing = 0;
    // This is a simplification - in reality we'd track active workers
    // In production, you would iterate through workers and count active jobs

    return {
      running: this.isRunning,
      uptime,
      processing,
    };
  }

  /**
   * Run full health check
   */
  async check(): Promise<HealthCheckResult> {
    const redis = await this.checkRedis();
    const queues = await this.checkQueues();
    const workers = this.checkWorkers();

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    const issues: string[] = [];

    // Check Redis
    if (!redis.connected) {
      status = 'unhealthy';
      issues.push('Redis disconnected');
    } else if (redis.latency && redis.latency > 100) {
      status = 'degraded';
      issues.push(`Redis latency high (${redis.latency}ms)`);
    }

    // Check queues
    for (const [name, queueHealth] of Object.entries(queues)) {
      if (!queueHealth.active) {
        status = 'unhealthy';
        issues.push(`Queue ${name} inactive`);
      } else if (queueHealth.backlogged) {
        if (status === 'healthy') status = 'degraded';
        issues.push(`Queue ${name} backlogged (${queueHealth.waiting} waiting)`);
      }
    }

    // Check workers
    if (!workers.running) {
      status = 'unhealthy';
      issues.push('Workers not running');
    }

    const summary = issues.length > 0
      ? issues.join('; ')
      : 'All systems operational';

    return {
      status,
      timestamp: new Date(),
      checks: {
        redis,
        queues,
        workers,
      },
      summary,
    };
  }

  /**
   * Simple liveness check
   */
  isLive(): boolean {
    return this.isRunning;
  }

  /**
   * Simple readiness check
   */
  async isReady(): Promise<boolean> {
    if (!this.redis) return false;

    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Close health checker
   */
  async close(): Promise<void> {
    this.isRunning = false;
    if (this.redis) {
      this.redis.disconnect();
      this.redis = null;
    }
  }
}

// Singleton instance
export const healthChecker = new HealthChecker();
