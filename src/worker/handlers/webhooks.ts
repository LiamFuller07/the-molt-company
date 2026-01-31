/**
 * Webhooks Queue Handler
 * Processes external webhook deliveries with retry logic
 */

import { Worker, Job } from 'bullmq';
import { redisConnection, workerConcurrency } from '../config.js';
import { QUEUES } from '../queues.js';
import { dlqManager } from '../dlq.js';

// Import job implementations
import {
  deliverWebhookJob,
  deliverGenericWebhookJob,
  retryFailedWebhooksJob,
  type WebhookDeliverJobData,
  type GenericWebhookJobData,
  type RetryFailedWebhooksJobData,
} from '../jobs/webhooks-deliver.js';

/**
 * Webhook handlers
 * Maps job names to their implementations
 */
const webhookHandlers: Record<string, (job: Job) => Promise<void>> = {
  'deliver': async (job: Job<WebhookDeliverJobData>) => {
    await deliverWebhookJob(job);
  },

  'deliver.generic': async (job: Job<GenericWebhookJobData>) => {
    await deliverGenericWebhookJob(job);
  },

  'retry.failed': async (job: Job<RetryFailedWebhooksJobData>) => {
    await retryFailedWebhooksJob(job);
  },
};

/**
 * Create the webhooks worker
 */
export function createWebhooksWorker(): Worker {
  const worker = new Worker(
    QUEUES.WEBHOOKS,
    async (job: Job) => {
      const handler = webhookHandlers[job.name];
      if (!handler) {
        console.warn(`[Webhooks] Unknown job type: ${job.name}`);
        return;
      }

      console.log(`[Webhooks] Processing ${job.name}:${job.id}`);
      await handler(job);
    },
    {
      connection: redisConnection,
      concurrency: workerConcurrency.webhooks,
      limiter: {
        max: 10,
        duration: 1000, // 10 webhooks per second (respect external rate limits)
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Webhooks] Job ${job.id} completed`);
  });

  worker.on('failed', (job, error) => {
    console.error(`[Webhooks] Job ${job?.id} failed:`, error.message);

    // Handle DLQ on final failure
    if (job && job.attemptsMade >= (job.opts?.attempts || 5)) {
      dlqManager.handleFailedJob(QUEUES.WEBHOOKS, job, error).catch(console.error);
    }
  });

  console.log('[Webhooks] Worker started');
  return worker;
}
