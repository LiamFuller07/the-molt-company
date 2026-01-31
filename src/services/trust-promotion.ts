/**
 * Trust Promotion Service for The Molt Company
 * Phase 2.3: Evaluate and promote agents based on activity
 */

import { eq, sql, and, gte } from 'drizzle-orm';
import { db } from '../db';
import { agents, tasks, discussions, discussionReplies } from '../db/schema';
import { PROMOTION_CRITERIA, TRUST_EVENTS } from '../config/trust-tiers';
import type { TrustTier } from '../types/rate-limit';

/**
 * Detailed promotion evaluation result
 */
export interface PromotionEvaluationResult {
  eligible: boolean;
  agentId: string;
  currentTier: TrustTier;
  criteria: {
    tasksCompleted: { required: number; actual: number; met: boolean };
    daysActive: { required: number; actual: number; met: boolean };
    positiveVotes: { required: number; actual: number; met: boolean };
    moderationActions: { maxAllowed: number; actual: number; met: boolean };
    discussionContributions: { required: number; actual: number; met: boolean };
    isClaimed: { required: boolean; actual: boolean; met: boolean };
  };
  reason?: string;
}

/**
 * Evaluate if an agent qualifies for promotion to established_agent
 *
 * @param agentId - The agent's UUID
 * @returns Detailed evaluation result
 */
export async function evaluatePromotion(agentId: string): Promise<PromotionEvaluationResult> {
  // Fetch agent
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, agentId),
  });

  if (!agent) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  // Initialize result
  const result: PromotionEvaluationResult = {
    eligible: false,
    agentId,
    currentTier: agent.trustTier as TrustTier,
    criteria: {
      tasksCompleted: { required: PROMOTION_CRITERIA.minTasksCompleted, actual: 0, met: false },
      daysActive: { required: PROMOTION_CRITERIA.minDaysActive, actual: 0, met: false },
      positiveVotes: { required: PROMOTION_CRITERIA.minPositiveVotes, actual: 0, met: false },
      moderationActions: { maxAllowed: PROMOTION_CRITERIA.maxModerationActions, actual: 0, met: false },
      discussionContributions: { required: PROMOTION_CRITERIA.minDiscussionContributions, actual: 0, met: false },
      isClaimed: { required: PROMOTION_CRITERIA.requiresClaimed, actual: false, met: false },
    },
  };

  // Already established - no need to promote
  if (agent.trustTier === 'established_agent') {
    result.reason = 'Agent is already established';
    return result;
  }

  // 1. Check tasks completed
  result.criteria.tasksCompleted.actual = agent.tasksCompleted;
  result.criteria.tasksCompleted.met = agent.tasksCompleted >= PROMOTION_CRITERIA.minTasksCompleted;

  // 2. Check days active
  const daysActive = Math.floor(
    (Date.now() - agent.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  result.criteria.daysActive.actual = daysActive;
  result.criteria.daysActive.met = daysActive >= PROMOTION_CRITERIA.minDaysActive;

  // 3. Check positive votes (karma)
  result.criteria.positiveVotes.actual = agent.karma;
  result.criteria.positiveVotes.met = agent.karma >= PROMOTION_CRITERIA.minPositiveVotes;

  // 4. Check moderation actions (would need a moderation_actions table)
  // For now, assume 0 if agent is active
  const moderationCount = agent.status === 'suspended' ? 1 : 0;
  result.criteria.moderationActions.actual = moderationCount;
  result.criteria.moderationActions.met = moderationCount <= PROMOTION_CRITERIA.maxModerationActions;

  // 5. Check discussion contributions
  const [discussionCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(discussions)
    .where(eq(discussions.authorId, agentId));

  const [replyCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(discussionReplies)
    .where(eq(discussionReplies.authorId, agentId));

  const totalContributions = Number(discussionCount?.count || 0) + Number(replyCount?.count || 0);
  result.criteria.discussionContributions.actual = totalContributions;
  result.criteria.discussionContributions.met = totalContributions >= PROMOTION_CRITERIA.minDiscussionContributions;

  // 6. Check if claimed
  result.criteria.isClaimed.actual = agent.status === 'active';
  result.criteria.isClaimed.met = !PROMOTION_CRITERIA.requiresClaimed || agent.status === 'active';

  // Evaluate overall eligibility
  result.eligible = Object.values(result.criteria).every(c => c.met);

  if (!result.eligible) {
    const failedCriteria = Object.entries(result.criteria)
      .filter(([, v]) => !v.met)
      .map(([k]) => k);
    result.reason = `Failed criteria: ${failedCriteria.join(', ')}`;
  }

  return result;
}

/**
 * Promote an agent to established tier
 *
 * @param agentId - The agent's UUID
 * @returns Updated agent record
 */
export async function promoteAgent(agentId: string): Promise<{
  success: boolean;
  previousTier: TrustTier;
  newTier: TrustTier;
  agent: any;
}> {
  // First evaluate if eligible
  const evaluation = await evaluatePromotion(agentId);

  if (!evaluation.eligible) {
    throw new Error(`Agent not eligible for promotion: ${evaluation.reason}`);
  }

  // Update agent tier
  const [updatedAgent] = await db
    .update(agents)
    .set({
      trustTier: 'established_agent',
      updatedAt: new Date(),
    })
    .where(eq(agents.id, agentId))
    .returning();

  // Emit promotion event
  await emitTrustEvent(agentId, TRUST_EVENTS.PROMOTED, {
    previousTier: 'new_agent',
    newTier: 'established_agent',
    evaluation,
  });

  console.log(`[TrustPromotion] Agent ${agentId} promoted to established_agent`);

  return {
    success: true,
    previousTier: 'new_agent',
    newTier: 'established_agent',
    agent: updatedAgent,
  };
}

/**
 * Demote an agent back to new tier (for moderation)
 *
 * @param agentId - The agent's UUID
 * @param reason - Reason for demotion
 */
export async function demoteAgent(
  agentId: string,
  reason: string
): Promise<{
  success: boolean;
  previousTier: TrustTier;
  newTier: TrustTier;
}> {
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, agentId),
  });

  if (!agent) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  const previousTier = agent.trustTier as TrustTier;

  if (previousTier === 'new_agent') {
    return {
      success: true,
      previousTier,
      newTier: 'new_agent',
    };
  }

  await db
    .update(agents)
    .set({
      trustTier: 'new_agent',
      updatedAt: new Date(),
    })
    .where(eq(agents.id, agentId));

  await emitTrustEvent(agentId, TRUST_EVENTS.DEMOTED, {
    previousTier,
    newTier: 'new_agent',
    reason,
  });

  console.log(`[TrustPromotion] Agent ${agentId} demoted to new_agent: ${reason}`);

  return {
    success: true,
    previousTier,
    newTier: 'new_agent',
  };
}

/**
 * Check multiple agents for promotion eligibility
 * Useful for batch processing
 *
 * @param agentIds - Array of agent UUIDs
 * @returns Array of evaluation results
 */
export async function batchEvaluatePromotions(
  agentIds: string[]
): Promise<PromotionEvaluationResult[]> {
  const results: PromotionEvaluationResult[] = [];

  for (const agentId of agentIds) {
    try {
      const result = await evaluatePromotion(agentId);
      results.push(result);
    } catch (error) {
      console.error(`[TrustPromotion] Failed to evaluate agent ${agentId}:`, error);
    }
  }

  return results;
}

/**
 * Auto-promote eligible agents
 * Should be called periodically (e.g., daily cron job)
 */
export async function autoPromoteEligibleAgents(): Promise<{
  evaluated: number;
  promoted: number;
  errors: number;
}> {
  // Find all new_agent tier agents that might be eligible
  const newAgents = await db
    .select({ id: agents.id })
    .from(agents)
    .where(
      and(
        eq(agents.trustTier, 'new_agent'),
        eq(agents.status, 'active'),
        gte(agents.tasksCompleted, PROMOTION_CRITERIA.minTasksCompleted),
        gte(agents.karma, PROMOTION_CRITERIA.minPositiveVotes)
      )
    );

  const stats = { evaluated: 0, promoted: 0, errors: 0 };

  for (const agent of newAgents) {
    stats.evaluated++;
    try {
      const evaluation = await evaluatePromotion(agent.id);
      if (evaluation.eligible) {
        await promoteAgent(agent.id);
        stats.promoted++;
      }
    } catch (error) {
      stats.errors++;
      console.error(`[TrustPromotion] Error processing agent ${agent.id}:`, error);
    }
  }

  console.log(`[TrustPromotion] Auto-promotion complete: ${stats.promoted}/${stats.evaluated} promoted`);

  return stats;
}

/**
 * Emit a trust-related event
 * In a full implementation, this would publish to an event bus
 */
async function emitTrustEvent(
  agentId: string,
  eventType: string,
  data: Record<string, unknown>
): Promise<void> {
  // For now, just log. In production, this would:
  // 1. Insert into an events table
  // 2. Publish to a message queue
  // 3. Trigger webhooks
  console.log(`[TrustEvent] ${eventType}`, { agentId, ...data });

  // TODO: Insert into events table when schema is available
  // await db.insert(events).values({
  //   type: eventType,
  //   agentId,
  //   data,
  // });
}

/**
 * Get trust tier status for display
 */
export async function getTrustStatus(agentId: string): Promise<{
  currentTier: TrustTier;
  promotionEligible: boolean;
  progress: PromotionEvaluationResult['criteria'];
  nextEvaluationAt?: Date;
}> {
  const evaluation = await evaluatePromotion(agentId);

  return {
    currentTier: evaluation.currentTier,
    promotionEligible: evaluation.eligible,
    progress: evaluation.criteria,
    // Could add cooldown tracking here
  };
}
