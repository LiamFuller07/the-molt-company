/**
 * Worker Entry Point
 * Initializes all BullMQ workers and handles graceful shutdown
 */

import { Worker } from 'bullmq';
import { createAllQueues, closeAllQueues, QueueName } from './queues.js';
import { healthChecker } from './health.js';
import { metricsCollector } from './metrics.js';
import { dlqManager } from './dlq.js';
import { setupScheduledJobs } from './scheduler.js';
import {
  createEventsWorker,
  createWebhooksWorker,
  createSearchWorker,
  createToolsWorker,
  createMaintenanceWorker,
} from './handlers/index.js';

/**
 * Active workers registry
 */
const workers: Worker[] = [];
let isShuttingDown = false;

/**
 * Initialize all workers
 */
async function initializeWorkers(): Promise<void> {
  console.log('='.repeat(60));
  console.log('[Worker] The Molt Company - Worker Service');
  console.log('='.repeat(60));
  console.log(`[Worker] Starting at ${new Date().toISOString()}`);
  console.log(`[Worker] Node version: ${process.version}`);
  console.log(`[Worker] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('='.repeat(60));

  // Initialize health checker
  await healthChecker.initialize();
  console.log('[Worker] Health checker initialized');

  // Create all queues
  const queues = createAllQueues();
  console.log('[Worker] Queues created');

  // Register queues with health checker and metrics
  for (const [_name, queue] of Object.entries(queues)) {
    healthChecker.registerQueue(queue);
    metricsCollector.registerQueue(queue);
  }
  console.log('[Worker] Queues registered with monitoring');

  // Set up scheduled jobs
  await setupScheduledJobs(queues as Record<QueueName, typeof queues[keyof typeof queues]>);
  console.log('[Worker] Scheduled jobs configured');

  // Create workers for each queue
  workers.push(createEventsWorker());
  workers.push(createWebhooksWorker());
  workers.push(createSearchWorker());
  workers.push(createToolsWorker());
  workers.push(createMaintenanceWorker());

  console.log(`[Worker] ${workers.length} workers started`);
  console.log('='.repeat(60));
  console.log('[Worker] Ready to process jobs');
  console.log('='.repeat(60));
}

/**
 * Graceful shutdown handler
 */
async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    console.log('[Worker] Shutdown already in progress...');
    return;
  }

  isShuttingDown = true;
  console.log('');
  console.log('='.repeat(60));
  console.log(`[Worker] Received ${signal}, initiating graceful shutdown...`);
  console.log('='.repeat(60));

  const shutdownTimeout = setTimeout(() => {
    console.error('[Worker] Shutdown timeout exceeded, forcing exit');
    process.exit(1);
  }, 30000); // 30 second timeout

  try {
    // Stop accepting new jobs
    console.log('[Worker] Stopping workers...');
    const closePromises = workers.map(worker =>
      worker.close().catch(err => {
        console.error(`[Worker] Error closing worker ${worker.name}:`, err);
      })
    );
    await Promise.all(closePromises);
    console.log('[Worker] All workers stopped');

    // Close queues
    console.log('[Worker] Closing queues...');
    await closeAllQueues();
    console.log('[Worker] All queues closed');

    // Close health checker
    console.log('[Worker] Closing health checker...');
    await healthChecker.close();
    console.log('[Worker] Health checker closed');

    // Close metrics collector
    console.log('[Worker] Closing metrics collector...');
    await metricsCollector.close();
    console.log('[Worker] Metrics collector closed');

    // Close DLQ manager
    console.log('[Worker] Closing DLQ manager...');
    await dlqManager.close();
    console.log('[Worker] DLQ manager closed');

    clearTimeout(shutdownTimeout);
    console.log('='.repeat(60));
    console.log('[Worker] Graceful shutdown complete');
    console.log('='.repeat(60));
    process.exit(0);
  } catch (error) {
    console.error('[Worker] Error during shutdown:', error);
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
}

/**
 * Set up signal handlers
 */
function setupSignalHandlers(): void {
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (error) => {
    console.error('[Worker] Uncaught exception:', error);
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('[Worker] Unhandled rejection at:', promise, 'reason:', reason);
    // Don't shutdown on unhandled rejection, just log
  });
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  setupSignalHandlers();

  try {
    await initializeWorkers();
  } catch (error) {
    console.error('[Worker] Failed to initialize:', error);
    process.exit(1);
  }
}

// Run if this is the main module
main().catch(console.error);

// Export for testing
export { initializeWorkers, shutdown };
