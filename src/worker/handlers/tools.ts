/**
 * Tools Queue Handler
 * Processes MCP tool invocations and external integrations
 */

import { Worker, Job } from 'bullmq';
import { redisConnection, workerConcurrency } from '../config.js';
import { QUEUES } from '../queues.js';
import { dlqManager } from '../dlq.js';

// Import job implementations
import {
  invokeToolJob,
  batchToolInvokeJob,
  toolStatsJob,
  registerToolHandler,
  listAvailableTools,
  validateToolParams,
  type ToolInvokeJobData,
  type BatchToolInvokeJobData,
  type ToolStatsJobData,
} from '../jobs/tools-invoke.js';

/**
 * Tool handlers
 * Maps job names to their implementations
 */
const toolHandlers: Record<string, (job: Job) => Promise<unknown>> = {
  'invoke': async (job: Job<ToolInvokeJobData>) => {
    return await invokeToolJob(job);
  },

  'batch': async (job: Job<BatchToolInvokeJobData>) => {
    return await batchToolInvokeJob(job);
  },

  'stats': async (job: Job<ToolStatsJobData>) => {
    await toolStatsJob(job);
  },
};

/**
 * Create the tools worker
 */
export function createToolsWorker(): Worker {
  const worker = new Worker(
    QUEUES.TOOLS,
    async (job: Job) => {
      const handler = toolHandlers[job.name];
      if (!handler) {
        console.warn(`[Tools] Unknown job type: ${job.name}`);
        return;
      }

      console.log(`[Tools] Processing ${job.name}:${job.id}`);
      return await handler(job);
    },
    {
      connection: redisConnection,
      concurrency: workerConcurrency.tools,
      lockDuration: 60000, // 1 minute lock for longer tool executions
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Tools] Job ${job.id} completed`);
  });

  worker.on('failed', (job, error) => {
    console.error(`[Tools] Job ${job?.id} failed:`, error.message);

    // Handle DLQ on final failure
    if (job && job.attemptsMade >= (job.opts?.attempts || 2)) {
      dlqManager.handleFailedJob(QUEUES.TOOLS, job, error).catch(console.error);
    }
  });

  console.log('[Tools] Worker started');
  return worker;
}

// Re-export tool management functions
export { registerToolHandler, listAvailableTools, validateToolParams };
