/**
 * Worker Metrics Collector
 * Track job processing statistics for monitoring and alerting
 */

import { Queue, QueueEvents } from 'bullmq';
import { redisConnection } from './config.js';
import { QUEUES, QueueName } from './queues.js';

/**
 * Metrics for a single queue
 */
export interface QueueMetrics {
  name: string;
  counts: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  };
  rates: {
    processed: number; // Jobs/minute
    failed: number; // Failures/minute
  };
  timing: {
    avgProcessingTime: number; // ms
    p95ProcessingTime: number; // ms
    lastProcessed: Date | null;
  };
}

/**
 * Aggregate worker metrics
 */
export interface WorkerMetrics {
  queues: Record<string, QueueMetrics>;
  totals: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
  health: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number; // seconds
  startedAt: Date;
}

/**
 * Metrics collector class
 */
export class MetricsCollector {
  private startedAt: Date;
  private queueEvents: Map<string, QueueEvents> = new Map();
  private processingTimes: Map<string, number[]> = new Map();
  private processedCounts: Map<string, number[]> = new Map();
  private failedCounts: Map<string, number[]> = new Map();
  private queues: Map<string, Queue> = new Map();

  constructor() {
    this.startedAt = new Date();
  }

  /**
   * Register a queue for metrics collection
   */
  registerQueue(queue: Queue): void {
    const name = queue.name;
    this.queues.set(name, queue);
    this.processingTimes.set(name, []);
    this.processedCounts.set(name, []);
    this.failedCounts.set(name, []);

    // Set up queue events for real-time metrics
    const events = new QueueEvents(name, { connection: redisConnection });
    this.queueEvents.set(name, events);

    events.on('completed', ({ jobId, returnvalue, prev }) => {
      const processingTime = Date.now() - (prev === 'active' ? Date.now() : 0);
      this.recordProcessingTime(name, processingTime);
      this.incrementProcessed(name);
    });

    events.on('failed', ({ jobId, failedReason, prev }) => {
      this.incrementFailed(name);
    });

    console.log(`[Metrics] Registered queue: ${name}`);
  }

  /**
   * Record job processing time
   */
  private recordProcessingTime(queueName: string, timeMs: number): void {
    const times = this.processingTimes.get(queueName) || [];
    times.push(timeMs);
    // Keep last 1000 measurements
    if (times.length > 1000) times.shift();
    this.processingTimes.set(queueName, times);
  }

  /**
   * Increment processed counter
   */
  private incrementProcessed(queueName: string): void {
    const counts = this.processedCounts.get(queueName) || [];
    counts.push(Date.now());
    // Keep last minute only
    const oneMinuteAgo = Date.now() - 60000;
    const filtered = counts.filter(t => t > oneMinuteAgo);
    this.processedCounts.set(queueName, filtered);
  }

  /**
   * Increment failed counter
   */
  private incrementFailed(queueName: string): void {
    const counts = this.failedCounts.get(queueName) || [];
    counts.push(Date.now());
    // Keep last minute only
    const oneMinuteAgo = Date.now() - 60000;
    const filtered = counts.filter(t => t > oneMinuteAgo);
    this.failedCounts.set(queueName, filtered);
  }

  /**
   * Get metrics for a single queue
   */
  async getQueueMetrics(queueName: string): Promise<QueueMetrics | null> {
    const queue = this.queues.get(queueName);
    if (!queue) return null;

    const counts = await queue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
      'paused'
    );

    const times = this.processingTimes.get(queueName) || [];
    const processedInMinute = this.processedCounts.get(queueName) || [];
    const failedInMinute = this.failedCounts.get(queueName) || [];

    // Calculate timing metrics
    const avgProcessingTime = times.length > 0
      ? times.reduce((a, b) => a + b, 0) / times.length
      : 0;

    const sortedTimes = [...times].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p95ProcessingTime = sortedTimes[p95Index] || 0;

    return {
      name: queueName,
      counts: {
        waiting: counts.waiting || 0,
        active: counts.active || 0,
        completed: counts.completed || 0,
        failed: counts.failed || 0,
        delayed: counts.delayed || 0,
        paused: counts.paused || 0,
      },
      rates: {
        processed: processedInMinute.length,
        failed: failedInMinute.length,
      },
      timing: {
        avgProcessingTime,
        p95ProcessingTime,
        lastProcessed: processedInMinute.length > 0
          ? new Date(processedInMinute[processedInMinute.length - 1])
          : null,
      },
    };
  }

  /**
   * Get all worker metrics
   */
  async getMetrics(): Promise<WorkerMetrics> {
    const queueMetrics: Record<string, QueueMetrics> = {};
    const totals = {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
    };

    for (const queueName of Object.values(QUEUES)) {
      const metrics = await this.getQueueMetrics(queueName);
      if (metrics) {
        queueMetrics[queueName] = metrics;
        totals.waiting += metrics.counts.waiting;
        totals.active += metrics.counts.active;
        totals.completed += metrics.counts.completed;
        totals.failed += metrics.counts.failed;
      }
    }

    // Determine health status
    let health: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check for queue backlogs
    if (totals.waiting > 1000) {
      health = 'degraded';
    }

    // Check for high failure rates
    for (const metrics of Object.values(queueMetrics)) {
      if (metrics.rates.failed > 10) {
        health = 'degraded';
      }
      if (metrics.rates.failed > 50) {
        health = 'unhealthy';
      }
    }

    const uptime = Math.floor((Date.now() - this.startedAt.getTime()) / 1000);

    return {
      queues: queueMetrics,
      totals,
      health,
      uptime,
      startedAt: this.startedAt,
    };
  }

  /**
   * Get health check summary
   */
  async getHealthCheck(): Promise<{
    status: 'ok' | 'warn' | 'error';
    details: Record<string, boolean>;
  }> {
    const details: Record<string, boolean> = {};
    let hasError = false;
    let hasWarning = false;

    for (const [name, queue] of this.queues) {
      try {
        await queue.getJobCounts();
        details[name] = true;
      } catch (error) {
        details[name] = false;
        hasError = true;
      }
    }

    // Check for backed up queues
    const metrics = await this.getMetrics();
    if (metrics.totals.waiting > 100) {
      hasWarning = true;
    }

    return {
      status: hasError ? 'error' : hasWarning ? 'warn' : 'ok',
      details,
    };
  }

  /**
   * Close all queue event listeners
   */
  async close(): Promise<void> {
    const closePromises = Array.from(this.queueEvents.values()).map(events =>
      events.close()
    );
    await Promise.all(closePromises);
    this.queueEvents.clear();
    this.queues.clear();
  }
}

// Singleton instance
export const metricsCollector = new MetricsCollector();
