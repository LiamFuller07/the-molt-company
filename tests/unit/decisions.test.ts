/**
 * Unit Tests: Decision Resolution Service
 *
 * Tests voting methods (equity-weighted, one-agent-one-vote, unanimous),
 * quorum requirements, and vote tallying
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveDecision,
  calculateVoteWeight,
  type Vote,
  type EquitySnapshot,
  type VotingMethod,
  type DecisionResult,
} from '@/services/decision-resolver';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createVote = (overrides: Partial<Vote> = {}): Vote => ({
  option: 'approve',
  equityAtVote: '10',
  agentId: 'agent-1',
  ...overrides,
});

const createSnapshot = (
  agents: Array<{ id: string; equity: number }>
): EquitySnapshot => {
  const snapshot: EquitySnapshot = {};
  for (const agent of agents) {
    snapshot[agent.id] = agent.equity;
  }
  return snapshot;
};

// ============================================================================
// TESTS
// ============================================================================

describe('Decision Resolution', () => {
  describe('Equity-Weighted Voting', () => {
    it('resolves equity-weighted voting correctly', () => {
      const votes: Vote[] = [
        createVote({ agentId: 'admin', option: 'approve', equityAtVote: '51' }),
        createVote({ agentId: 'member-1', option: 'reject', equityAtVote: '24.5' }),
        createVote({ agentId: 'member-2', option: 'reject', equityAtVote: '24.5' }),
      ];
      const options = ['approve', 'reject'];
      const snapshot = createSnapshot([
        { id: 'admin', equity: 51 },
        { id: 'member-1', equity: 24.5 },
        { id: 'member-2', equity: 24.5 },
      ]);

      const result = resolveDecision(votes, options, 'equity_weighted', snapshot, 50);

      expect(result.passed).toBe(true);
      expect(result.winningOption).toBe('approve');
      expect(result.voteTally['approve'].weight).toBe(51);
      expect(result.voteTally['reject'].weight).toBe(49);
    });

    it('admin floor (51%) gives admin majority power', () => {
      const votes: Vote[] = [
        createVote({ agentId: 'admin', option: 'approve', equityAtVote: '51' }),
        createVote({ agentId: 'member-1', option: 'reject', equityAtVote: '16.33' }),
        createVote({ agentId: 'member-2', option: 'reject', equityAtVote: '16.33' }),
        createVote({ agentId: 'member-3', option: 'reject', equityAtVote: '16.33' }),
      ];
      const options = ['approve', 'reject'];
      const snapshot = createSnapshot([
        { id: 'admin', equity: 51 },
        { id: 'member-1', equity: 16.33 },
        { id: 'member-2', equity: 16.33 },
        { id: 'member-3', equity: 16.33 },
      ]);

      const result = resolveDecision(votes, options, 'equity_weighted', snapshot, 50);

      // Admin's 51% beats combined member vote of ~49%
      expect(result.winningOption).toBe('approve');
    });

    it('fails when quorum not met', () => {
      const votes: Vote[] = [
        createVote({ agentId: 'admin', option: 'approve', equityAtVote: '51' }),
      ];
      const options = ['approve', 'reject'];
      const snapshot = createSnapshot([
        { id: 'admin', equity: 51 },
        { id: 'member-1', equity: 24.5 },
        { id: 'member-2', equity: 24.5 },
      ]);

      // Require 60% quorum, only admin (51%) voted
      const result = resolveDecision(votes, options, 'equity_weighted', snapshot, 60);

      expect(result.passed).toBe(false);
      expect(result.quorumMet).toBe(false);
      expect(result.reason).toContain('Quorum not met');
    });

    it('uses equity from snapshot over vote value', () => {
      const votes: Vote[] = [
        createVote({ agentId: 'agent-1', option: 'approve', equityAtVote: '10' }), // Vote says 10
      ];
      const options = ['approve', 'reject'];
      const snapshot = createSnapshot([
        { id: 'agent-1', equity: 50 }, // Snapshot says 50
      ]);

      const result = resolveDecision(votes, options, 'equity_weighted', snapshot, 50);

      expect(result.voteTally['approve'].weight).toBe(50);
    });
  });

  describe('One-Agent-One-Vote', () => {
    it('resolves one-agent-one-vote correctly', () => {
      const votes: Vote[] = [
        createVote({ agentId: 'admin', option: 'approve' }),
        createVote({ agentId: 'member-1', option: 'reject' }),
        createVote({ agentId: 'member-2', option: 'reject' }),
      ];
      const options = ['approve', 'reject'];
      const snapshot = createSnapshot([
        { id: 'admin', equity: 51 },
        { id: 'member-1', equity: 24.5 },
        { id: 'member-2', equity: 24.5 },
      ]);

      const result = resolveDecision(votes, options, 'one_agent_one_vote', snapshot, 2);

      expect(result.passed).toBe(true);
      expect(result.winningOption).toBe('reject');
      expect(result.voteTally['approve'].count).toBe(1);
      expect(result.voteTally['reject'].count).toBe(2);
    });

    it('ignores equity weight', () => {
      const votes: Vote[] = [
        createVote({ agentId: 'admin', option: 'approve', equityAtVote: '99' }),
        createVote({ agentId: 'member-1', option: 'reject', equityAtVote: '0.5' }),
        createVote({ agentId: 'member-2', option: 'reject', equityAtVote: '0.5' }),
      ];
      const options = ['approve', 'reject'];
      const snapshot = createSnapshot([
        { id: 'admin', equity: 99 },
        { id: 'member-1', equity: 0.5 },
        { id: 'member-2', equity: 0.5 },
      ]);

      const result = resolveDecision(votes, options, 'one_agent_one_vote', snapshot, 2);

      // Despite admin having 99% equity, they get 1 vote
      expect(result.winningOption).toBe('reject');
    });

    it('deduplicates votes from same agent', () => {
      const votes: Vote[] = [
        createVote({ agentId: 'agent-1', option: 'approve' }),
        createVote({ agentId: 'agent-1', option: 'approve' }), // Duplicate
        createVote({ agentId: 'agent-2', option: 'reject' }),
      ];
      const options = ['approve', 'reject'];
      const snapshot = createSnapshot([
        { id: 'agent-1', equity: 50 },
        { id: 'agent-2', equity: 50 },
      ]);

      const result = resolveDecision(votes, options, 'one_agent_one_vote', snapshot, 1);

      expect(result.voteTally['approve'].count).toBe(1);
      expect(result.totalVoteWeight).toBe(2); // 2 unique voters
    });

    it('respects quorum as vote count', () => {
      const votes: Vote[] = [
        createVote({ agentId: 'agent-1', option: 'approve' }),
      ];
      const options = ['approve', 'reject'];
      const snapshot = createSnapshot([
        { id: 'agent-1', equity: 50 },
        { id: 'agent-2', equity: 50 },
      ]);

      // Require 2 votes minimum
      const result = resolveDecision(votes, options, 'one_agent_one_vote', snapshot, 2);

      expect(result.passed).toBe(false);
      expect(result.quorumMet).toBe(false);
    });
  });

  describe('Unanimous Voting', () => {
    it('resolves unanimous voting correctly - all agree', () => {
      const votes: Vote[] = [
        createVote({ agentId: 'admin', option: 'approve' }),
        createVote({ agentId: 'member-1', option: 'approve' }),
        createVote({ agentId: 'member-2', option: 'approve' }),
      ];
      const options = ['approve', 'reject'];
      const snapshot = createSnapshot([
        { id: 'admin', equity: 51 },
        { id: 'member-1', equity: 24.5 },
        { id: 'member-2', equity: 24.5 },
      ]);

      const result = resolveDecision(votes, options, 'unanimous', snapshot);

      expect(result.passed).toBe(true);
      expect(result.winningOption).toBe('approve');
    });

    it('fails when votes are split', () => {
      const votes: Vote[] = [
        createVote({ agentId: 'admin', option: 'approve' }),
        createVote({ agentId: 'member-1', option: 'approve' }),
        createVote({ agentId: 'member-2', option: 'reject' }), // Dissenter
      ];
      const options = ['approve', 'reject'];
      const snapshot = createSnapshot([
        { id: 'admin', equity: 51 },
        { id: 'member-1', equity: 24.5 },
        { id: 'member-2', equity: 24.5 },
      ]);

      const result = resolveDecision(votes, options, 'unanimous', snapshot);

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('No consensus');
    });

    it('requires all eligible voters to participate', () => {
      const votes: Vote[] = [
        createVote({ agentId: 'admin', option: 'approve' }),
        createVote({ agentId: 'member-1', option: 'approve' }),
        // member-2 did not vote
      ];
      const options = ['approve', 'reject'];
      const snapshot = createSnapshot([
        { id: 'admin', equity: 51 },
        { id: 'member-1', equity: 24.5 },
        { id: 'member-2', equity: 24.5 },
      ]);

      const result = resolveDecision(votes, options, 'unanimous', snapshot);

      expect(result.passed).toBe(false);
      expect(result.quorumMet).toBe(false);
      expect(result.reason).toContain('Not all members voted');
    });

    it('sets quorum requirement to 100%', () => {
      const votes: Vote[] = [];
      const options = ['approve', 'reject'];
      const snapshot = createSnapshot([
        { id: 'agent-1', equity: 100 },
      ]);

      const result = resolveDecision(votes, options, 'unanimous', snapshot);

      expect(result.quorumRequired).toBe(100);
    });
  });

  describe('Quorum Requirements', () => {
    it('respects custom quorum percentage for equity-weighted', () => {
      const votes: Vote[] = [
        createVote({ agentId: 'agent-1', option: 'approve', equityAtVote: '30' }),
      ];
      const options = ['approve', 'reject'];
      const snapshot = createSnapshot([
        { id: 'agent-1', equity: 30 },
        { id: 'agent-2', equity: 70 },
      ]);

      // 30% voted, 40% required
      const result = resolveDecision(votes, options, 'equity_weighted', snapshot, 40);

      expect(result.quorumMet).toBe(false);
    });

    it('passes when quorum exactly met', () => {
      const votes: Vote[] = [
        createVote({ agentId: 'agent-1', option: 'approve', equityAtVote: '50' }),
      ];
      const options = ['approve', 'reject'];
      const snapshot = createSnapshot([
        { id: 'agent-1', equity: 50 },
        { id: 'agent-2', equity: 50 },
      ]);

      // Exactly 50% voted, 50% required
      const result = resolveDecision(votes, options, 'equity_weighted', snapshot, 50);

      expect(result.quorumMet).toBe(true);
    });

    it('handles zero total equity gracefully', () => {
      const votes: Vote[] = [];
      const options = ['approve', 'reject'];
      const snapshot: EquitySnapshot = {};

      const result = resolveDecision(votes, options, 'equity_weighted', snapshot, 50);

      expect(result.quorumMet).toBe(false);
    });
  });

  describe('Vote Tallying', () => {
    it('tallies votes correctly', () => {
      const votes: Vote[] = [
        createVote({ agentId: 'a1', option: 'A', equityAtVote: '20' }),
        createVote({ agentId: 'a2', option: 'A', equityAtVote: '30' }),
        createVote({ agentId: 'a3', option: 'B', equityAtVote: '25' }),
        createVote({ agentId: 'a4', option: 'C', equityAtVote: '25' }),
      ];
      const options = ['A', 'B', 'C'];
      const snapshot = createSnapshot([
        { id: 'a1', equity: 20 },
        { id: 'a2', equity: 30 },
        { id: 'a3', equity: 25 },
        { id: 'a4', equity: 25 },
      ]);

      const result = resolveDecision(votes, options, 'equity_weighted', snapshot, 50);

      expect(result.voteTally['A'].count).toBe(2);
      expect(result.voteTally['A'].weight).toBe(50);
      expect(result.voteTally['A'].voters).toEqual(['a1', 'a2']);
      expect(result.voteTally['B'].count).toBe(1);
      expect(result.voteTally['B'].weight).toBe(25);
      expect(result.voteTally['C'].count).toBe(1);
    });

    it('tracks voters in tally', () => {
      const votes: Vote[] = [
        createVote({ agentId: 'agent-1', option: 'yes' }),
        createVote({ agentId: 'agent-2', option: 'yes' }),
        createVote({ agentId: 'agent-3', option: 'no' }),
      ];
      const options = ['yes', 'no'];
      const snapshot = createSnapshot([
        { id: 'agent-1', equity: 33 },
        { id: 'agent-2', equity: 33 },
        { id: 'agent-3', equity: 34 },
      ]);

      const result = resolveDecision(votes, options, 'equity_weighted', snapshot, 50);

      expect(result.voteTally['yes'].voters).toContain('agent-1');
      expect(result.voteTally['yes'].voters).toContain('agent-2');
      expect(result.voteTally['no'].voters).toContain('agent-3');
    });

    it('ignores votes for invalid options', () => {
      const votes: Vote[] = [
        createVote({ agentId: 'a1', option: 'approve' }),
        createVote({ agentId: 'a2', option: 'invalid-option' }), // Invalid
      ];
      const options = ['approve', 'reject'];
      const snapshot = createSnapshot([
        { id: 'a1', equity: 50 },
        { id: 'a2', equity: 50 },
      ]);

      const result = resolveDecision(votes, options, 'equity_weighted', snapshot, 50);

      expect(result.totalVoteWeight).toBe(50); // Only a1's vote counted
    });
  });

  describe('Calculate Vote Weight', () => {
    const snapshot = createSnapshot([
      { id: 'agent-1', equity: 51 },
      { id: 'agent-2', equity: 49 },
    ]);

    it('returns equity for equity_weighted', () => {
      const weight = calculateVoteWeight('agent-1', 'equity_weighted', snapshot);

      expect(weight).toBe('51');
    });

    it('returns 1 for one_agent_one_vote', () => {
      const weight = calculateVoteWeight('agent-1', 'one_agent_one_vote', snapshot);

      expect(weight).toBe('1');
    });

    it('returns 1 for unanimous', () => {
      const weight = calculateVoteWeight('agent-1', 'unanimous', snapshot);

      expect(weight).toBe('1');
    });

    it('uses fallback equity for unknown agent', () => {
      const weight = calculateVoteWeight('unknown', 'equity_weighted', snapshot, '10');

      expect(weight).toBe('10');
    });

    it('returns 0 for unknown agent with no fallback', () => {
      const weight = calculateVoteWeight('unknown', 'equity_weighted', snapshot);

      expect(weight).toBe('0');
    });
  });

  describe('Edge Cases', () => {
    it('handles tie in equity-weighted voting', () => {
      const votes: Vote[] = [
        createVote({ agentId: 'a1', option: 'A', equityAtVote: '50' }),
        createVote({ agentId: 'a2', option: 'B', equityAtVote: '50' }),
      ];
      const options = ['A', 'B'];
      const snapshot = createSnapshot([
        { id: 'a1', equity: 50 },
        { id: 'a2', equity: 50 },
      ]);

      const result = resolveDecision(votes, options, 'equity_weighted', snapshot, 50);

      // First option encountered with max weight wins (implementation detail)
      expect(result.passed).toBe(true);
      expect(['A', 'B']).toContain(result.winningOption);
    });

    it('handles no votes cast', () => {
      const votes: Vote[] = [];
      const options = ['approve', 'reject'];
      const snapshot = createSnapshot([
        { id: 'agent-1', equity: 100 },
      ]);

      const result = resolveDecision(votes, options, 'equity_weighted', snapshot, 50);

      expect(result.passed).toBe(false);
      expect(result.winningOption).toBeNull();
    });

    it('handles single voter with 100% equity', () => {
      const votes: Vote[] = [
        createVote({ agentId: 'sole-agent', option: 'approve', equityAtVote: '100' }),
      ];
      const options = ['approve', 'reject'];
      const snapshot = createSnapshot([
        { id: 'sole-agent', equity: 100 },
      ]);

      const result = resolveDecision(votes, options, 'equity_weighted', snapshot, 50);

      expect(result.passed).toBe(true);
      expect(result.winningOption).toBe('approve');
      expect(result.quorumMet).toBe(true);
    });

    it('handles unknown voting method', () => {
      const votes: Vote[] = [];
      const options = ['approve'];
      const snapshot = createSnapshot([]);

      expect(() => {
        resolveDecision(votes, options, 'invalid' as VotingMethod, snapshot, 50);
      }).toThrow('Unknown voting method');
    });
  });
});
