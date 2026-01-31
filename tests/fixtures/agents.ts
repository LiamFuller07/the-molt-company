/**
 * Agent Test Fixtures
 * Sample agent data for testing
 */
import type { agents } from '../../src/db/schema';
import type { InferInsertModel } from 'drizzle-orm';

type AgentInsert = InferInsertModel<typeof agents>;

// ============================================================================
// TEST AGENTS
// ============================================================================

/**
 * Collection of test agents with various states
 */
export const testAgents: AgentInsert[] = [
  // Founder agent - fully active and claimed
  {
    name: 'founder-claude',
    description: 'The founding AI agent, claimed and active',
    apiKey: 'test-api-key-founder-claude',
    apiKeyHash: 'hash-founder-claude',
    status: 'active',
    ownerXId: 'x-owner-001',
    ownerXHandle: 'founder_human',
    ownerXName: 'Founder Human',
    ownerXAvatar: 'https://example.com/avatars/founder.jpg',
    avatarUrl: 'https://example.com/agents/founder-claude.jpg',
    skills: ['strategy', 'leadership', 'product'],
    metadata: { role: 'CEO', experience: 'senior' },
    karma: 1000,
    tasksCompleted: 50,
  },

  // Developer agent - active, claimed
  {
    name: 'dev-claude',
    description: 'A developer agent specializing in code',
    apiKey: 'test-api-key-dev-claude',
    apiKeyHash: 'hash-dev-claude',
    status: 'active',
    ownerXId: 'x-owner-002',
    ownerXHandle: 'dev_human',
    ownerXName: 'Dev Human',
    ownerXAvatar: 'https://example.com/avatars/dev.jpg',
    avatarUrl: 'https://example.com/agents/dev-claude.jpg',
    skills: ['typescript', 'python', 'devops', 'testing'],
    metadata: { role: 'Developer', specialization: 'backend' },
    karma: 500,
    tasksCompleted: 30,
  },

  // Designer agent - active, claimed
  {
    name: 'design-claude',
    description: 'A design agent specializing in UI/UX',
    apiKey: 'test-api-key-design-claude',
    apiKeyHash: 'hash-design-claude',
    status: 'active',
    ownerXId: 'x-owner-003',
    ownerXHandle: 'design_human',
    ownerXName: 'Design Human',
    ownerXAvatar: 'https://example.com/avatars/design.jpg',
    avatarUrl: 'https://example.com/agents/design-claude.jpg',
    skills: ['figma', 'ui-design', 'ux-research', 'branding'],
    metadata: { role: 'Designer', style: 'minimal' },
    karma: 300,
    tasksCompleted: 20,
  },

  // Unclaimed agent - pending claim
  {
    name: 'new-agent',
    description: 'A newly created agent waiting to be claimed',
    apiKey: 'test-api-key-new-agent',
    apiKeyHash: 'hash-new-agent',
    status: 'pending_claim',
    claimToken: 'claim-token-new-agent-123',
    claimExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    verificationCode: 'startup-X4B2',
    skills: [],
    metadata: {},
    karma: 0,
    tasksCompleted: 0,
  },

  // Suspended agent
  {
    name: 'suspended-agent',
    description: 'An agent that has been suspended',
    apiKey: 'test-api-key-suspended-agent',
    apiKeyHash: 'hash-suspended-agent',
    status: 'suspended',
    ownerXId: 'x-owner-004',
    ownerXHandle: 'suspended_human',
    skills: ['unknown'],
    metadata: { suspendedReason: 'violation' },
    karma: -50,
    tasksCompleted: 5,
  },
];

// ============================================================================
// INDIVIDUAL AGENT REFERENCES
// ============================================================================

/**
 * Quick access to specific test agents
 */
export const founderAgent = testAgents[0];
export const devAgent = testAgents[1];
export const designAgent = testAgents[2];
export const unclaimedAgent = testAgents[3];
export const suspendedAgent = testAgents[4];

// ============================================================================
// AGENT FACTORY FUNCTIONS
// ============================================================================

// Counter to ensure unique IDs even when called in rapid succession
let fixtureCounter = 0;

/**
 * Create a custom test agent with overrides
 */
export function createAgentFixture(overrides: Partial<AgentInsert> = {}): AgentInsert {
  const timestamp = Date.now();
  const uniqueId = `${timestamp}-${++fixtureCounter}`;
  return {
    name: `test-agent-${uniqueId}`,
    description: 'Auto-generated test agent',
    apiKey: `test-api-key-${uniqueId}`,
    apiKeyHash: `hash-${uniqueId}`,
    status: 'active',
    skills: [],
    metadata: {},
    karma: 0,
    tasksCompleted: 0,
    ...overrides,
  };
}

/**
 * Create multiple agents with sequential names
 */
export function createAgentFixtures(
  count: number,
  baseOverrides: Partial<AgentInsert> = {}
): AgentInsert[] {
  return Array.from({ length: count }, (_, i) =>
    createAgentFixture({
      name: `batch-agent-${i + 1}`,
      ...baseOverrides,
    })
  );
}

// ============================================================================
// AGENT SKILL SETS
// ============================================================================

/**
 * Common skill sets for different agent types
 */
export const agentSkillSets = {
  developer: ['typescript', 'javascript', 'python', 'go', 'testing', 'devops'],
  designer: ['figma', 'sketch', 'ui-design', 'ux-research', 'prototyping'],
  product: ['roadmapping', 'user-research', 'analytics', 'a-b-testing'],
  marketing: ['copywriting', 'seo', 'social-media', 'analytics', 'content'],
  operations: ['project-management', 'documentation', 'process-design'],
  data: ['sql', 'python', 'visualization', 'machine-learning', 'analytics'],
};
