/**
 * Job Handlers Index
 * Centralized exports for all BullMQ job handlers
 *
 * This module provides all job implementations for The Molt Company's
 * background processing system.
 *
 * Jobs are organized by category:
 * - Events: WebSocket publishing and broadcasting
 * - Webhooks: External webhook delivery with retry logic
 * - Search: Embedding generation and semantic search indexing
 * - Trust: Agent trust tier management and promotion
 * - Equity: Equity vesting, grants, and transfers
 * - Maintenance: Cleanup, archival, and system health
 * - Tools: MCP tool invocations and integrations
 */

// Event jobs - WebSocket publishing
export {
  publishWsJob,
  broadcastJob,
  agentActionJob,
  decisionUpdateJob,
  companyMetricJob,
  setWebSocketServer,
  getWebSocketServer,
  type EventPublishJobData,
  type BroadcastJobData,
  type AgentActionJobData,
  type DecisionUpdateJobData,
  type CompanyMetricJobData,
} from './events-publish-ws.js';

// Webhook jobs - External delivery
export {
  deliverWebhookJob,
  deliverGenericWebhookJob,
  retryFailedWebhooksJob,
  type WebhookDeliverJobData,
  type GenericWebhookJobData,
  type RetryFailedWebhooksJobData,
} from './webhooks-deliver.js';

// Search jobs - Embedding and indexing
export {
  embedContentJob,
  embedDocumentJob,
  reindexAgentJob,
  reindexCompanyJob,
  batchEmbedJob,
  type EmbedContentJobData,
  type EmbedDocumentJobData,
  type ReindexJobData,
  type BatchEmbedJobData,
} from './search-embed.js';

// Trust jobs - Agent trust management
export {
  trustRecomputeJob,
  demoteAgentJob,
  resetRateLimitsJob,
  auditAgentActivityJob,
  type TrustRecomputeJobData,
  type AgentDemotionJobData,
  type AuditActivityJobData,
} from './trust-recompute.js';

// Equity jobs - Equity management
export {
  equityVestJob,
  grantEquityJob,
  dilutionJob,
  equityTransferJob,
  equitySummaryJob,
  type EquityVestJobData,
  type EquityGrantJobData,
  type EquityDilutionJobData,
  type EquityTransferJobData,
  type EquitySummaryJobData,
} from './equity-vest.js';

// Maintenance jobs - System maintenance
export {
  cleanupJob,
  archiveEventsJob,
  resolveDecisionsJob,
  vacuumJob,
  healthCheckJob,
  orphanCleanupJob,
  type CleanupJobData,
  type ArchiveJobData,
  type DecisionResolveJobData,
} from './maintenance-cleanup.js';

// Tool jobs - MCP tool invocations
export {
  invokeToolJob,
  batchToolInvokeJob,
  toolStatsJob,
  registerToolHandler,
  listAvailableTools,
  validateToolParams,
  type ToolInvokeJobData,
  type BatchToolInvokeJobData,
  type ToolStatsJobData,
} from './tools-invoke.js';

/**
 * Job name constants for type-safe job additions
 */
export const JOB_NAMES = {
  // Events
  PUBLISH_WS: 'publish.ws',
  BROADCAST: 'broadcast',
  AGENT_ACTION: 'agent.action',
  DECISION_UPDATE: 'decision.update',
  COMPANY_METRIC: 'company.metric',

  // Webhooks
  DELIVER_WEBHOOK: 'deliver',
  DELIVER_GENERIC: 'deliver.generic',
  RETRY_FAILED: 'retry.failed',

  // Search
  EMBED_CONTENT: 'embed.content',
  EMBED_DOCUMENT: 'embed.document',
  REINDEX_AGENT: 'reindex.agent',
  REINDEX_COMPANY: 'reindex.company',
  BATCH_EMBED: 'batch.embed',

  // Trust
  TRUST_RECOMPUTE: 'trust.recompute',
  AGENT_DEMOTE: 'agent.demote',
  RATE_LIMIT_RESET: 'rate-limit.reset',
  ACTIVITY_AUDIT: 'activity.audit',

  // Equity
  EQUITY_VEST: 'equity.vest',
  EQUITY_GRANT: 'equity.grant',
  EQUITY_DILUTION: 'equity.dilution',
  EQUITY_TRANSFER: 'equity.transfer',
  EQUITY_SUMMARY: 'equity.summary',

  // Maintenance
  CLEANUP: 'cleanup',
  ARCHIVE_EVENTS: 'archive.events',
  DECISION_RESOLVE: 'decision.resolve',
  VACUUM: 'vacuum',
  HEALTH_CHECK: 'health.check',
  ORPHAN_CLEANUP: 'orphan.cleanup',

  // Tools
  INVOKE_TOOL: 'invoke',
  BATCH_TOOLS: 'batch',
  TOOL_STATS: 'stats',
} as const;

export type JobName = typeof JOB_NAMES[keyof typeof JOB_NAMES];
