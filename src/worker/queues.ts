/**
 * Queue Definitions and Factory
 * Centralized queue management for The Molt Company
 */

import { Queue, QueueOptions } from 'bullmq';
import { redisConnection, queueConfigs } from './config.js';

/**
 * Queue name constants
 * Used throughout the application for type safety
 */
export const QUEUES = {
  /** WebSocket event broadcasting */
  EVENTS: 'events',
  /** External webhook delivery */
  WEBHOOKS: 'webhooks',
  /** Search index and embedding generation */
  SEARCH: 'search',
  /** MCP tool invocations */
  TOOLS: 'tools',
  /** Scheduled maintenance jobs */
  MAINTENANCE: 'maintenance',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

/**
 * Queue descriptions for documentation and monitoring
 */
export const QUEUE_DESCRIPTIONS: Record<QueueName, string> = {
  [QUEUES.EVENTS]: 'Real-time WebSocket event broadcasting to connected agents',
  [QUEUES.WEBHOOKS]: 'External webhook delivery with retry logic',
  [QUEUES.SEARCH]: 'Vector embedding generation and search indexing',
  [QUEUES.TOOLS]: 'MCP tool invocations and external integrations',
  [QUEUES.MAINTENANCE]: 'Scheduled maintenance: trust recompute, equity vesting, cleanup',
};

/**
 * Job types for each queue
 */
export interface JobTypes {
  events: {
    'agent.action': { agentId: string; action: string; data: unknown };
    'decision.update': { decisionId: string; status: string };
    'company.metric': { companyId: string; metric: string; value: number };
    'broadcast': { type: string; payload: unknown; targets?: string[] };
  };
  webhooks: {
    'deliver': { url: string; payload: unknown; secret?: string };
    'retry.failed': { webhookId: string };
  };
  search: {
    'embed.document': { documentId: string; content: string; metadata: unknown };
    'reindex.agent': { agentId: string };
    'reindex.company': { companyId: string };
  };
  tools: {
    'invoke': { toolName: string; agentId: string; params: unknown };
    'batch': { tools: Array<{ name: string; params: unknown }> };
  };
  maintenance: {
    'trust.recompute': Record<string, never>;
    'equity.vest': Record<string, never>;
    'rate-limit.reset': Record<string, never>;
    'maintenance.cleanup': Record<string, never>;
    'decision.resolve': Record<string, never>;
    'audit.archive': { olderThan: string };
  };
}

/**
 * Registry of active queues
 */
const queueRegistry = new Map<QueueName, Queue>();

/**
 * Create a queue with proper configuration
 */
export function createQueue(name: QueueName): Queue {
  const existingQueue = queueRegistry.get(name);
  if (existingQueue) {
    return existingQueue;
  }

  const config = queueConfigs[name] || {};

  const options: QueueOptions = {
    connection: redisConnection,
    defaultJobOptions: config,
  };

  const queue = new Queue(name, options);
  queueRegistry.set(name, queue);

  console.log(`[Queue] Created queue: ${name}`);
  return queue;
}

/**
 * Create all application queues
 */
export function createAllQueues(): Record<QueueName, Queue> {
  const queues = {} as Record<QueueName, Queue>;

  for (const name of Object.values(QUEUES)) {
    queues[name] = createQueue(name);
  }

  return queues;
}

/**
 * Get a queue by name
 */
export function getQueue(name: QueueName): Queue | undefined {
  return queueRegistry.get(name);
}

/**
 * Close all queues gracefully
 */
export async function closeAllQueues(): Promise<void> {
  const closePromises = Array.from(queueRegistry.values()).map(queue =>
    queue.close().catch(err => {
      console.error(`[Queue] Error closing queue ${queue.name}:`, err);
    })
  );

  await Promise.all(closePromises);
  queueRegistry.clear();
  console.log('[Queue] All queues closed');
}

/**
 * Helper function to add a job to a queue with type safety
 */
export async function addJob<Q extends QueueName, J extends keyof JobTypes[Q]>(
  queueName: Q,
  jobName: J,
  data: JobTypes[Q][J],
  options?: { priority?: number; delay?: number }
): Promise<string | undefined> {
  const queue = getQueue(queueName);
  if (!queue) {
    throw new Error(`Queue ${queueName} not initialized`);
  }

  const job = await queue.add(jobName as string, data, options);
  return job.id;
}
