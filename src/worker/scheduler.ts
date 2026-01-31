/**
 * Scheduled Jobs
 * Cron-based recurring jobs for maintenance tasks
 */

import { Queue } from 'bullmq';
import { QUEUES, QueueName } from './queues.js';

/**
 * Scheduled job definition
 */
export interface ScheduledJob {
  name: string;
  queue: QueueName;
  cron: string;
  description: string;
  data?: Record<string, unknown>;
  options?: {
    priority?: number;
    attempts?: number;
  };
}

/**
 * All scheduled jobs for The Molt Company
 */
export const SCHEDULED_JOBS: ScheduledJob[] = [
  // Trust System
  {
    name: 'trust.recompute',
    queue: QUEUES.MAINTENANCE,
    cron: '0 * * * *', // Every hour
    description: 'Recompute trust scores for all agents based on recent actions',
  },
  {
    name: 'trust.decay',
    queue: QUEUES.MAINTENANCE,
    cron: '0 0 * * *', // Daily at midnight
    description: 'Apply trust score decay for inactive agents',
  },

  // Equity System
  {
    name: 'equity.vest',
    queue: QUEUES.MAINTENANCE,
    cron: '0 0 * * *', // Daily at midnight
    description: 'Process daily equity vesting for all agents',
  },
  {
    name: 'equity.snapshot',
    queue: QUEUES.MAINTENANCE,
    cron: '0 0 1 * *', // First of each month
    description: 'Create monthly equity distribution snapshot',
  },

  // Rate Limits
  {
    name: 'rate-limit.reset',
    queue: QUEUES.MAINTENANCE,
    cron: '0 0 * * *', // Daily at midnight
    description: 'Reset daily rate limits for all agents',
  },

  // Decision System
  {
    name: 'decision.resolve',
    queue: QUEUES.MAINTENANCE,
    cron: '0 * * * *', // Every hour
    description: 'Check and resolve any decisions past their deadline',
  },
  {
    name: 'decision.reminder',
    queue: QUEUES.MAINTENANCE,
    cron: '0 9 * * *', // Daily at 9 AM
    description: 'Send reminders for pending decisions',
  },

  // Cleanup & Maintenance
  {
    name: 'maintenance.cleanup',
    queue: QUEUES.MAINTENANCE,
    cron: '0 3 * * *', // Daily at 3 AM
    description: 'Clean up old audit logs, completed jobs, and expired data',
  },
  {
    name: 'maintenance.optimize',
    queue: QUEUES.MAINTENANCE,
    cron: '0 4 * * 0', // Weekly on Sunday at 4 AM
    description: 'Optimize database and search indices',
  },

  // Search & Embeddings
  {
    name: 'search.reindex',
    queue: QUEUES.SEARCH,
    cron: '0 2 * * *', // Daily at 2 AM
    description: 'Rebuild search indices for stale documents',
  },

  // Metrics & Reporting
  {
    name: 'metrics.aggregate',
    queue: QUEUES.MAINTENANCE,
    cron: '*/15 * * * *', // Every 15 minutes
    description: 'Aggregate and store metrics for dashboards',
  },
  {
    name: 'metrics.daily-report',
    queue: QUEUES.MAINTENANCE,
    cron: '0 8 * * *', // Daily at 8 AM
    description: 'Generate daily activity report',
  },

  // Webhooks
  {
    name: 'webhooks.cleanup',
    queue: QUEUES.WEBHOOKS,
    cron: '0 5 * * *', // Daily at 5 AM
    description: 'Clean up failed webhook deliveries older than 7 days',
  },
];

/**
 * Set up all scheduled jobs
 */
export async function setupScheduledJobs(
  queues: Record<QueueName, Queue>
): Promise<void> {
  console.log('[Scheduler] Setting up scheduled jobs...');

  for (const job of SCHEDULED_JOBS) {
    const queue = queues[job.queue];
    if (!queue) {
      console.warn(`[Scheduler] Queue ${job.queue} not found for job ${job.name}`);
      continue;
    }

    try {
      // Remove existing repeatable job if it exists
      const existing = await queue.getRepeatableJobs();
      const existingJob = existing.find(j => j.name === job.name);
      if (existingJob) {
        await queue.removeRepeatableByKey(existingJob.key);
      }

      // Add the scheduled job
      await queue.add(
        job.name,
        job.data || {},
        {
          repeat: { pattern: job.cron },
          ...job.options,
        }
      );

      console.log(`[Scheduler] Registered: ${job.name} (${job.cron})`);
    } catch (error) {
      console.error(`[Scheduler] Failed to register ${job.name}:`, error);
    }
  }

  console.log(`[Scheduler] Registered ${SCHEDULED_JOBS.length} scheduled jobs`);
}

/**
 * Remove all scheduled jobs
 */
export async function removeScheduledJobs(
  queues: Record<QueueName, Queue>
): Promise<void> {
  console.log('[Scheduler] Removing scheduled jobs...');

  for (const job of SCHEDULED_JOBS) {
    const queue = queues[job.queue];
    if (!queue) continue;

    try {
      const existing = await queue.getRepeatableJobs();
      const existingJob = existing.find(j => j.name === job.name);
      if (existingJob) {
        await queue.removeRepeatableByKey(existingJob.key);
        console.log(`[Scheduler] Removed: ${job.name}`);
      }
    } catch (error) {
      console.error(`[Scheduler] Failed to remove ${job.name}:`, error);
    }
  }
}

/**
 * Get list of scheduled jobs with next run times
 */
export async function getScheduledJobsStatus(
  queues: Record<QueueName, Queue>
): Promise<Array<{
  name: string;
  queue: string;
  cron: string;
  description: string;
  nextRun: Date | null;
}>> {
  const status = [];

  for (const job of SCHEDULED_JOBS) {
    const queue = queues[job.queue];
    if (!queue) {
      status.push({
        name: job.name,
        queue: job.queue,
        cron: job.cron,
        description: job.description,
        nextRun: null,
      });
      continue;
    }

    try {
      const existing = await queue.getRepeatableJobs();
      const existingJob = existing.find(j => j.name === job.name);

      status.push({
        name: job.name,
        queue: job.queue,
        cron: job.cron,
        description: job.description,
        nextRun: existingJob?.next ? new Date(existingJob.next) : null,
      });
    } catch {
      status.push({
        name: job.name,
        queue: job.queue,
        cron: job.cron,
        description: job.description,
        nextRun: null,
      });
    }
  }

  return status;
}

/**
 * Trigger a scheduled job to run immediately
 */
export async function triggerJob(
  queues: Record<QueueName, Queue>,
  jobName: string
): Promise<string | undefined> {
  const job = SCHEDULED_JOBS.find(j => j.name === jobName);
  if (!job) {
    throw new Error(`Scheduled job ${jobName} not found`);
  }

  const queue = queues[job.queue];
  if (!queue) {
    throw new Error(`Queue ${job.queue} not found`);
  }

  const addedJob = await queue.add(
    job.name,
    { ...job.data, triggered: true, triggeredAt: new Date().toISOString() },
    { ...job.options }
  );

  console.log(`[Scheduler] Triggered job ${jobName} manually (${addedJob.id})`);
  return addedJob.id;
}
