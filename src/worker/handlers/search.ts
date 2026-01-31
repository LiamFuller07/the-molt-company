/**
 * Search Queue Handler
 * Processes embedding generation and search indexing
 */

import { Worker, Job } from 'bullmq';
import { redisConnection, workerConcurrency } from '../config.js';
import { QUEUES } from '../queues.js';
import { createProgressProcessor } from '../processor.js';

// Import job implementations
import {
  embedContentJob,
  embedDocumentJob,
  reindexAgentJob,
  reindexCompanyJob,
  batchEmbedJob,
  type EmbedContentJobData,
  type EmbedDocumentJobData,
  type ReindexJobData,
  type BatchEmbedJobData,
} from '../jobs/search-embed.js';

/**
 * Search handlers
 * Maps job names to their implementations
 */
const searchHandlers: Record<string, (job: Job) => Promise<void>> = {
  'embed.content': async (job: Job<EmbedContentJobData>) => {
    await embedContentJob(job);
  },

  'embed.document': async (job: Job<EmbedDocumentJobData>) => {
    await embedDocumentJob(job);
  },

  'reindex.agent': async (job: Job<ReindexJobData>) => {
    await reindexAgentJob(job);
  },

  'reindex.company': async (job: Job<ReindexJobData>) => {
    await reindexCompanyJob(job);
  },

  'batch.embed': async (job: Job<BatchEmbedJobData>) => {
    await batchEmbedJob(job);
  },
};

/**
 * Create the search worker
 */
export function createSearchWorker(): Worker {
  const worker = new Worker(
    QUEUES.SEARCH,
    async (job: Job) => {
      const handler = searchHandlers[job.name];
      if (!handler) {
        console.warn(`[Search] Unknown job type: ${job.name}`);
        return;
      }

      console.log(`[Search] Processing ${job.name}:${job.id}`);
      await handler(job);
    },
    {
      connection: redisConnection,
      concurrency: workerConcurrency.search,
      limiter: {
        max: 5,
        duration: 1000, // 5 embedding requests per second (API rate limits)
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Search] Job ${job.id} completed`);
  });

  worker.on('failed', (job, error) => {
    console.error(`[Search] Job ${job?.id} failed:`, error.message);
  });

  console.log('[Search] Worker started');
  return worker;
}

/**
 * Create a batch reindex worker for large-scale reindexing
 */
export function createBatchSearchWorker(): Worker {
  const processor = createProgressProcessor<{ documentIds: string[] }, void>(
    `${QUEUES.SEARCH}-batch`,
    async (data, context, updateProgress) => {
      const { documentIds } = data;
      const total = documentIds.length;

      console.log(`[Search] Batch reindex of ${total} documents`);

      for (let i = 0; i < total; i++) {
        const docId = documentIds[i];

        // Use the embed content job for each document
        await embedContentJob({
          data: { type: 'task', id: docId },
        } as any);

        await updateProgress(Math.floor(((i + 1) / total) * 100));

        // Rate limiting
        if ((i + 1) % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`[Search] Batch reindex completed: ${total} documents`);
    }
  );

  const worker = new Worker(`${QUEUES.SEARCH}-batch`, processor, {
    connection: redisConnection,
    concurrency: 1, // Only one batch job at a time
  });

  console.log('[Search] Batch worker started');
  return worker;
}
