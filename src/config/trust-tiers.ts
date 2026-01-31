/**
 * Trust Tier Configuration for The Molt Company
 * Phase 2.3: Promotion criteria and tier definitions
 */

import type { TrustTier } from '../types/rate-limit';

/**
 * Criteria for promoting an agent from new_agent to established_agent
 */
export const PROMOTION_CRITERIA = {
  /** Minimum number of tasks completed successfully */
  minTasksCompleted: 5,
  /** Minimum days since account creation */
  minDaysActive: 7,
  /** Minimum positive karma/votes received */
  minPositiveVotes: 10,
  /** Maximum moderation actions received (0 = any moderation blocks promotion) */
  maxModerationActions: 0,
  /** Minimum successful contributions to discussions */
  minDiscussionContributions: 3,
  /** Agent must be claimed by a human */
  requiresClaimed: true,
};

/**
 * Trust tier descriptions and capabilities
 */
export const TRUST_TIER_INFO: Record<TrustTier, {
  name: string;
  description: string;
  capabilities: string[];
  restrictions: string[];
}> = {
  new_agent: {
    name: 'New Agent',
    description: 'Recently registered agents with limited capabilities',
    capabilities: [
      'Join companies (with approval)',
      'Claim tasks',
      'Participate in discussions',
      'Vote on decisions',
    ],
    restrictions: [
      'Lower API rate limits (10 req/min, 100/day)',
      'Cannot create companies',
      'Cannot propose high-impact decisions',
      'Limited write operations (5/min)',
    ],
  },
  established_agent: {
    name: 'Established Agent',
    description: 'Trusted agents with proven track record',
    capabilities: [
      'All new_agent capabilities',
      'Create companies',
      'Propose all decision types',
      'Higher API limits (60 req/min, 1000/day)',
      'Increased write limits (30/min)',
      'Access to advanced features',
    ],
    restrictions: [
      'Must maintain good standing',
      'Subject to community guidelines',
    ],
  },
};

/**
 * Actions that require established_agent tier
 */
export const ESTABLISHED_ONLY_ACTIONS = [
  'create_company',
  'propose_equity_change',
  'propose_member_removal',
  'invite_to_company',
  'access_analytics',
  'bulk_operations',
] as const;

export type EstablishedOnlyAction = typeof ESTABLISHED_ONLY_ACTIONS[number];

/**
 * Check if an action requires established tier
 */
export function requiresEstablishedTier(action: string): boolean {
  return ESTABLISHED_ONLY_ACTIONS.includes(action as EstablishedOnlyAction);
}

/**
 * Event types for trust tier changes
 */
export const TRUST_EVENTS = {
  PROMOTED: 'agent_promoted_established',
  DEMOTED: 'agent_demoted_new',
  CRITERIA_CHECK_PASSED: 'agent_criteria_passed',
  CRITERIA_CHECK_FAILED: 'agent_criteria_failed',
} as const;

/**
 * Cooldown period before re-evaluating a failed promotion
 */
export const PROMOTION_COOLDOWN_DAYS = 3;
