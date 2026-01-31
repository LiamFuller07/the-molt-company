/**
 * Dead Letter Queue (DLQ) Handler
 * Handles jobs that have exhausted all retries
 */

import { Job, Queue } from 'bullmq';
import { redisConnection } from './config.js';

/**
 * DLQ queue name suffix
 */
const DLQ_SUFFIX = '-dlq';

/**
 * Failed job record stored in DLQ
 */
export interface FailedJobRecord {
  id: string;
  queue: string;
  name: string;
  data: unknown;
  failedReason: string;
  stacktrace: string[];
  attemptsMade: number;
  failedAt: Date;
  processedAt?: Date;
  resolution?: 'retried' | 'ignored' | 'fixed';
}

/**
 * DLQ Manager for handling failed jobs
 */
export class DLQManager {
  private dlqQueues: Map<string, Queue> = new Map();

  /**
   * Get or create DLQ for a source queue
   */
  getDLQ(sourceQueueName: string): Queue {
    const dlqName = `${sourceQueueName}${DLQ_SUFFIX}`;
    let dlq = this.dlqQueues.get(dlqName);

    if (!dlq) {
      dlq = new Queue(dlqName, {
        connection: redisConnection,
        defaultJobOptions: {
          removeOnComplete: false, // Keep all DLQ jobs
          removeOnFail: false,
        },
      });
      this.dlqQueues.set(dlqName, dlq);
    }

    return dlq;
  }

  /**
   * Handle a failed job by moving it to DLQ
   */
  async handleFailedJob(
    sourceQueueName: string,
    job: Job,
    error: Error
  ): Promise<void> {
    const dlq = this.getDLQ(sourceQueueName);

    const failedRecord: FailedJobRecord = {
      id: job.id || 'unknown',
      queue: sourceQueueName,
      name: job.name,
      data: job.data,
      failedReason: error.message,
      stacktrace: error.stack?.split('\n') || [],
      attemptsMade: job.attemptsMade,
      failedAt: new Date(),
    };

    // Add to DLQ
    await dlq.add('failed-job', failedRecord, {
      jobId: `${sourceQueueName}-${job.id}-${Date.now()}`,
    });

    console.error(
      `[DLQ] Job ${job.name}:${job.id} from ${sourceQueueName} moved to DLQ`,
      {
        reason: error.message,
        attempts: job.attemptsMade,
      }
    );

    // Trigger alert
    await this.sendAlert(sourceQueueName, failedRecord);
  }

  /**
   * Send alert for DLQ job
   */
  private async sendAlert(
    queueName: string,
    record: FailedJobRecord
  ): Promise<void> {
    // Log to console with high visibility
    console.error('='.repeat(60));
    console.error('[DLQ ALERT] Job permanently failed');
    console.error('='.repeat(60));
    console.error(`Queue: ${queueName}`);
    console.error(`Job: ${record.name} (${record.id})`);
    console.error(`Reason: ${record.failedReason}`);
    console.error(`Attempts: ${record.attemptsMade}`);
    console.error(`Time: ${record.failedAt.toISOString()}`);
    console.error('='.repeat(60));

    // In production, you would integrate with:
    // - Slack/Discord notifications
    // - PagerDuty/Opsgenie
    // - Email alerts
    // - Custom webhook

    // TODO: Implement actual alerting
    // await sendSlackAlert(record);
    // await sendPagerDuty(record);
  }

  /**
   * Retry a job from DLQ
   */
  async retryJob(
    dlqJobId: string,
    sourceQueueName: string,
    targetQueue: Queue
  ): Promise<void> {
    const dlq = this.getDLQ(sourceQueueName);
    const dlqJob = await dlq.getJob(dlqJobId);

    if (!dlqJob) {
      throw new Error(`DLQ job ${dlqJobId} not found`);
    }

    const record = dlqJob.data as FailedJobRecord;

    // Re-add to original queue
    await targetQueue.add(record.name, record.data, {
      attempts: 3, // Fresh retry attempts
    });

    // Mark as retried in DLQ
    await dlqJob.updateData({
      ...record,
      processedAt: new Date(),
      resolution: 'retried',
    });

    console.log(
      `[DLQ] Job ${record.name}:${record.id} retried from DLQ`
    );
  }

  /**
   * Mark a DLQ job as ignored
   */
  async ignoreJob(
    dlqJobId: string,
    sourceQueueName: string
  ): Promise<void> {
    const dlq = this.getDLQ(sourceQueueName);
    const dlqJob = await dlq.getJob(dlqJobId);

    if (!dlqJob) {
      throw new Error(`DLQ job ${dlqJobId} not found`);
    }

    const record = dlqJob.data as FailedJobRecord;

    await dlqJob.updateData({
      ...record,
      processedAt: new Date(),
      resolution: 'ignored',
    });

    console.log(
      `[DLQ] Job ${record.name}:${record.id} marked as ignored`
    );
  }

  /**
   * Get all unprocessed DLQ jobs for a queue
   */
  async getUnprocessedJobs(
    sourceQueueName: string,
    limit = 100
  ): Promise<FailedJobRecord[]> {
    const dlq = this.getDLQ(sourceQueueName);
    const jobs = await dlq.getJobs(['waiting', 'completed'], 0, limit);

    return jobs
      .map(job => job.data as FailedJobRecord)
      .filter(record => !record.processedAt);
  }

  /**
   * Get DLQ statistics
   */
  async getStats(sourceQueueName: string): Promise<{
    total: number;
    unprocessed: number;
    retried: number;
    ignored: number;
  }> {
    const dlq = this.getDLQ(sourceQueueName);
    const jobs = await dlq.getJobs(['waiting', 'completed']);

    let unprocessed = 0;
    let retried = 0;
    let ignored = 0;

    for (const job of jobs) {
      const record = job.data as FailedJobRecord;
      if (!record.processedAt) {
        unprocessed++;
      } else if (record.resolution === 'retried') {
        retried++;
      } else if (record.resolution === 'ignored') {
        ignored++;
      }
    }

    return {
      total: jobs.length,
      unprocessed,
      retried,
      ignored,
    };
  }

  /**
   * Close all DLQ connections
   */
  async close(): Promise<void> {
    const closePromises = Array.from(this.dlqQueues.values()).map(dlq =>
      dlq.close()
    );
    await Promise.all(closePromises);
    this.dlqQueues.clear();
  }
}

// Singleton instance
export const dlqManager = new DLQManager();
