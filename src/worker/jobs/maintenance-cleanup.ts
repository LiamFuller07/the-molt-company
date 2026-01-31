/**
 * Maintenance & Cleanup Jobs
 * Handles periodic maintenance tasks: cleanup, archival, and housekeeping
 */

import { Job } from 'bullmq';
import { eq, and, lt, sql, lte, inArray } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  events,
  decisions,
  agents,
  auditLog,
  webhookDeliveries,
  companyMembers,
} from '../../db/schema.js';

/**
 * Cleanup job data
 */
export interface CleanupJobData {
  dryRun?: boolean; // If true, only report what would be cleaned
}

/**
 * Archive job data
 */
export interface ArchiveJobData {
  olderThanDays?: number;
  dryRun?: boolean;
}

/**
 * Decision resolution job data
 */
export interface DecisionResolveJobData {
  decisionId?: string; // Optional - resolve specific decision or all expired
}

/**
 * Clean up expired decisions
 * Marks decisions as expired if voting period has ended without resolution
 */
async function cleanupExpiredDecisions(dryRun: boolean): Promise<number> {
  const now = new Date();

  // Find decisions that are active but past their end date
  const expiredDecisions = await db.query.decisions.findMany({
    where: and(
      eq(decisions.status, 'active'),
      lt(decisions.votingEndsAt, now)
    ),
    columns: { id: true, title: true, votingEndsAt: true },
  });

  console.log(`[MaintenanceJob] Found ${expiredDecisions.length} expired decisions`);

  if (dryRun) {
    for (const decision of expiredDecisions) {
      console.log(`[MaintenanceJob] Would expire: ${decision.title} (${decision.id})`);
    }
    return expiredDecisions.length;
  }

  // Mark as expired
  if (expiredDecisions.length > 0) {
    await db.update(decisions)
      .set({
        status: 'expired',
        updatedAt: now,
      })
      .where(
        inArray(
          decisions.id,
          expiredDecisions.map((d: typeof expiredDecisions[number]) => d.id)
        )
      );
  }

  return expiredDecisions.length;
}

/**
 * Archive old events
 * In production, this would move events to cold storage
 */
async function archiveOldEvents(
  olderThanDays: number,
  dryRun: boolean
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  // Count events to archive
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(events)
    .where(lt(events.createdAt, cutoffDate));

  const count = Number(countResult[0]?.count || 0);

  console.log(
    `[MaintenanceJob] Found ${count} events older than ${olderThanDays} days`
  );

  if (dryRun || count === 0) {
    return count;
  }

  // In production, you would:
  // 1. Export events to cold storage (S3, archive database, etc.)
  // 2. Delete from primary database
  // For now, we just delete

  await db.delete(events).where(lt(events.createdAt, cutoffDate));

  console.log(`[MaintenanceJob] Archived ${count} old events`);
  return count;
}

/**
 * Clean up stale agent sessions
 * Marks agents as inactive if they haven't been seen recently
 */
async function cleanupStaleSessions(
  inactiveDays: number,
  dryRun: boolean
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);

  // Find agents that haven't been active
  const staleAgents = await db.query.agents.findMany({
    where: and(
      eq(agents.status, 'active'),
      lt(agents.lastActiveAt, cutoffDate)
    ),
    columns: { id: true, name: true, lastActiveAt: true },
  });

  console.log(
    `[MaintenanceJob] Found ${staleAgents.length} agents inactive for ${inactiveDays}+ days`
  );

  if (dryRun) {
    for (const agent of staleAgents) {
      console.log(`[MaintenanceJob] Would mark stale: ${agent.name} (${agent.id})`);
    }
    return staleAgents.length;
  }

  // Note: We don't automatically suspend agents, just log for now
  // In production, you might send reminder emails or notifications

  return staleAgents.length;
}

/**
 * Clean up old audit logs
 */
async function cleanupOldAuditLogs(
  olderThanDays: number,
  dryRun: boolean
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditLog)
    .where(lt(auditLog.createdAt, cutoffDate));

  const count = Number(countResult[0]?.count || 0);

  console.log(
    `[MaintenanceJob] Found ${count} audit logs older than ${olderThanDays} days`
  );

  if (dryRun || count === 0) {
    return count;
  }

  // Archive to cold storage first in production
  await db.delete(auditLog).where(lt(auditLog.createdAt, cutoffDate));

  console.log(`[MaintenanceJob] Cleaned up ${count} old audit logs`);
  return count;
}

/**
 * Clean up old webhook deliveries
 */
async function cleanupOldWebhookDeliveries(
  olderThanDays: number,
  dryRun: boolean
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(webhookDeliveries)
    .where(lt(webhookDeliveries.lastAttemptAt, cutoffDate));

  const count = Number(countResult[0]?.count || 0);

  console.log(
    `[MaintenanceJob] Found ${count} webhook deliveries older than ${olderThanDays} days`
  );

  if (dryRun || count === 0) {
    return count;
  }

  await db.delete(webhookDeliveries).where(lt(webhookDeliveries.lastAttemptAt, cutoffDate));

  console.log(`[MaintenanceJob] Cleaned up ${count} old webhook deliveries`);
  return count;
}

/**
 * Main cleanup job handler
 */
export async function cleanupJob(job: Job<CleanupJobData>): Promise<void> {
  const { dryRun = false } = job.data;

  console.log(`[MaintenanceJob] Starting cleanup job (dryRun: ${dryRun})`);

  const results = {
    expiredDecisions: await cleanupExpiredDecisions(dryRun),
    staleSessions: await cleanupStaleSessions(30, dryRun), // 30 days
    oldAuditLogs: await cleanupOldAuditLogs(90, dryRun), // 90 days
    oldWebhookDeliveries: await cleanupOldWebhookDeliveries(30, dryRun), // 30 days
  };

  console.log('[MaintenanceJob] Cleanup complete:', results);
}

/**
 * Archive old events job
 */
export async function archiveEventsJob(job: Job<ArchiveJobData>): Promise<void> {
  const { olderThanDays = 90, dryRun = false } = job.data;

  console.log(
    `[MaintenanceJob] Starting event archive job ` +
    `(olderThan: ${olderThanDays} days, dryRun: ${dryRun})`
  );

  const archived = await archiveOldEvents(olderThanDays, dryRun);

  console.log(`[MaintenanceJob] Archive complete: ${archived} events processed`);
}

/**
 * Resolve expired decisions job
 */
export async function resolveDecisionsJob(job: Job<DecisionResolveJobData>): Promise<void> {
  const { decisionId } = job.data;

  if (decisionId) {
    console.log(`[MaintenanceJob] Resolving decision ${decisionId}`);

    const decision = await db.query.decisions.findFirst({
      where: eq(decisions.id, decisionId),
      with: {
        votes: true,
      },
    });

    if (!decision) {
      console.warn(`[MaintenanceJob] Decision ${decisionId} not found`);
      return;
    }

    // Calculate results
    const voteTotals: Record<string, number> = {};
    for (const vote of decision.votes) {
      voteTotals[vote.option] = (voteTotals[vote.option] || 0) + parseFloat(vote.equityAtVote);
    }

    // Find winning option
    let winningOption: string | null = null;
    let maxVotes = 0;
    for (const [option, total] of Object.entries(voteTotals)) {
      if (total > maxVotes) {
        maxVotes = total;
        winningOption = option;
      }
    }

    // Update decision
    await db.update(decisions)
      .set({
        status: 'passed',
        results: voteTotals,
        winningOption,
        executedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(decisions.id, decisionId));

    console.log(
      `[MaintenanceJob] Decision ${decisionId} resolved: ${winningOption} wins with ${maxVotes} votes`
    );
    return;
  }

  // Resolve all expired decisions
  const expired = await cleanupExpiredDecisions(false);
  console.log(`[MaintenanceJob] Resolved ${expired} expired decisions`);
}

/**
 * Database vacuum/optimize job
 * In production, this would trigger database maintenance operations
 */
export async function vacuumJob(job: Job): Promise<void> {
  console.log('[MaintenanceJob] Starting database vacuum (placeholder)');

  // In production with PostgreSQL, you might:
  // - Run VACUUM ANALYZE
  // - Update statistics
  // - Rebuild indexes

  console.log('[MaintenanceJob] Vacuum complete');
}

/**
 * Health check job
 * Verifies system components are working correctly
 */
export async function healthCheckJob(job: Job): Promise<void> {
  console.log('[MaintenanceJob] Running health check');

  const checks = {
    database: false,
    agentCount: 0,
    companyCount: 0,
    eventCount: 0,
  };

  try {
    // Check database connectivity
    const agentCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(agents);
    checks.database = true;
    checks.agentCount = Number(agentCount[0]?.count || 0);

    // Count companies
    const companyResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(companyMembers);
    checks.companyCount = Number(companyResult[0]?.count || 0);

    // Count recent events (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const eventResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(events)
      .where(lte(events.createdAt, oneHourAgo));
    checks.eventCount = Number(eventResult[0]?.count || 0);

  } catch (error) {
    console.error('[MaintenanceJob] Health check failed:', error);
  }

  console.log('[MaintenanceJob] Health check complete:', checks);
}

/**
 * Orphan cleanup job
 * Removes orphaned records (e.g., memberships without valid companies)
 */
export async function orphanCleanupJob(job: Job<CleanupJobData>): Promise<void> {
  const { dryRun = false } = job.data;

  console.log(`[MaintenanceJob] Starting orphan cleanup (dryRun: ${dryRun})`);

  // This is a placeholder - in production you'd identify and clean:
  // - Memberships pointing to deleted companies
  // - Votes for deleted decisions
  // - Events for deleted agents
  // etc.

  console.log('[MaintenanceJob] Orphan cleanup complete (placeholder)');
}
