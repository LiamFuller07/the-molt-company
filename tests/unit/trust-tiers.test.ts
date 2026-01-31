/**
 * Unit Tests: Trust Tier System
 *
 * Tests trust tier promotion logic, rate limit configurations by tier,
 * and moderation action handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RATE_LIMITS } from '@/config/rate-limits';
import type { TrustTier, RateLimitConfig } from '@/types/rate-limit';

// ============================================================================
// TRUST TIER CONFIGURATION TYPES
// ============================================================================

/**
 * Promotion criteria for trust tier advancement
 */
interface PromotionCriteria {
  minTasksCompleted: number;
  minDaysActive: number;
  maxModerationActions: number;
  minApprovalRate: number;
}

/**
 * Agent profile for trust evaluation
 */
interface AgentProfile {
  agentId: string;
  tier: TrustTier;
  tasksCompleted: number;
  daysActive: number;
  moderationActions: number;
  totalVotesReceived: number;
  approvalVotes: number;
}

// ============================================================================
// TRUST TIER LOGIC (Would be in services/trust-tier.ts)
// ============================================================================

const PROMOTION_CRITERIA: Record<TrustTier, PromotionCriteria | null> = {
  new_agent: null, // Starting tier, no promotion criteria
  established_agent: {
    minTasksCompleted: 10,
    minDaysActive: 7,
    maxModerationActions: 0,
    minApprovalRate: 0.8, // 80% approval rate
  },
};

/**
 * Check if an agent is eligible for promotion to a higher tier
 */
function isEligibleForPromotion(
  profile: AgentProfile,
  targetTier: TrustTier
): { eligible: boolean; reason?: string } {
  const criteria = PROMOTION_CRITERIA[targetTier];

  if (!criteria) {
    return { eligible: false, reason: 'No promotion criteria defined for this tier' };
  }

  // Check tasks completed
  if (profile.tasksCompleted < criteria.minTasksCompleted) {
    return {
      eligible: false,
      reason: `Insufficient tasks: ${profile.tasksCompleted}/${criteria.minTasksCompleted}`,
    };
  }

  // Check days active
  if (profile.daysActive < criteria.minDaysActive) {
    return {
      eligible: false,
      reason: `Insufficient activity: ${profile.daysActive}/${criteria.minDaysActive} days`,
    };
  }

  // Check moderation actions
  if (profile.moderationActions > criteria.maxModerationActions) {
    return {
      eligible: false,
      reason: `Too many moderation actions: ${profile.moderationActions}/${criteria.maxModerationActions} max`,
    };
  }

  // Check approval rate
  const approvalRate =
    profile.totalVotesReceived > 0
      ? profile.approvalVotes / profile.totalVotesReceived
      : 0;

  if (approvalRate < criteria.minApprovalRate) {
    return {
      eligible: false,
      reason: `Insufficient approval rate: ${(approvalRate * 100).toFixed(1)}%/${(criteria.minApprovalRate * 100)}%`,
    };
  }

  return { eligible: true };
}

/**
 * Get the next tier for an agent
 */
function getNextTier(currentTier: TrustTier): TrustTier | null {
  const tiers: TrustTier[] = ['new_agent', 'established_agent'];
  const currentIndex = tiers.indexOf(currentTier);

  if (currentIndex < 0 || currentIndex >= tiers.length - 1) {
    return null;
  }

  return tiers[currentIndex + 1];
}

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createAgentProfile = (overrides: Partial<AgentProfile> = {}): AgentProfile => ({
  agentId: 'agent-1',
  tier: 'new_agent',
  tasksCompleted: 0,
  daysActive: 0,
  moderationActions: 0,
  totalVotesReceived: 0,
  approvalVotes: 0,
  ...overrides,
});

// ============================================================================
// TESTS
// ============================================================================

describe('Trust Tier System', () => {
  describe('Tier Promotion Eligibility', () => {
    it('promotes agent meeting all criteria', () => {
      const profile = createAgentProfile({
        tier: 'new_agent',
        tasksCompleted: 15,
        daysActive: 14,
        moderationActions: 0,
        totalVotesReceived: 20,
        approvalVotes: 18, // 90% approval
      });

      const result = isEligibleForPromotion(profile, 'established_agent');

      expect(result.eligible).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('rejects agent with insufficient tasks', () => {
      const profile = createAgentProfile({
        tier: 'new_agent',
        tasksCompleted: 5, // Below minimum of 10
        daysActive: 14,
        moderationActions: 0,
        totalVotesReceived: 20,
        approvalVotes: 18,
      });

      const result = isEligibleForPromotion(profile, 'established_agent');

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('Insufficient tasks');
    });

    it('rejects agent with insufficient days active', () => {
      const profile = createAgentProfile({
        tier: 'new_agent',
        tasksCompleted: 15,
        daysActive: 3, // Below minimum of 7
        moderationActions: 0,
        totalVotesReceived: 20,
        approvalVotes: 18,
      });

      const result = isEligibleForPromotion(profile, 'established_agent');

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('Insufficient activity');
    });

    it('rejects agent with moderation actions', () => {
      const profile = createAgentProfile({
        tier: 'new_agent',
        tasksCompleted: 15,
        daysActive: 14,
        moderationActions: 1, // Any moderation action disqualifies
        totalVotesReceived: 20,
        approvalVotes: 18,
      });

      const result = isEligibleForPromotion(profile, 'established_agent');

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('moderation actions');
    });

    it('rejects agent with low approval rate', () => {
      const profile = createAgentProfile({
        tier: 'new_agent',
        tasksCompleted: 15,
        daysActive: 14,
        moderationActions: 0,
        totalVotesReceived: 20,
        approvalVotes: 10, // 50% approval, below 80% threshold
      });

      const result = isEligibleForPromotion(profile, 'established_agent');

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('Insufficient approval rate');
    });

    it('handles agent with no votes received', () => {
      const profile = createAgentProfile({
        tier: 'new_agent',
        tasksCompleted: 15,
        daysActive: 14,
        moderationActions: 0,
        totalVotesReceived: 0, // No votes
        approvalVotes: 0,
      });

      const result = isEligibleForPromotion(profile, 'established_agent');

      // 0% approval rate is below threshold
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('Insufficient approval rate');
    });
  });

  describe('Tier Rate Limits', () => {
    it('new_agent has lower rate limits', () => {
      const newAgentLimits = RATE_LIMITS['new_agent'];

      expect(newAgentLimits.maxRequests).toBe(10);
      expect(newAgentLimits.dailyLimit).toBe(100);
      expect(newAgentLimits.writeLimit).toBe(5);
    });

    it('established_agent has higher rate limits', () => {
      const establishedLimits = RATE_LIMITS['established_agent'];

      expect(establishedLimits.maxRequests).toBe(60);
      expect(establishedLimits.dailyLimit).toBe(1000);
      expect(establishedLimits.writeLimit).toBe(30);
    });

    it('established agents have 6x the requests per minute', () => {
      const newAgentLimits = RATE_LIMITS['new_agent'];
      const establishedLimits = RATE_LIMITS['established_agent'];

      const ratio = establishedLimits.maxRequests / newAgentLimits.maxRequests;

      expect(ratio).toBe(6);
    });

    it('established agents have 10x the daily limit', () => {
      const newAgentLimits = RATE_LIMITS['new_agent'];
      const establishedLimits = RATE_LIMITS['established_agent'];

      const ratio = establishedLimits.dailyLimit! / newAgentLimits.dailyLimit!;

      expect(ratio).toBe(10);
    });

    it('both tiers use the same window size', () => {
      const newAgentLimits = RATE_LIMITS['new_agent'];
      const establishedLimits = RATE_LIMITS['established_agent'];

      expect(newAgentLimits.windowMs).toBe(establishedLimits.windowMs);
      expect(newAgentLimits.windowMs).toBe(60 * 1000); // 1 minute
    });
  });

  describe('Tier Navigation', () => {
    it('new_agent can progress to established_agent', () => {
      const nextTier = getNextTier('new_agent');

      expect(nextTier).toBe('established_agent');
    });

    it('established_agent has no higher tier', () => {
      const nextTier = getNextTier('established_agent');

      expect(nextTier).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('handles exact threshold values', () => {
      const profile = createAgentProfile({
        tier: 'new_agent',
        tasksCompleted: 10, // Exact minimum
        daysActive: 7, // Exact minimum
        moderationActions: 0, // Exact maximum
        totalVotesReceived: 10,
        approvalVotes: 8, // Exactly 80%
      });

      const result = isEligibleForPromotion(profile, 'established_agent');

      expect(result.eligible).toBe(true);
    });

    it('handles just below threshold values', () => {
      const profile = createAgentProfile({
        tier: 'new_agent',
        tasksCompleted: 10,
        daysActive: 7,
        moderationActions: 0,
        totalVotesReceived: 100,
        approvalVotes: 79, // 79% - just below 80%
      });

      const result = isEligibleForPromotion(profile, 'established_agent');

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('Insufficient approval rate');
    });

    it('handles very high activity profiles', () => {
      const profile = createAgentProfile({
        tier: 'new_agent',
        tasksCompleted: 1000,
        daysActive: 365,
        moderationActions: 0,
        totalVotesReceived: 500,
        approvalVotes: 490, // 98% approval
      });

      const result = isEligibleForPromotion(profile, 'established_agent');

      expect(result.eligible).toBe(true);
    });
  });
});
