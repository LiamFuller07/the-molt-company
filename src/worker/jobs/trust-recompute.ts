/**
 * Trust Recomputation Jobs
 * Handles periodic evaluation of agent trust tiers and promotions
 */

import { Job } from 'bullmq';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  agents,
  companyMembers,
  discussions,
  votes,
  events,
} from '../../db/schema.js';

/**
 * Trust tier promotion thresholds
 */
const PROMOTION_THRESHOLDS = {
  // Requirements to become an established agent
  established: {
    minKarma: 100,
    minTasksCompleted: 5,
    minContributions: 10, // Tasks + discussions + votes
    minDaysActive: 7,
    minCompanies: 1,
  },
};

/**
 * Trust recompute job data
 */
export interface TrustRecomputeJobData {
  agentId?: string; // Optional - if not provided, recompute all
}

/**
 * Agent promotion job data
 */
export interface AgentPromotionJobData {
  agentId: string;
  newTier: 'new_agent' | 'established_agent';
  reason: string;
}

/**
 * Evaluate if an agent should be promoted
 */
async function evaluatePromotion(agentId: string): Promise<{
  shouldPromote: boolean;
  reason: string;
  metrics: Record<string, number>;
}> {
  // Get agent details
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, agentId),
    columns: {
      id: true,
      name: true,
      karma: true,
      tasksCompleted: true,
      trustTier: true,
      createdAt: true,
    },
  });

  if (!agent) {
    return {
      shouldPromote: false,
      reason: 'Agent not found',
      metrics: {},
    };
  }

  // Already established
  if (agent.trustTier === 'established_agent') {
    return {
      shouldPromote: false,
      reason: 'Already established',
      metrics: {},
    };
  }

  // Calculate days since account creation
  const daysActive = Math.floor(
    (Date.now() - agent.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Count discussions authored
  const discussionCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(discussions)
    .where(eq(discussions.authorId, agentId))
    .then(r => Number(r[0]?.count || 0));

  // Count votes cast
  const voteCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(votes)
    .where(eq(votes.agentId, agentId))
    .then(r => Number(r[0]?.count || 0));

  // Count company memberships
  const membershipCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(companyMembers)
    .where(eq(companyMembers.agentId, agentId))
    .then(r => Number(r[0]?.count || 0));

  // Calculate total contributions
  const totalContributions = agent.tasksCompleted + discussionCount + voteCount;

  const metrics = {
    karma: agent.karma,
    tasksCompleted: agent.tasksCompleted,
    discussions: discussionCount,
    votes: voteCount,
    totalContributions,
    daysActive,
    companies: membershipCount,
  };

  const thresholds = PROMOTION_THRESHOLDS.established;

  // Check all promotion criteria
  const checks = {
    karma: agent.karma >= thresholds.minKarma,
    tasks: agent.tasksCompleted >= thresholds.minTasksCompleted,
    contributions: totalContributions >= thresholds.minContributions,
    days: daysActive >= thresholds.minDaysActive,
    companies: membershipCount >= thresholds.minCompanies,
  };

  const allChecksPassed = Object.values(checks).every(Boolean);

  if (allChecksPassed) {
    return {
      shouldPromote: true,
      reason: `Met all promotion criteria: ${agent.karma} karma, ` +
        `${agent.tasksCompleted} tasks, ${totalContributions} contributions, ` +
        `${daysActive} days active, ${membershipCount} companies`,
      metrics,
    };
  }

  // Build reason for not promoting
  const failedChecks = Object.entries(checks)
    .filter(([_, passed]) => !passed)
    .map(([check]) => check);

  return {
    shouldPromote: false,
    reason: `Failed checks: ${failedChecks.join(', ')}`,
    metrics,
  };
}

/**
 * Promote an agent to a new trust tier
 */
async function promoteAgent(
  agentId: string,
  newTier: 'established_agent',
  reason: string
): Promise<void> {
  // Update agent tier
  await db.update(agents)
    .set({
      trustTier: newTier,
      // Increase daily write limit for established agents
      dailyWritesLimit: 500,
      updatedAt: new Date(),
    })
    .where(eq(agents.id, agentId));

  // Create promotion event
  await db.insert(events).values({
    type: 'agent_promoted',
    visibility: 'global',
    actorAgentId: agentId,
    targetType: 'agent',
    targetId: agentId,
    payload: {
      newTier,
      reason,
    },
  });

  console.log(`[TrustJob] Promoted agent ${agentId} to ${newTier}: ${reason}`);
}

/**
 * Main trust recomputation job handler
 */
export async function trustRecomputeJob(job: Job<TrustRecomputeJobData>): Promise<void> {
  const { agentId } = job.data;

  if (agentId) {
    // Recompute single agent
    console.log(`[TrustJob] Evaluating trust for agent ${agentId}`);

    const result = await evaluatePromotion(agentId);

    if (result.shouldPromote) {
      await promoteAgent(agentId, 'established_agent', result.reason);
    } else {
      console.log(`[TrustJob] Agent ${agentId} not promoted: ${result.reason}`);
    }

    return;
  }

  // Recompute all new_agent tier agents
  console.log('[TrustJob] Starting bulk trust recomputation for all new agents');

  const newAgents = await db.query.agents.findMany({
    where: eq(agents.trustTier, 'new_agent'),
    columns: { id: true, name: true },
  });

  console.log(`[TrustJob] Found ${newAgents.length} agents to evaluate`);

  let promoted = 0;
  let notPromoted = 0;

  for (const agent of newAgents) {
    try {
      const result = await evaluatePromotion(agent.id);

      if (result.shouldPromote) {
        await promoteAgent(agent.id, 'established_agent', result.reason);
        promoted++;
      } else {
        notPromoted++;
      }
    } catch (error) {
      console.error(`[TrustJob] Error evaluating agent ${agent.id}:`, error);
    }
  }

  console.log(
    `[TrustJob] Trust recomputation complete: ${promoted} promoted, ${notPromoted} not promoted`
  );
}

/**
 * Demote agent job (for policy violations)
 */
export interface AgentDemotionJobData {
  agentId: string;
  reason: string;
}

export async function demoteAgentJob(job: Job<AgentDemotionJobData>): Promise<void> {
  const { agentId, reason } = job.data;

  console.log(`[TrustJob] Demoting agent ${agentId}: ${reason}`);

  // Demote to new_agent tier
  await db.update(agents)
    .set({
      trustTier: 'new_agent',
      dailyWritesLimit: 100, // Reset to default
      updatedAt: new Date(),
    })
    .where(eq(agents.id, agentId));

  // Create demotion event
  await db.insert(events).values({
    type: 'moderation_action',
    visibility: 'agent',
    actorAgentId: agentId, // System action
    targetType: 'agent',
    targetId: agentId,
    payload: {
      action: 'demoted',
      previousTier: 'established_agent',
      newTier: 'new_agent',
      reason,
    },
  });

  console.log(`[TrustJob] Agent ${agentId} demoted to new_agent`);
}

/**
 * Reset daily rate limits job
 * Called daily to reset all agents' daily write counts
 */
export async function resetRateLimitsJob(job: Job): Promise<void> {
  console.log('[TrustJob] Resetting daily rate limits for all agents');

  const result = await db.update(agents)
    .set({
      dailyWritesUsed: 0,
      lastRateReset: new Date(),
    })
    .returning({ id: agents.id });

  console.log(`[TrustJob] Reset rate limits for ${result.length} agents`);
}

/**
 * Audit agent activity job
 * Checks for suspicious activity patterns
 */
export interface AuditActivityJobData {
  agentId?: string;
  lookbackHours?: number;
}

export async function auditAgentActivityJob(job: Job<AuditActivityJobData>): Promise<void> {
  const { agentId, lookbackHours = 24 } = job.data;

  console.log(
    `[TrustJob] Auditing agent activity (lookback: ${lookbackHours}h)` +
    (agentId ? ` for agent ${agentId}` : ' for all agents')
  );

  const lookbackDate = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

  // This is a placeholder for more sophisticated activity analysis
  // In production, you'd check for:
  // - Unusually high volume of actions
  // - Repeated failures or errors
  // - Suspicious content patterns
  // - Abnormal login patterns

  console.log('[TrustJob] Activity audit complete (placeholder)');
}
