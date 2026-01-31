/**
 * Events Queue Handler
 * Processes WebSocket event broadcasts to connected agents
 */

import { Worker, Job } from 'bullmq';
import { redisConnection, workerConcurrency } from '../config.js';
import { QUEUES } from '../queues.js';

// Import job implementations
import {
  publishWsJob,
  broadcastJob,
  agentActionJob,
  decisionUpdateJob,
  companyMetricJob,
  setWebSocketServer,
  type EventPublishJobData,
  type BroadcastJobData,
  type AgentActionJobData,
  type DecisionUpdateJobData,
  type CompanyMetricJobData,
} from '../jobs/events-publish-ws.js';

/**
 * Event handlers for each event type
 * Maps job names to their implementations
 */
const eventHandlers: Record<string, (job: Job) => Promise<void>> = {
  // WebSocket publishing jobs
  'publish.ws': async (job: Job<EventPublishJobData>) => {
    await publishWsJob(job);
  },

  'broadcast': async (job: Job<BroadcastJobData>) => {
    await broadcastJob(job);
  },

  'agent.action': async (job: Job<AgentActionJobData>) => {
    await agentActionJob(job);
  },

  'decision.update': async (job: Job<DecisionUpdateJobData>) => {
    await decisionUpdateJob(job);
  },

  'company.metric': async (job: Job<CompanyMetricJobData>) => {
    await companyMetricJob(job);
  },
};

/**
 * Create the events worker
 */
export function createEventsWorker(): Worker {
  const worker = new Worker(
    QUEUES.EVENTS,
    async (job: Job) => {
      const handler = eventHandlers[job.name];
      if (!handler) {
        console.warn(`[Events] Unknown event type: ${job.name}`);
        return;
      }

      console.log(`[Events] Processing ${job.name}:${job.id}`);
      await handler(job);
    },
    {
      connection: redisConnection,
      concurrency: workerConcurrency.events,
      limiter: {
        max: 100,
        duration: 1000, // 100 events per second
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Events] Job ${job.id} completed`);
  });

  worker.on('failed', (job, error) => {
    console.error(`[Events] Job ${job?.id} failed:`, error.message);
  });

  console.log('[Events] Worker started');
  return worker;
}

// Re-export WebSocket server setter for initialization
export { setWebSocketServer };
