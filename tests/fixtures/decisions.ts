/**
 * Decision Test Fixtures
 * Sample decision/governance data for testing
 */
import type { decisions, votes } from '../../src/db/schema';
import type { InferInsertModel } from 'drizzle-orm';

type DecisionInsert = InferInsertModel<typeof decisions>;
type VoteInsert = InferInsertModel<typeof votes>;

// ============================================================================
// TEST DECISIONS
// ============================================================================

/**
 * Collection of test decisions with various statuses
 * Note: companyId, proposedBy will be set during seeding
 */
export const testDecisions: Omit<DecisionInsert, 'companyId' | 'proposedBy'>[] = [
  // Active voting decision
  {
    title: 'Hire new frontend developer',
    description:
      'We need to expand our team with a frontend specialist. Budget approved for a senior-level hire.',
    status: 'active',
    votingMethod: 'equity_weighted',
    options: ['Approve hire', 'Reject hire', 'Defer 1 month'],
    results: {
      'Approve hire': 45.5,
      'Reject hire': 10.0,
      'Defer 1 month': 5.0,
    },
    votingStartsAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // Started 2 days ago
    votingEndsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // Ends in 5 days
  },

  // Draft decision (not yet active)
  {
    title: 'Change company name',
    description: 'Proposal to rebrand from "AI Tools Inc" to "DevAI Labs" for better market positioning.',
    status: 'draft',
    votingMethod: 'unanimous',
    options: ['Approve rebrand', 'Keep current name'],
    results: {},
  },

  // Passed decision
  {
    title: 'Adopt TypeScript for all projects',
    description: 'Standardize on TypeScript for improved type safety and developer experience.',
    status: 'passed',
    votingMethod: 'one_agent_one_vote',
    options: ['Adopt TypeScript', 'Keep mixed languages', 'Use Flow instead'],
    results: {
      'Adopt TypeScript': 3,
      'Keep mixed languages': 1,
      'Use Flow instead': 0,
    },
    winningOption: 'Adopt TypeScript',
    votingStartsAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    votingEndsAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    executedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
  },

  // Rejected decision
  {
    title: 'Switch to microservices architecture',
    description: 'Proposal to migrate from monolith to microservices for better scalability.',
    status: 'rejected',
    votingMethod: 'equity_weighted',
    options: ['Migrate to microservices', 'Keep monolith'],
    results: {
      'Migrate to microservices': 25.0,
      'Keep monolith': 55.0,
    },
    winningOption: 'Keep monolith',
    votingStartsAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
    votingEndsAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
  },

  // Expired decision (didn't meet quorum)
  {
    title: 'Add coffee machine to office',
    description: 'Purchase a professional espresso machine for the office kitchen.',
    status: 'expired',
    votingMethod: 'one_agent_one_vote',
    options: ['Purchase machine', 'Use budget elsewhere'],
    results: {
      'Purchase machine': 1,
      'Use budget elsewhere': 0,
    },
    votingStartsAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    votingEndsAt: new Date(Date.now() - 23 * 24 * 60 * 60 * 1000),
  },
];

// ============================================================================
// TEST VOTES
// ============================================================================

/**
 * Test votes corresponding to the active decision
 * Note: decisionId, agentId will be set during seeding
 */
export const testVotes: Omit<VoteInsert, 'decisionId' | 'agentId'>[] = [
  {
    option: 'Approve hire',
    equityAtVote: '40.0000', // Founder's equity
  },
  {
    option: 'Reject hire',
    equityAtVote: '30.0000', // Dev's equity
  },
  {
    option: 'Approve hire',
    equityAtVote: '10.0000', // Designer's equity
  },
];

// ============================================================================
// INDIVIDUAL REFERENCES
// ============================================================================

export const activeDecision = testDecisions[0];
export const draftDecision = testDecisions[1];
export const passedDecision = testDecisions[2];
export const rejectedDecision = testDecisions[3];
export const expiredDecision = testDecisions[4];

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a custom test decision
 */
export function createDecisionFixture(
  overrides: Partial<Omit<DecisionInsert, 'companyId' | 'proposedBy'>> = {}
): Omit<DecisionInsert, 'companyId' | 'proposedBy'> {
  const timestamp = Date.now();
  return {
    title: `Test Decision ${timestamp}`,
    description: 'Auto-generated test decision for voting',
    status: 'draft',
    votingMethod: 'one_agent_one_vote',
    options: ['Option A', 'Option B'],
    results: {},
    ...overrides,
  };
}

/**
 * Create a vote fixture
 */
export function createVoteFixture(
  overrides: Partial<Omit<VoteInsert, 'decisionId' | 'agentId'>> = {}
): Omit<VoteInsert, 'decisionId' | 'agentId'> {
  return {
    option: 'Option A',
    equityAtVote: '10.0000',
    ...overrides,
  };
}

// ============================================================================
// VOTING METHOD HELPERS
// ============================================================================

/**
 * Calculate winner based on voting method
 */
export function calculateWinner(
  results: Record<string, number>,
  method: 'equity_weighted' | 'one_agent_one_vote' | 'unanimous'
): string | null {
  const entries = Object.entries(results);
  if (entries.length === 0) return null;

  if (method === 'unanimous') {
    // All votes must be for the same option
    const [firstOption, firstCount] = entries[0];
    const total = entries.reduce((sum, [, count]) => sum + count, 0);
    return firstCount === total ? firstOption : null;
  }

  // For equity_weighted and one_agent_one_vote, simple majority wins
  const sorted = entries.sort(([, a], [, b]) => b - a);
  return sorted[0][0];
}

/**
 * Check if quorum is met
 */
export function isQuorumMet(
  results: Record<string, number>,
  totalEligible: number,
  quorumPercentage: number = 50
): boolean {
  const totalVotes = Object.values(results).reduce((sum, count) => sum + count, 0);
  return (totalVotes / totalEligible) * 100 >= quorumPercentage;
}

// ============================================================================
// DECISION STATUS WORKFLOW
// ============================================================================

export const validDecisionTransitions: Record<string, string[]> = {
  draft: ['active'],
  active: ['passed', 'rejected', 'expired'],
  passed: [], // Terminal
  rejected: [], // Terminal
  expired: [], // Terminal
};

export function isValidDecisionTransition(from: string, to: string): boolean {
  return validDecisionTransitions[from]?.includes(to) ?? false;
}
