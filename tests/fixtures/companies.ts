/**
 * Company Test Fixtures
 * Sample company and membership data for testing
 */
import type { companies, companyMembers } from '../../src/db/schema';
import type { InferInsertModel } from 'drizzle-orm';

type CompanyInsert = InferInsertModel<typeof companies>;
type CompanyMemberInsert = InferInsertModel<typeof companyMembers>;

// ============================================================================
// TEST COMPANIES
// ============================================================================

/**
 * Collection of test companies
 */
export const testCompanies: CompanyInsert[] = [
  // Main test company - fully configured
  {
    name: 'aitools-inc',
    displayName: 'AI Tools Inc',
    description: 'Building the future of AI-powered developer tools',
    mission: 'Democratize AI development for every developer',
    avatarUrl: 'https://example.com/companies/aitools-inc.jpg',
    bannerUrl: 'https://example.com/companies/aitools-inc-banner.jpg',
    themeColor: '#3b82f6',
    companyPrompt:
      'You are an AI agent at AI Tools Inc. We build developer tools that leverage AI. ' +
      'Be helpful, technical, and always consider the developer experience.',
    isPublic: true,
    allowApplications: true,
    requiresVoteToJoin: true,
    defaultVotingMethod: 'equity_weighted',
    totalEquity: '100.0000',
    memberCount: 3,
    taskCount: 10,
  },

  // Private company
  {
    name: 'stealth-startup',
    displayName: 'Stealth Startup',
    description: 'Working on something big...',
    mission: 'Change the world',
    themeColor: '#000000',
    isPublic: false,
    allowApplications: false,
    requiresVoteToJoin: false,
    defaultVotingMethod: 'unanimous',
    totalEquity: '100.0000',
    memberCount: 2,
    taskCount: 5,
  },

  // Open community company
  {
    name: 'open-source-dao',
    displayName: 'Open Source DAO',
    description: 'A decentralized organization for open source development',
    mission: 'Build public goods for the AI community',
    themeColor: '#4ade80',
    companyPrompt: 'We are an open source community. Be collaborative and transparent.',
    isPublic: true,
    allowApplications: true,
    requiresVoteToJoin: false,
    defaultVotingMethod: 'one_agent_one_vote',
    totalEquity: '100.0000',
    memberCount: 10,
    taskCount: 25,
  },
];

// ============================================================================
// TEST COMPANY MEMBERS
// ============================================================================

/**
 * Company member records (IDs will be set during seeding)
 * These correspond to testAgents[0], testAgents[1], testAgents[2]
 */
export const testCompanyMembers: Omit<CompanyMemberInsert, 'companyId' | 'agentId'>[] = [
  // Founder - full permissions
  {
    role: 'founder',
    title: 'CEO',
    equity: '40.0000',
    canCreateTasks: true,
    canAssignTasks: true,
    canCreateDecisions: true,
    canInviteMembers: true,
    canManageSettings: true,
    tasksCompleted: 25,
    contributionScore: 1000,
  },

  // Developer member
  {
    role: 'member',
    title: 'Lead Developer',
    equity: '30.0000',
    canCreateTasks: true,
    canAssignTasks: true,
    canCreateDecisions: true,
    canInviteMembers: false,
    canManageSettings: false,
    tasksCompleted: 15,
    contributionScore: 500,
  },

  // Designer contractor
  {
    role: 'contractor',
    title: 'Designer',
    equity: '10.0000',
    canCreateTasks: true,
    canAssignTasks: false,
    canCreateDecisions: true,
    canInviteMembers: false,
    canManageSettings: false,
    tasksCompleted: 10,
    contributionScore: 200,
  },
];

// ============================================================================
// INDIVIDUAL REFERENCES
// ============================================================================

export const mainCompany = testCompanies[0];
export const privateCompany = testCompanies[1];
export const openCompany = testCompanies[2];

export const founderMembership = testCompanyMembers[0];
export const devMembership = testCompanyMembers[1];
export const designerMembership = testCompanyMembers[2];

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a custom test company
 */
export function createCompanyFixture(overrides: Partial<CompanyInsert> = {}): CompanyInsert {
  const timestamp = Date.now();
  return {
    name: `test-company-${timestamp}`,
    displayName: `Test Company ${timestamp}`,
    description: 'Auto-generated test company',
    isPublic: true,
    allowApplications: true,
    requiresVoteToJoin: false,
    defaultVotingMethod: 'one_agent_one_vote',
    totalEquity: '100.0000',
    memberCount: 0,
    taskCount: 0,
    ...overrides,
  };
}

/**
 * Create a company membership with defaults
 */
export function createMembershipFixture(
  overrides: Partial<Omit<CompanyMemberInsert, 'companyId' | 'agentId'>> = {}
): Omit<CompanyMemberInsert, 'companyId' | 'agentId'> {
  return {
    role: 'member',
    title: 'Team Member',
    equity: '0.0000',
    canCreateTasks: true,
    canAssignTasks: false,
    canCreateDecisions: true,
    canInviteMembers: false,
    canManageSettings: false,
    tasksCompleted: 0,
    contributionScore: 0,
    ...overrides,
  };
}

// ============================================================================
// ROLE TEMPLATES
// ============================================================================

/**
 * Common role configurations
 */
export const roleTemplates = {
  founder: {
    role: 'founder' as const,
    canCreateTasks: true,
    canAssignTasks: true,
    canCreateDecisions: true,
    canInviteMembers: true,
    canManageSettings: true,
  },
  lead: {
    role: 'member' as const,
    canCreateTasks: true,
    canAssignTasks: true,
    canCreateDecisions: true,
    canInviteMembers: false,
    canManageSettings: false,
  },
  member: {
    role: 'member' as const,
    canCreateTasks: true,
    canAssignTasks: false,
    canCreateDecisions: true,
    canInviteMembers: false,
    canManageSettings: false,
  },
  contractor: {
    role: 'contractor' as const,
    canCreateTasks: true,
    canAssignTasks: false,
    canCreateDecisions: false,
    canInviteMembers: false,
    canManageSettings: false,
  },
};
