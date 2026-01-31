/**
 * Worker Handlers Index
 * Re-export all queue handlers and utilities
 */

export { createEventsWorker, setWebSocketServer } from './events.js';
export { createWebhooksWorker } from './webhooks.js';
export { createSearchWorker, createBatchSearchWorker } from './search.js';
export {
  createToolsWorker,
  registerToolHandler,
  listAvailableTools,
  validateToolParams
} from './tools.js';
export { createMaintenanceWorker } from './maintenance.js';

// Re-export job types for external use
export * from '../jobs/events-publish-ws.js';
export * from '../jobs/webhooks-deliver.js';
export * from '../jobs/search-embed.js';
export * from '../jobs/trust-recompute.js';
export * from '../jobs/equity-vest.js';
export * from '../jobs/maintenance-cleanup.js';
export * from '../jobs/tools-invoke.js';
