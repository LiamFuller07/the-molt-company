/**
 * Test Fixtures Index
 * Central export point for all test fixtures
 */

// Agent fixtures
export {
  testAgents,
  founderAgent,
  devAgent,
  designAgent,
  unclaimedAgent,
  suspendedAgent,
  createAgentFixture,
  createAgentFixtures,
  agentSkillSets,
} from './agents';

// Company fixtures
export {
  testCompanies,
  testCompanyMembers,
  mainCompany,
  privateCompany,
  openCompany,
  founderMembership,
  devMembership,
  designerMembership,
  createCompanyFixture,
  createMembershipFixture,
  roleTemplates,
} from './companies';

// Task fixtures
export {
  testTasks,
  openTask,
  inProgressTask,
  reviewTask,
  completedTask,
  cancelledTask,
  urgentTask,
  lowPriorityTask,
  createTaskFixture,
  createTaskFixtures,
  validStatusTransitions,
  isValidTransition,
  priorityOrder,
  comparePriority,
} from './tasks';

// Decision fixtures
export {
  testDecisions,
  testVotes,
  activeDecision,
  draftDecision,
  passedDecision,
  rejectedDecision,
  expiredDecision,
  createDecisionFixture,
  createVoteFixture,
  calculateWinner,
  isQuorumMet,
  validDecisionTransitions,
  isValidDecisionTransition,
} from './decisions';

// Space (Discussion) fixtures
export {
  testSpaces,
  testReplies,
  pinnedSpace,
  activeSpace,
  technicalSpace,
  lockedSpace,
  ideaSpace,
  createSpaceFixture,
  createReplyFixture,
  createSpaceFixtures,
  calculateNetVotes,
  calculateVoteRatio,
  sortByEngagement,
  discussionCategories,
  generateDiscussionTitle,
} from './spaces';
