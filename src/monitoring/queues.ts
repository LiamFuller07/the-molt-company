/**
 * Queue Monitoring
 * Phase 22: Monitor BullMQ queue health and metrics
 */

import { Queue, QueueEvents } from 'bullmq';
import { redisConnection } from '../worker/config.js';
import { QUEUES, QueueName, getQueue, createAllQueues } from '../worker/queues.js';

/**
 * Queue metrics for a single queue
 */
export interface QueueMetrics {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
  // Derived metrics
  totalPending: number;
  healthStatus: 'healthy' | 'warning' | 'critical';
}

/**
 * Aggregated metrics for all queues
 */
export interface AllQueueMetrics {
  queues: Record<string, QueueMetrics>;
  totals: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
  healthStatus: 'healthy' | 'warning' | 'critical';
  timestamp: Date;
}

/**
 * DLQ (Dead Letter Queue) metrics
 */
export interface DLQMetrics {
  queueName: string;
  failedCount: number;
  oldestFailedJob: Date | null;
  recentFailures: Array<{
    jobId: string;
    failedAt: Date;
    reason: string;
    attemptsMade: number;
  }>;
}

/**
 * Thresholds for queue health
 */
const THRESHOLDS = {
  waitingWarning: 50,
  waitingCritical: 200,
  failedWarning: 10,
  failedCritical: 50,
  activeWarning: 20,
  activeCritical: 100,
};

/**
 * Get metrics for a single queue
 */
export async function getQueueMetrics(queueName: QueueName): Promise<QueueMetrics | null> {
  const queue = getQueue(queueName);
  if (!queue) {
    return null;
  }

  try {
    const counts = await queue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
      'paused'
    );

    const waiting = counts.waiting || 0;
    const active = counts.active || 0;
    const failed = counts.failed || 0;

    // Determine health status
    let healthStatus: QueueMetrics['healthStatus'] = 'healthy';

    if (
      waiting >= THRESHOLDS.waitingCritical ||
      failed >= THRESHOLDS.failedCritical ||
      active >= THRESHOLDS.activeCritical
    ) {
      healthStatus = 'critical';
    } else if (
      waiting >= THRESHOLDS.waitingWarning ||
      failed >= THRESHOLDS.failedWarning ||
      active >= THRESHOLDS.activeWarning
    ) {
      healthStatus = 'warning';
    }

    return {
      name: queueName,
      waiting,
      active,
      completed: counts.completed || 0,
      failed,
      delayed: counts.delayed || 0,
      paused: counts.paused || 0,
      totalPending: waiting + active + (counts.delayed || 0),
      healthStatus,
    };
  } catch (error) {
    console.error(`[Queue Monitoring] Failed to get metrics for ${queueName}:`, error);
    return null;
  }
}

/**
 * Get metrics for all queues
 */
export async function getAllQueueMetrics(): Promise<AllQueueMetrics> {
  const metrics: Record<string, QueueMetrics> = {};
  const totals = {
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
  };

  // Get metrics for each queue
  for (const queueName of Object.values(QUEUES)) {
    const queueMetrics = await getQueueMetrics(queueName);
    if (queueMetrics) {
      metrics[queueName] = queueMetrics;
      totals.waiting += queueMetrics.waiting;
      totals.active += queueMetrics.active;
      totals.completed += queueMetrics.completed;
      totals.failed += queueMetrics.failed;
      totals.delayed += queueMetrics.delayed;
    }
  }

  // Determine overall health status
  let healthStatus: AllQueueMetrics['healthStatus'] = 'healthy';

  for (const queueMetrics of Object.values(metrics)) {
    if (queueMetrics.healthStatus === 'critical') {
      healthStatus = 'critical';
      break;
    } else if (queueMetrics.healthStatus === 'warning' && healthStatus !== 'critical') {
      healthStatus = 'warning';
    }
  }

  return {
    queues: metrics,
    totals,
    healthStatus,
    timestamp: new Date(),
  };
}

/**
 * Get DLQ (failed jobs) size for a queue
 */
export async function getDLQSize(queueName: QueueName): Promise<number> {
  const queue = getQueue(queueName);
  if (!queue) {
    return 0;
  }

  try {
    const counts = await queue.getJobCounts('failed');
    return counts.failed || 0;
  } catch (error) {
    console.error(`[Queue Monitoring] Failed to get DLQ size for ${queueName}:`, error);
    return 0;
  }
}

/**
 * Get detailed DLQ metrics for a queue
 */
export async function getDLQMetrics(queueName: QueueName, limit = 10): Promise<DLQMetrics> {
  const queue = getQueue(queueName);
  if (!queue) {
    return {
      queueName,
      failedCount: 0,
      oldestFailedJob: null,
      recentFailures: [],
    };
  }

  try {
    const failedJobs = await queue.getFailed(0, limit);
    const failedCount = await getDLQSize(queueName);

    const recentFailures = failedJobs.map((job) => ({
      jobId: job.id || 'unknown',
      failedAt: job.finishedOn ? new Date(job.finishedOn) : new Date(),
      reason: job.failedReason || 'Unknown error',
      attemptsMade: job.attemptsMade,
    }));

    // Get oldest failed job
    let oldestFailedJob: Date | null = null;
    if (failedCount > 0) {
      const [oldestJob] = await queue.getFailed(failedCount - 1, failedCount);
      if (oldestJob?.finishedOn) {
        oldestFailedJob = new Date(oldestJob.finishedOn);
      }
    }

    return {
      queueName,
      failedCount,
      oldestFailedJob,
      recentFailures,
    };
  } catch (error) {
    console.error(`[Queue Monitoring] Failed to get DLQ metrics for ${queueName}:`, error);
    return {
      queueName,
      failedCount: 0,
      oldestFailedJob: null,
      recentFailures: [],
    };
  }
}

/**
 * Get all DLQ metrics
 */
export async function getAllDLQMetrics(): Promise<Record<string, DLQMetrics>> {
  const metrics: Record<string, DLQMetrics> = {};

  for (const queueName of Object.values(QUEUES)) {
    metrics[queueName] = await getDLQMetrics(queueName);
  }

  return metrics;
}

/**
 * Clear failed jobs from a queue (retry or remove)
 */
export async function clearDLQ(
  queueName: QueueName,
  action: 'retry' | 'remove' = 'remove'
): Promise<number> {
  const queue = getQueue(queueName);
  if (!queue) {
    return 0;
  }

  try {
    const failedJobs = await queue.getFailed();
    let processed = 0;

    for (const job of failedJobs) {
      if (action === 'retry') {
        await job.retry();
      } else {
        await job.remove();
      }
      processed++;
    }

    console.log(`[Queue Monitoring] ${action === 'retry' ? 'Retried' : 'Removed'} ${processed} failed jobs from ${queueName}`);
    return processed;
  } catch (error) {
    console.error(`[Queue Monitoring] Failed to clear DLQ for ${queueName}:`, error);
    return 0;
  }
}

/**
 * Get queue processing rate (jobs per minute)
 */
export async function getQueueRate(queueName: QueueName): Promise<{
  completedPerMinute: number;
  failedPerMinute: number;
}> {
  const queue = getQueue(queueName);
  if (!queue) {
    return { completedPerMinute: 0, failedPerMinute: 0 };
  }

  try {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Get recent completed jobs
    const completedJobs = await queue.getCompleted(0, 100);
    const recentCompleted = completedJobs.filter(
      (job) => job.finishedOn && job.finishedOn >= oneMinuteAgo
    );

    // Get recent failed jobs
    const failedJobs = await queue.getFailed(0, 100);
    const recentFailed = failedJobs.filter(
      (job) => job.finishedOn && job.finishedOn >= oneMinuteAgo
    );

    return {
      completedPerMinute: recentCompleted.length,
      failedPerMinute: recentFailed.length,
    };
  } catch (error) {
    console.error(`[Queue Monitoring] Failed to get rate for ${queueName}:`, error);
    return { completedPerMinute: 0, failedPerMinute: 0 };
  }
}

/**
 * Pause a queue
 */
export async function pauseQueue(queueName: QueueName): Promise<boolean> {
  const queue = getQueue(queueName);
  if (!queue) {
    return false;
  }

  try {
    await queue.pause();
    console.log(`[Queue Monitoring] Paused queue: ${queueName}`);
    return true;
  } catch (error) {
    console.error(`[Queue Monitoring] Failed to pause ${queueName}:`, error);
    return false;
  }
}

/**
 * Resume a paused queue
 */
export async function resumeQueue(queueName: QueueName): Promise<boolean> {
  const queue = getQueue(queueName);
  if (!queue) {
    return false;
  }

  try {
    await queue.resume();
    console.log(`[Queue Monitoring] Resumed queue: ${queueName}`);
    return true;
  } catch (error) {
    console.error(`[Queue Monitoring] Failed to resume ${queueName}:`, error);
    return false;
  }
}

/**
 * Drain a queue (remove all jobs)
 */
export async function drainQueue(
  queueName: QueueName,
  delayed = true
): Promise<boolean> {
  const queue = getQueue(queueName);
  if (!queue) {
    return false;
  }

  try {
    await queue.drain(delayed);
    console.log(`[Queue Monitoring] Drained queue: ${queueName}`);
    return true;
  } catch (error) {
    console.error(`[Queue Monitoring] Failed to drain ${queueName}:`, error);
    return false;
  }
}

/**
 * Check if queues are healthy
 */
export async function areQueuesHealthy(): Promise<{
  healthy: boolean;
  issues: string[];
}> {
  const metrics = await getAllQueueMetrics();
  const issues: string[] = [];

  for (const [name, queueMetrics] of Object.entries(metrics.queues)) {
    if (queueMetrics.healthStatus === 'critical') {
      issues.push(`Queue ${name} is critical: waiting=${queueMetrics.waiting}, failed=${queueMetrics.failed}`);
    } else if (queueMetrics.healthStatus === 'warning') {
      issues.push(`Queue ${name} has warnings: waiting=${queueMetrics.waiting}, failed=${queueMetrics.failed}`);
    }
  }

  return {
    healthy: issues.length === 0,
    issues,
  };
}

export default {
  getQueueMetrics,
  getAllQueueMetrics,
  getDLQSize,
  getDLQMetrics,
  getAllDLQMetrics,
  clearDLQ,
  getQueueRate,
  pauseQueue,
  resumeQueue,
  drainQueue,
  areQueuesHealthy,
};
