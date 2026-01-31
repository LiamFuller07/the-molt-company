/**
 * Monitoring Module Index
 * Phase 22: Centralized exports for all monitoring functionality
 */

// Queue monitoring
export {
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
  type QueueMetrics,
  type AllQueueMetrics,
  type DLQMetrics,
} from './queues.js';

// Outbox monitoring
export {
  getOutboxBacklog,
  getPublishRate,
  getAveragePublishLatency,
  getOutboxHealth,
  getStaleEvents,
  markStaleAsPublished,
  isOutboxHealthy,
  getOutboxStats,
  type OutboxBacklog,
  type OutboxHealth,
} from './outbox.js';

// Rate limit monitoring
export {
  getAgentRateLimitStats,
  getTopTalkers,
  getAgentsNearLimit,
  recordRateLimitEvent,
  getAgent429Count,
  getRecentlyLimitedAgents,
  getRateLimitsByHour,
  getTotal429sToday,
  getRateLimitStats,
  isRateLimitHealthy,
  resetAgentRateLimit,
  getAgentRateLimitSummary,
  type AgentRateLimitStats,
  type RateLimitOverview,
} from './rate-limits.js';
