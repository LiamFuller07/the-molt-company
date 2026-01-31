/**
 * Maintenance Queue Handler
 * Processes scheduled maintenance jobs
 */

import { Worker, Job } from 'bullmq';
import { redisConnection, workerConcurrency } from '../config.js';
import { QUEUES } from '../queues.js';

// Import job implementations from maintenance-cleanup
import {
  cleanupJob,
  archiveEventsJob,
  resolveDecisionsJob,
  vacuumJob,
  healthCheckJob,
  orphanCleanupJob,
  type CleanupJobData,
  type ArchiveJobData,
  type DecisionResolveJobData,
} from '../jobs/maintenance-cleanup.js';

// Import job implementations from trust-recompute
import {
  trustRecomputeJob,
  demoteAgentJob,
  resetRateLimitsJob,
  auditAgentActivityJob,
  type TrustRecomputeJobData,
  type AgentDemotionJobData,
  type AuditActivityJobData,
} from '../jobs/trust-recompute.js';

// Import job implementations from equity-vest
import {
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
} from '../jobs/equity-vest.js';

/**
 * Maintenance job handlers
 * Maps job names to their implementations
 */
const maintenanceHandlers: Record<string, (job: Job) => Promise<void>> = {
  // General maintenance
  'cleanup': async (job: Job<CleanupJobData>) => {
    await cleanupJob(job);
  },

  'maintenance.cleanup': async (job: Job<CleanupJobData>) => {
    await cleanupJob(job);
  },

  'archive.events': async (job: Job<ArchiveJobData>) => {
    await archiveEventsJob(job);
  },

  'audit.archive': async (job: Job<ArchiveJobData>) => {
    await archiveEventsJob(job);
  },

  'decision.resolve': async (job: Job<DecisionResolveJobData>) => {
    await resolveDecisionsJob(job);
  },

  'vacuum': async (job: Job) => {
    await vacuumJob(job);
  },

  'maintenance.optimize': async (job: Job) => {
    await vacuumJob(job);
  },

  'health.check': async (job: Job) => {
    await healthCheckJob(job);
  },

  'orphan.cleanup': async (job: Job<CleanupJobData>) => {
    await orphanCleanupJob(job);
  },

  // Trust system
  'trust.recompute': async (job: Job<TrustRecomputeJobData>) => {
    await trustRecomputeJob(job);
  },

  'trust.decay': async (job: Job<TrustRecomputeJobData>) => {
    // Trust decay is handled as part of trust recompute
    await trustRecomputeJob(job);
  },

  'agent.demote': async (job: Job<AgentDemotionJobData>) => {
    await demoteAgentJob(job);
  },

  'rate-limit.reset': async (job: Job) => {
    await resetRateLimitsJob(job);
  },

  'activity.audit': async (job: Job<AuditActivityJobData>) => {
    await auditAgentActivityJob(job);
  },

  // Equity system
  'equity.vest': async (job: Job<EquityVestJobData>) => {
    await equityVestJob(job);
  },

  'equity.snapshot': async (job: Job<EquityVestJobData>) => {
    // Snapshot is a subset of vesting functionality
    await equityVestJob(job);
  },

  'equity.grant': async (job: Job<EquityGrantJobData>) => {
    await grantEquityJob(job);
  },

  'equity.dilution': async (job: Job<EquityDilutionJobData>) => {
    await dilutionJob(job);
  },

  'equity.transfer': async (job: Job<EquityTransferJobData>) => {
    await equityTransferJob(job);
  },

  'equity.summary': async (job: Job<EquitySummaryJobData>) => {
    await equitySummaryJob(job);
  },

  // Decision system
  'decision.reminder': async (job: Job) => {
    // Reminders are handled as part of decision resolution
    await resolveDecisionsJob(job as Job<DecisionResolveJobData>);
  },

  // Metrics (placeholder, would need separate implementation)
  'metrics.aggregate': async (job: Job) => {
    console.log('[Maintenance] Aggregating metrics...');
    // TODO: Implement metrics aggregation
    console.log('[Maintenance] Metrics aggregated');
  },

  'metrics.daily-report': async (job: Job) => {
    console.log('[Maintenance] Generating daily report...');
    // TODO: Implement daily report generation
    console.log('[Maintenance] Daily report generated');
  },
};

/**
 * Create the maintenance worker
 */
export function createMaintenanceWorker(): Worker {
  const worker = new Worker(
    QUEUES.MAINTENANCE,
    async (job: Job) => {
      const handler = maintenanceHandlers[job.name];
      if (!handler) {
        console.warn(`[Maintenance] Unknown job type: ${job.name}`);
        return;
      }

      console.log(`[Maintenance] Processing ${job.name}:${job.id}`);
      await handler(job);
    },
    {
      connection: redisConnection,
      concurrency: workerConcurrency.maintenance,
      lockDuration: 300000, // 5 minutes for maintenance jobs
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Maintenance] Job ${job.name} completed`);
  });

  worker.on('failed', (job, error) => {
    console.error(`[Maintenance] Job ${job?.name} failed:`, error.message);
  });

  console.log('[Maintenance] Worker started');
  return worker;
}
