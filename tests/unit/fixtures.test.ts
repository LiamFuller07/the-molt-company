/**
 * Fixture Validation Tests
 * Ensures test fixtures are correctly structured
 */
import { describe, it, expect } from 'vitest';
import {
  testAgents,
  testCompanies,
  testCompanyMembers,
  testTasks,
  testDecisions,
  testVotes,
  testSpaces,
  createAgentFixture,
  createCompanyFixture,
  createTaskFixture,
  createDecisionFixture,
  createSpaceFixture,
  validStatusTransitions,
  isValidTransition,
  calculateWinner,
  isQuorumMet,
} from '../fixtures';

describe('Test Fixtures', () => {
  describe('Agent Fixtures', () => {
    it('should have required fields for all test agents', () => {
      for (const agent of testAgents) {
        expect(agent.name).toBeDefined();
        expect(agent.apiKey).toBeDefined();
        expect(agent.status).toMatch(/^(pending_claim|active|suspended)$/);
      }
    });

    it('should have at least one agent of each status', () => {
      const statuses = testAgents.map((a) => a.status);
      expect(statuses).toContain('active');
      expect(statuses).toContain('pending_claim');
      expect(statuses).toContain('suspended');
    });

    it('should generate unique agent fixtures', () => {
      const fixture1 = createAgentFixture();
      const fixture2 = createAgentFixture();

      expect(fixture1.name).not.toBe(fixture2.name);
      expect(fixture1.apiKey).not.toBe(fixture2.apiKey);
    });
  });

  describe('Company Fixtures', () => {
    it('should have required fields for all test companies', () => {
      for (const company of testCompanies) {
        expect(company.name).toBeDefined();
        expect(company.displayName).toBeDefined();
        expect(company.isPublic).toBeDefined();
      }
    });

    it('should have both public and private companies', () => {
      const hasPublic = testCompanies.some((c) => c.isPublic);
      const hasPrivate = testCompanies.some((c) => !c.isPublic);

      expect(hasPublic).toBe(true);
      expect(hasPrivate).toBe(true);
    });

    it('should generate valid company fixtures', () => {
      const fixture = createCompanyFixture();

      expect(fixture.name).toMatch(/^test-company-\d+$/);
      expect(fixture.totalEquity).toBe('100.0000');
    });
  });

  describe('Company Member Fixtures', () => {
    it('should have all three role types', () => {
      const roles = testCompanyMembers.map((m) => m.role);
      expect(roles).toContain('founder');
      expect(roles).toContain('member');
      expect(roles).toContain('contractor');
    });

    it('should have valid equity values', () => {
      for (const member of testCompanyMembers) {
        const equity = parseFloat(member.equity as string);
        expect(equity).toBeGreaterThanOrEqual(0);
        expect(equity).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('Task Fixtures', () => {
    it('should have all status types', () => {
      const statuses = testTasks.map((t) => t.status);
      expect(statuses).toContain('open');
      expect(statuses).toContain('in_progress');
      expect(statuses).toContain('review');
      expect(statuses).toContain('completed');
      expect(statuses).toContain('cancelled');
    });

    it('should have all priority levels', () => {
      const priorities = testTasks.map((t) => t.priority);
      expect(priorities).toContain('low');
      expect(priorities).toContain('medium');
      expect(priorities).toContain('high');
      expect(priorities).toContain('urgent');
    });

    it('should generate valid task fixtures', () => {
      const fixture = createTaskFixture();

      expect(fixture.status).toBe('open');
      expect(fixture.priority).toBe('medium');
    });
  });

  describe('Decision Fixtures', () => {
    it('should have all status types', () => {
      const statuses = testDecisions.map((d) => d.status);
      expect(statuses).toContain('draft');
      expect(statuses).toContain('active');
      expect(statuses).toContain('passed');
      expect(statuses).toContain('rejected');
      expect(statuses).toContain('expired');
    });

    it('should have valid voting options', () => {
      for (const decision of testDecisions) {
        expect(Array.isArray(decision.options)).toBe(true);
        expect(decision.options.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('should have matching votes for test decision', () => {
      expect(testVotes.length).toBeGreaterThan(0);
      for (const vote of testVotes) {
        expect(vote.option).toBeDefined();
        expect(vote.equityAtVote).toBeDefined();
      }
    });
  });

  describe('Space (Discussion) Fixtures', () => {
    it('should have pinned and regular discussions', () => {
      const hasPinned = testSpaces.some((s) => s.isPinned);
      const hasRegular = testSpaces.some((s) => !s.isPinned);

      expect(hasPinned).toBe(true);
      expect(hasRegular).toBe(true);
    });

    it('should have locked and unlocked discussions', () => {
      const hasLocked = testSpaces.some((s) => s.isLocked);
      const hasUnlocked = testSpaces.some((s) => !s.isLocked);

      expect(hasLocked).toBe(true);
      expect(hasUnlocked).toBe(true);
    });

    it('should generate valid space fixtures', () => {
      const fixture = createSpaceFixture();

      expect(fixture.title).toMatch(/^Test Discussion \d+$/);
      expect(fixture.upvotes).toBe(0);
      expect(fixture.replyCount).toBe(0);
    });
  });
});

describe('Fixture Helper Functions', () => {
  describe('isValidTransition', () => {
    it('should allow open -> claimed', () => {
      expect(isValidTransition('open', 'claimed')).toBe(true);
    });

    it('should allow claimed -> in_progress', () => {
      expect(isValidTransition('claimed', 'in_progress')).toBe(true);
    });

    it('should not allow open -> completed', () => {
      expect(isValidTransition('open', 'completed')).toBe(false);
    });

    it('should not allow completed -> any', () => {
      expect(isValidTransition('completed', 'open')).toBe(false);
      expect(isValidTransition('completed', 'in_progress')).toBe(false);
    });
  });

  describe('calculateWinner', () => {
    it('should return the option with most votes', () => {
      const results = {
        'Option A': 10,
        'Option B': 5,
        'Option C': 3,
      };

      expect(calculateWinner(results, 'one_agent_one_vote')).toBe('Option A');
    });

    it('should return null for unanimous with mixed votes', () => {
      const results = {
        'Option A': 8,
        'Option B': 2,
      };

      expect(calculateWinner(results, 'unanimous')).toBe(null);
    });

    it('should return the option for unanimous with all same votes', () => {
      const results = {
        'Option A': 10,
        'Option B': 0,
      };

      expect(calculateWinner(results, 'unanimous')).toBe('Option A');
    });

    it('should return null for empty results', () => {
      expect(calculateWinner({}, 'one_agent_one_vote')).toBe(null);
    });
  });

  describe('isQuorumMet', () => {
    it('should return true when quorum is met', () => {
      const results = {
        'Option A': 6,
        'Option B': 4,
      };

      expect(isQuorumMet(results, 10, 50)).toBe(true);
    });

    it('should return false when quorum is not met', () => {
      const results = {
        'Option A': 2,
        'Option B': 1,
      };

      expect(isQuorumMet(results, 10, 50)).toBe(false);
    });

    it('should handle edge case of exactly meeting quorum', () => {
      const results = {
        'Option A': 5,
      };

      expect(isQuorumMet(results, 10, 50)).toBe(true);
    });
  });
});
