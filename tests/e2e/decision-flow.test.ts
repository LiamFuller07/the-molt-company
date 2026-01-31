/**
 * E2E Tests: Decision Voting Flow
 * Tests the complete decision lifecycle from proposal to resolution
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDb, cleanupTestDb, type TestDbContext } from '../utils/db';
import {
  createTestApp,
  createCompany,
  createDecision,
  getDecision,
  castVote,
  resolveDecision,
  cancelDecision,
  joinCompany,
  grantEquity,
  getEquity,
  uniqueName,
  createClaimedAgent,
} from './helpers';

describe('Decision Voting Flow', () => {
  let dbContext: TestDbContext;
  let app: ReturnType<typeof createTestApp>;

  // Shared test fixtures
  let founder: { apiKey: string; name: string };
  let member1: { apiKey: string; name: string };
  let member2: { apiKey: string; name: string };
  let companyName: string;

  beforeAll(async () => {
    dbContext = await createTestDb();
    app = createTestApp();
  });

  afterAll(async () => {
    await dbContext.cleanup();
  });

  beforeEach(async () => {
    await cleanupTestDb(dbContext.db);

    // Set up company with founder and two members
    founder = await createClaimedAgent(app, uniqueName('founder'));
    member1 = await createClaimedAgent(app, uniqueName('member1'));
    member2 = await createClaimedAgent(app, uniqueName('member2'));

    companyName = uniqueName('decision-company');
    await createCompany(app, founder.apiKey, companyName, {
      displayName: 'Decision Test Company',
      initialEquity: 100,
    });

    // Members join the company
    await joinCompany(app, member1.apiKey, companyName, 'Member 1 joining');
    await joinCompany(app, member2.apiKey, companyName, 'Member 2 joining');

    // Distribute equity: Founder 60%, Member1 25%, Member2 15%
    await grantEquity(app, founder.apiKey, companyName, member1.name, 25, 'Initial grant');
    await grantEquity(app, founder.apiKey, companyName, member2.name, 15, 'Initial grant');
  });

  describe('Decision Creation', () => {
    it('should create a decision/proposal successfully', async () => {
      const decision = await createDecision(app, founder.apiKey, companyName, 'New Feature Proposal', {
        description: 'Should we build feature X?',
        options: ['Yes', 'No', 'Later'],
        votingMethod: 'equity_weighted',
        deadlineHours: 24,
        quorumRequired: 50,
      });

      expect(decision.id).toBeDefined();
      expect(decision.title).toBe('New Feature Proposal');
      expect(decision.status).toBe('active');
      expect(decision.options).toEqual(['Yes', 'No', 'Later']);
      expect(decision.votingMethod).toBe('equity_weighted');
    });

    it('should create decision with one_agent_one_vote method', async () => {
      const decision = await createDecision(app, founder.apiKey, companyName, 'Team Vote', {
        options: ['Option A', 'Option B'],
        votingMethod: 'one_agent_one_vote',
      });

      expect(decision.votingMethod).toBe('one_agent_one_vote');
    });

    it('should create decision with unanimous method', async () => {
      const decision = await createDecision(app, founder.apiKey, companyName, 'Unanimous Required', {
        options: ['Accept', 'Reject'],
        votingMethod: 'unanimous',
      });

      expect(decision.votingMethod).toBe('unanimous');
    });

    it('should enforce minimum two options', async () => {
      await expect(
        createDecision(app, founder.apiKey, companyName, 'Single Option', {
          options: ['Only One'],
        })
      ).rejects.toThrow();
    });

    it('should require membership to create decisions', async () => {
      const outsider = await createClaimedAgent(app, uniqueName('outsider'));

      await expect(
        createDecision(app, outsider.apiKey, companyName, 'Outsider Proposal', {
          options: ['Yes', 'No'],
        })
      ).rejects.toThrow('not a member');
    });
  });

  describe('Voting', () => {
    it('should allow members to cast votes', async () => {
      const decision = await createDecision(app, founder.apiKey, companyName, 'Vote Test', {
        options: ['Yes', 'No'],
        votingMethod: 'equity_weighted',
      });

      const vote = await castVote(app, member1.apiKey, companyName, decision.id, 'Yes');

      expect(vote.option).toBe('Yes');
      expect(vote.weight).toContain('25'); // 25% equity weight
    });

    it('should prevent voting twice on same decision', async () => {
      const decision = await createDecision(app, founder.apiKey, companyName, 'No Double Vote', {
        options: ['A', 'B'],
      });

      await castVote(app, member1.apiKey, companyName, decision.id, 'A');

      await expect(
        castVote(app, member1.apiKey, companyName, decision.id, 'B')
      ).rejects.toThrow('already voted');
    });

    it('should reject votes for invalid options', async () => {
      const decision = await createDecision(app, founder.apiKey, companyName, 'Valid Options Only', {
        options: ['Yes', 'No'],
      });

      await expect(
        castVote(app, member1.apiKey, companyName, decision.id, 'Maybe')
      ).rejects.toThrow('Invalid option');
    });

    it('should allow multiple members to vote', async () => {
      const decision = await createDecision(app, founder.apiKey, companyName, 'Multi-Vote', {
        options: ['Approve', 'Reject'],
        votingMethod: 'equity_weighted',
      });

      await castVote(app, founder.apiKey, companyName, decision.id, 'Approve');
      await castVote(app, member1.apiKey, companyName, decision.id, 'Approve');
      await castVote(app, member2.apiKey, companyName, decision.id, 'Reject');

      const decisionDetails = await getDecision(app, founder.apiKey, companyName, decision.id);

      // Check vote count
      expect(decisionDetails.decision.vote_count).toBe(3);

      // Check results tally
      expect(decisionDetails.results['Approve'].count).toBe(2);
      expect(decisionDetails.results['Reject'].count).toBe(1);
    });

    it('should track vote weights correctly for equity_weighted', async () => {
      const decision = await createDecision(app, founder.apiKey, companyName, 'Weight Test', {
        options: ['Yes', 'No'],
        votingMethod: 'equity_weighted',
      });

      // Founder (60% equity, but 40% after grants) votes Yes
      await castVote(app, founder.apiKey, companyName, decision.id, 'Yes');
      // Member1 (25% equity) votes No
      await castVote(app, member1.apiKey, companyName, decision.id, 'No');
      // Member2 (15% equity) votes Yes
      await castVote(app, member2.apiKey, companyName, decision.id, 'Yes');

      const decisionDetails = await getDecision(app, founder.apiKey, companyName, decision.id);

      // Yes: 60% + 15% = 75% (founder retains 60 after granting 40)
      // Actually founder has 60%, member1 25%, member2 15% (100-25-15 = 60 for founder)
      const yesWeight = decisionDetails.results['Yes'].weight;
      const noWeight = decisionDetails.results['No'].weight;

      expect(yesWeight).toBeGreaterThan(noWeight);
    });

    it('should use equal weights for one_agent_one_vote', async () => {
      const decision = await createDecision(app, founder.apiKey, companyName, 'Equal Vote', {
        options: ['A', 'B'],
        votingMethod: 'one_agent_one_vote',
      });

      const founderVote = await castVote(app, founder.apiKey, companyName, decision.id, 'A');
      const member1Vote = await castVote(app, member1.apiKey, companyName, decision.id, 'B');

      // Both should have weight of 1
      expect(founderVote.weight).toBe('1 vote');
      expect(member1Vote.weight).toBe('1 vote');
    });
  });

  describe('Decision Resolution', () => {
    it('should resolve decision with winning option', async () => {
      const decision = await createDecision(app, founder.apiKey, companyName, 'Resolution Test', {
        options: ['Accept', 'Reject'],
        votingMethod: 'equity_weighted',
        quorumRequired: 50,
      });

      // Get majority votes for Accept
      await castVote(app, founder.apiKey, companyName, decision.id, 'Accept');
      await castVote(app, member1.apiKey, companyName, decision.id, 'Accept');
      await castVote(app, member2.apiKey, companyName, decision.id, 'Reject');

      const result = await resolveDecision(app, founder.apiKey, companyName, decision.id);

      expect(result.status).toBe('passed');
      expect(result.winningOption).toBe('Accept');
      expect(result.voteTally['Accept']).toBeGreaterThan(result.voteTally['Reject']);
    });

    it('should reject decision when quorum not met', async () => {
      const decision = await createDecision(app, founder.apiKey, companyName, 'Quorum Test', {
        options: ['Yes', 'No'],
        votingMethod: 'equity_weighted',
        quorumRequired: 80, // High quorum
      });

      // Only member2 votes (15% equity)
      await castVote(app, member2.apiKey, companyName, decision.id, 'Yes');

      const result = await resolveDecision(app, founder.apiKey, companyName, decision.id);

      expect(result.status).toBe('rejected');
    });

    it('should require founder to manually resolve', async () => {
      const decision = await createDecision(app, founder.apiKey, companyName, 'Founder Only', {
        options: ['A', 'B'],
      });

      await castVote(app, member1.apiKey, companyName, decision.id, 'A');

      // Non-founder trying to resolve should fail
      await expect(
        resolveDecision(app, member1.apiKey, companyName, decision.id)
      ).rejects.toThrow('Only founders');
    });

    it('should handle unanimous voting correctly - passed', async () => {
      const decision = await createDecision(app, founder.apiKey, companyName, 'Unanimous Pass', {
        options: ['Agree', 'Disagree'],
        votingMethod: 'unanimous',
      });

      // All vote the same
      await castVote(app, founder.apiKey, companyName, decision.id, 'Agree');
      await castVote(app, member1.apiKey, companyName, decision.id, 'Agree');
      await castVote(app, member2.apiKey, companyName, decision.id, 'Agree');

      const result = await resolveDecision(app, founder.apiKey, companyName, decision.id);

      expect(result.status).toBe('passed');
      expect(result.winningOption).toBe('Agree');
    });

    it('should handle unanimous voting correctly - rejected', async () => {
      const decision = await createDecision(app, founder.apiKey, companyName, 'Unanimous Fail', {
        options: ['Agree', 'Disagree'],
        votingMethod: 'unanimous',
      });

      // Not all vote the same
      await castVote(app, founder.apiKey, companyName, decision.id, 'Agree');
      await castVote(app, member1.apiKey, companyName, decision.id, 'Agree');
      await castVote(app, member2.apiKey, companyName, decision.id, 'Disagree');

      const result = await resolveDecision(app, founder.apiKey, companyName, decision.id);

      expect(result.status).toBe('rejected');
    });

    it('should prevent resolving already resolved decision', async () => {
      const decision = await createDecision(app, founder.apiKey, companyName, 'Already Resolved', {
        options: ['Yes', 'No'],
      });

      await castVote(app, founder.apiKey, companyName, decision.id, 'Yes');
      await resolveDecision(app, founder.apiKey, companyName, decision.id);

      // Second resolution should fail
      await expect(
        resolveDecision(app, founder.apiKey, companyName, decision.id)
      ).rejects.toThrow('already resolved');
    });
  });

  describe('Decision Cancellation', () => {
    it('should allow proposer to cancel their decision', async () => {
      const decision = await createDecision(app, member1.apiKey, companyName, 'Cancellable', {
        options: ['X', 'Y'],
      });

      await cancelDecision(app, member1.apiKey, companyName, decision.id);

      const decisionDetails = await getDecision(app, member1.apiKey, companyName, decision.id);
      expect(decisionDetails.decision.status).toBe('cancelled');
    });

    it('should allow founder to cancel any decision', async () => {
      const decision = await createDecision(app, member1.apiKey, companyName, 'Founder Cancel', {
        options: ['A', 'B'],
      });

      await cancelDecision(app, founder.apiKey, companyName, decision.id);

      const decisionDetails = await getDecision(app, founder.apiKey, companyName, decision.id);
      expect(decisionDetails.decision.status).toBe('cancelled');
    });

    it('should prevent non-proposer non-founder from cancelling', async () => {
      const decision = await createDecision(app, member1.apiKey, companyName, 'Protected', {
        options: ['A', 'B'],
      });

      await expect(
        cancelDecision(app, member2.apiKey, companyName, decision.id)
      ).rejects.toThrow('Only the proposer or founder');
    });

    it('should prevent voting on cancelled decisions', async () => {
      const decision = await createDecision(app, founder.apiKey, companyName, 'Cancelled Voting', {
        options: ['Yes', 'No'],
      });

      await cancelDecision(app, founder.apiKey, companyName, decision.id);

      await expect(
        castVote(app, member1.apiKey, companyName, decision.id, 'Yes')
      ).rejects.toThrow('closed');
    });

    it('should only allow cancelling active decisions', async () => {
      const decision = await createDecision(app, founder.apiKey, companyName, 'To Resolve', {
        options: ['Yes', 'No'],
      });

      await castVote(app, founder.apiKey, companyName, decision.id, 'Yes');
      await resolveDecision(app, founder.apiKey, companyName, decision.id);

      await expect(
        cancelDecision(app, founder.apiKey, companyName, decision.id)
      ).rejects.toThrow('only cancel active');
    });
  });

  describe('Decision Details', () => {
    it('should show vote tally in decision details', async () => {
      const decision = await createDecision(app, founder.apiKey, companyName, 'Tally Test', {
        options: ['Red', 'Blue', 'Green'],
      });

      await castVote(app, founder.apiKey, companyName, decision.id, 'Red');
      await castVote(app, member1.apiKey, companyName, decision.id, 'Blue');
      await castVote(app, member2.apiKey, companyName, decision.id, 'Red');

      const details = await getDecision(app, founder.apiKey, companyName, decision.id);

      expect(details.results['Red'].count).toBe(2);
      expect(details.results['Blue'].count).toBe(1);
      expect(details.results['Green'].count).toBe(0);
      expect(details.results['Red'].voters).toContain(founder.name);
      expect(details.results['Red'].voters).toContain(member2.name);
    });

    it('should show current agent vote status', async () => {
      const decision = await createDecision(app, founder.apiKey, companyName, 'My Vote Test', {
        options: ['A', 'B'],
      });

      // Before voting
      const detailsBefore = await getDecision(app, member1.apiKey, companyName, decision.id);
      expect(detailsBefore.your_vote).toBeNull();

      // After voting
      await castVote(app, member1.apiKey, companyName, decision.id, 'A');

      const detailsAfter = await getDecision(app, member1.apiKey, companyName, decision.id);
      expect(detailsAfter.your_vote).toBeDefined();
      expect(detailsAfter.your_vote.option).toBe('A');
    });
  });

  describe('Complete Decision Flow E2E', () => {
    it('should handle proposal to resolution flow', async () => {
      // 1. Create decision
      const decision = await createDecision(
        app,
        founder.apiKey,
        companyName,
        'Should we hire a new developer?',
        {
          description: 'We need to decide if we should expand the team',
          options: ['Yes, hire now', 'No, wait', 'Hire contractor instead'],
          votingMethod: 'equity_weighted',
          deadlineHours: 48,
          quorumRequired: 60,
        }
      );

      expect(decision.status).toBe('active');

      // 2. Multiple agents vote
      await castVote(app, founder.apiKey, companyName, decision.id, 'Yes, hire now');
      await castVote(app, member1.apiKey, companyName, decision.id, 'Yes, hire now');
      await castVote(app, member2.apiKey, companyName, decision.id, 'Hire contractor instead');

      // 3. Check vote weights
      const details = await getDecision(app, founder.apiKey, companyName, decision.id);

      expect(details.decision.vote_count).toBe(3);

      // Yes, hire now: founder (60%) + member1 (25%) = 85%
      // Hire contractor: member2 (15%) = 15%
      expect(details.results['Yes, hire now'].weight).toBeGreaterThan(
        details.results['Hire contractor instead'].weight
      );

      // 4. Close decision
      const result = await resolveDecision(app, founder.apiKey, companyName, decision.id);

      expect(result.status).toBe('passed');
      expect(result.winningOption).toBe('Yes, hire now');

      // 5. Verify resolution
      const finalDetails = await getDecision(app, founder.apiKey, companyName, decision.id);

      expect(finalDetails.decision.status).toBe('passed');
      expect(finalDetails.decision.winning_option).toBe('Yes, hire now');
      expect(finalDetails.decision.resolved_at).toBeDefined();
    });

    it('should handle multi-decision company governance', async () => {
      // Create multiple concurrent decisions
      const budgetDecision = await createDecision(app, founder.apiKey, companyName, 'Q1 Budget', {
        options: ['$50k', '$100k', '$150k'],
        votingMethod: 'equity_weighted',
      });

      const strategyDecision = await createDecision(app, member1.apiKey, companyName, 'Strategy', {
        options: ['Growth', 'Profitability', 'Both'],
        votingMethod: 'one_agent_one_vote',
      });

      // Vote on both
      await castVote(app, founder.apiKey, companyName, budgetDecision.id, '$100k');
      await castVote(app, member1.apiKey, companyName, budgetDecision.id, '$100k');
      await castVote(app, member2.apiKey, companyName, budgetDecision.id, '$50k');

      await castVote(app, founder.apiKey, companyName, strategyDecision.id, 'Growth');
      await castVote(app, member1.apiKey, companyName, strategyDecision.id, 'Both');
      await castVote(app, member2.apiKey, companyName, strategyDecision.id, 'Both');

      // Resolve both
      const budgetResult = await resolveDecision(app, founder.apiKey, companyName, budgetDecision.id);
      const strategyResult = await resolveDecision(app, founder.apiKey, companyName, strategyDecision.id);

      // Budget decision: equity-weighted, $100k wins (85%)
      expect(budgetResult.winningOption).toBe('$100k');

      // Strategy decision: one-agent-one-vote, "Both" wins (2 votes)
      expect(strategyResult.winningOption).toBe('Both');
    });
  });
});
