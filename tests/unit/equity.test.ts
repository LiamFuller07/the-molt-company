/**
 * Unit Tests: Equity Calculator Service
 *
 * Tests equity distribution calculation, dilution on join, and vote weight calculation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateEquityDistribution,
  calculateTargetDistribution,
  calculateDilutionOnJoin,
  calculateEquityOnNewMember,
  createEquitySnapshot,
  calculateVoteWeight,
  validateEquityTransfer,
  validateTreasuryGrant,
  type Company,
  type Member,
} from '@/services/equity-calculator';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createCompany = (overrides: Partial<Company> = {}): Company => ({
  id: 'company-1',
  adminAgentId: 'admin-agent',
  adminFloorPct: '51',
  memberPoolPct: '49',
  totalEquity: '100',
  ...overrides,
});

const createMember = (overrides: Partial<Member> = {}): Member => ({
  agentId: 'member-1',
  equity: '10',
  role: 'member',
  ...overrides,
});

// ============================================================================
// EQUITY DISTRIBUTION TESTS
// ============================================================================

describe('Equity Calculator', () => {
  describe('calculateEquityDistribution', () => {
    it('calculates correct distribution for admin and members', () => {
      const company = createCompany();
      const members: Member[] = [
        createMember({ agentId: 'admin-agent', equity: '51', role: 'founder' }),
        createMember({ agentId: 'member-1', equity: '24.5' }),
        createMember({ agentId: 'member-2', equity: '24.5' }),
      ];

      const result = calculateEquityDistribution(company, members);

      expect(result.admin).not.toBeNull();
      expect(result.admin?.agentId).toBe('admin-agent');
      expect(result.admin?.equity).toBe(51);
      expect(result.admin?.percentage).toBe(51);
      expect(result.members).toHaveLength(3);
      expect(result.totalDistributed).toBe(100);
      expect(result.treasury).toBe(0);
    });

    it('maintains 51% admin floor in target distribution', () => {
      const company = createCompany();
      const members: Member[] = [
        createMember({ agentId: 'admin-agent', equity: '51', role: 'founder' }),
        createMember({ agentId: 'member-1', equity: '24.5' }),
        createMember({ agentId: 'member-2', equity: '24.5' }),
      ];

      const result = calculateTargetDistribution(company, members);

      expect(result.admin).not.toBeNull();
      expect(result.admin?.equity).toBe(51);
      expect(result.admin?.percentage).toBe(51);
    });

    it('splits member pool equally among non-admin members', () => {
      const company = createCompany();
      const members: Member[] = [
        createMember({ agentId: 'admin-agent', equity: '51', role: 'founder' }),
        createMember({ agentId: 'member-1', equity: '24.5' }),
        createMember({ agentId: 'member-2', equity: '24.5' }),
      ];

      const result = calculateTargetDistribution(company, members);

      // Member pool is 49%, split between 2 non-admin members
      const expectedPerMember = 49 / 2; // 24.5
      const nonAdminMembers = result.members.filter(
        (m) => m.agentId !== 'admin-agent'
      );

      expect(nonAdminMembers).toHaveLength(2);
      expect(nonAdminMembers[0].equity).toBeCloseTo(expectedPerMember, 2);
      expect(nonAdminMembers[1].equity).toBeCloseTo(expectedPerMember, 2);
    });

    it('handles single member (admin only) correctly', () => {
      const company = createCompany();
      const members: Member[] = [
        createMember({ agentId: 'admin-agent', equity: '51', role: 'founder' }),
      ];

      const result = calculateTargetDistribution(company, members);

      expect(result.admin?.equity).toBe(51);
      expect(result.members.filter((m) => m.agentId !== 'admin-agent')).toHaveLength(0);
      expect(result.treasury).toBe(49); // Member pool goes to treasury
    });

    it('handles company with only one non-admin member', () => {
      const company = createCompany();
      const members: Member[] = [
        createMember({ agentId: 'admin-agent', equity: '51', role: 'founder' }),
        createMember({ agentId: 'member-1', equity: '49' }),
      ];

      const result = calculateTargetDistribution(company, members);

      const nonAdminMembers = result.members.filter(
        (m) => m.agentId !== 'admin-agent'
      );
      expect(nonAdminMembers).toHaveLength(1);
      expect(nonAdminMembers[0].equity).toBe(49);
    });

    it('calculates treasury correctly when equity is partially distributed', () => {
      const company = createCompany({ totalEquity: '100' });
      const members: Member[] = [
        createMember({ agentId: 'admin-agent', equity: '51', role: 'founder' }),
        createMember({ agentId: 'member-1', equity: '20' }),
      ];

      const result = calculateEquityDistribution(company, members);

      expect(result.totalDistributed).toBe(71);
      expect(result.treasury).toBe(29);
    });

    it('handles zero total equity correctly', () => {
      const company = createCompany({ totalEquity: '0' });
      const members: Member[] = [
        createMember({ agentId: 'admin-agent', equity: '0', role: 'founder' }),
      ];

      const result = calculateEquityDistribution(company, members);

      expect(result.totalDistributed).toBe(0);
      expect(result.treasury).toBe(0);
    });
  });

  // ============================================================================
  // DILUTION TESTS
  // ============================================================================

  describe('calculateDilutionOnJoin', () => {
    it('calculates new per-member share correctly for 2 existing members', () => {
      // 2 existing members, 1 joining = 3 total
      // Default 40% member pool / 3 = 13.33%
      const newShare = calculateDilutionOnJoin(2);

      expect(newShare).toBeCloseTo(13.33, 2);
    });

    it('calculates new per-member share for 1 existing member', () => {
      // 1 existing member, 1 joining = 2 total
      // Default 40% member pool / 2 = 20%
      const newShare = calculateDilutionOnJoin(1);

      expect(newShare).toBeCloseTo(20, 2);
    });

    it('handles 0 existing members (first member joining)', () => {
      // 0 existing, 1 joining = 1 total
      // Default 40% / 1 = 40%
      const newShare = calculateDilutionOnJoin(0);

      expect(newShare).toBe(40);
    });

    it('dilutes equally as more members join', () => {
      // Using default 40% member pool
      const share1 = calculateDilutionOnJoin(0); // 40/1 = 40
      const share2 = calculateDilutionOnJoin(1); // 40/2 = 20
      const share3 = calculateDilutionOnJoin(2); // 40/3 = 13.33
      const share4 = calculateDilutionOnJoin(3); // 40/4 = 10

      expect(share1).toBeCloseTo(40, 2);
      expect(share2).toBeCloseTo(20, 2);
      expect(share3).toBeCloseTo(13.33, 2);
      expect(share4).toBeCloseTo(10, 2);
    });

    it('correctly calculates with 49% member pool (Molt Company default)', () => {
      // Using 49% member pool (The Molt Company spec)
      const share1 = calculateDilutionOnJoin(0, 49); // 49/1 = 49
      const share2 = calculateDilutionOnJoin(1, 49); // 49/2 = 24.5
      const share3 = calculateDilutionOnJoin(2, 49); // 49/3 = 16.33

      expect(share1).toBeCloseTo(49, 2);
      expect(share2).toBeCloseTo(24.5, 2);
      expect(share3).toBeCloseTo(16.33, 2);
    });

    it('accepts custom member pool percentage', () => {
      // Custom 40% member pool
      const newShare = calculateDilutionOnJoin(2, 40);

      // 40% / 3 members = 13.33%
      expect(newShare).toBeCloseTo(13.33, 2);
    });
  });

  describe('calculateEquityOnNewMember', () => {
    it('calculates equity adjustments when new member joins', () => {
      const company = createCompany();
      const existingMembers: Member[] = [
        createMember({ agentId: 'admin-agent', equity: '51', role: 'founder' }),
        createMember({ agentId: 'member-1', equity: '24.5' }),
        createMember({ agentId: 'member-2', equity: '24.5' }),
      ];

      const result = calculateEquityOnNewMember(company, existingMembers, 'new-member');

      // 49% / 3 non-admin members = 16.33%
      expect(result.newMemberEquity).toBeCloseTo(16.33, 2);
      expect(result.memberAdjustments).toHaveLength(2); // 2 non-admin members get adjusted
      expect(result.memberAdjustments[0].newEquity).toBeCloseTo(16.33, 2);
    });

    it('handles first non-admin member joining', () => {
      const company = createCompany();
      const existingMembers: Member[] = [
        createMember({ agentId: 'admin-agent', equity: '51', role: 'founder' }),
      ];

      const result = calculateEquityOnNewMember(company, existingMembers, 'new-member');

      // 49% / 1 non-admin member = 49%
      expect(result.newMemberEquity).toBe(49);
      expect(result.memberAdjustments).toHaveLength(0);
    });
  });

  // ============================================================================
  // EQUITY SNAPSHOT TESTS
  // ============================================================================

  describe('createEquitySnapshot', () => {
    it('creates a snapshot mapping agent IDs to equity', () => {
      const members: Member[] = [
        createMember({ agentId: 'agent-1', equity: '51' }),
        createMember({ agentId: 'agent-2', equity: '24.5' }),
        createMember({ agentId: 'agent-3', equity: '24.5' }),
      ];

      const snapshot = createEquitySnapshot(members);

      expect(snapshot['agent-1']).toBe(51);
      expect(snapshot['agent-2']).toBe(24.5);
      expect(snapshot['agent-3']).toBe(24.5);
    });

    it('handles empty members array', () => {
      const snapshot = createEquitySnapshot([]);

      expect(Object.keys(snapshot)).toHaveLength(0);
    });
  });

  // ============================================================================
  // VOTE WEIGHT TESTS
  // ============================================================================

  describe('calculateVoteWeight', () => {
    const snapshot: Record<string, number> = {
      'agent-1': 51,
      'agent-2': 24.5,
      'agent-3': 24.5,
    };

    it('returns equity weight for equity_weighted voting', () => {
      const weight = calculateVoteWeight('agent-1', snapshot, 'equity_weighted');

      expect(weight).toBe(51);
    });

    it('returns 1 for one_agent_one_vote', () => {
      const weight = calculateVoteWeight('agent-1', snapshot, 'one_agent_one_vote');

      expect(weight).toBe(1);
    });

    it('returns 1 for unanimous voting', () => {
      const weight = calculateVoteWeight('agent-1', snapshot, 'unanimous');

      expect(weight).toBe(1);
    });

    it('returns 0 for unknown agent in equity_weighted', () => {
      const weight = calculateVoteWeight('unknown-agent', snapshot, 'equity_weighted');

      expect(weight).toBe(0);
    });
  });

  // ============================================================================
  // VALIDATION TESTS
  // ============================================================================

  describe('validateEquityTransfer', () => {
    it('validates successful transfer', () => {
      const fromMember = createMember({ agentId: 'from-agent', equity: '50' });

      const result = validateEquityTransfer(fromMember, 25, 'to-agent');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects transfer when source member not found', () => {
      const result = validateEquityTransfer(null, 25, 'to-agent');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Source member not found');
    });

    it('rejects transfer of non-positive amount', () => {
      const fromMember = createMember({ agentId: 'from-agent', equity: '50' });

      const result = validateEquityTransfer(fromMember, 0, 'to-agent');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Amount must be positive');
    });

    it('rejects transfer exceeding available equity', () => {
      const fromMember = createMember({ agentId: 'from-agent', equity: '25' });

      const result = validateEquityTransfer(fromMember, 50, 'to-agent');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Insufficient equity');
    });

    it('rejects transfer to self', () => {
      const fromMember = createMember({ agentId: 'same-agent', equity: '50' });

      const result = validateEquityTransfer(fromMember, 25, 'same-agent');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Cannot transfer to self');
    });
  });

  describe('validateTreasuryGrant', () => {
    it('validates successful treasury grant', () => {
      const result = validateTreasuryGrant(100, 80, 10);

      expect(result.valid).toBe(true);
      expect(result.treasury).toBe(20);
    });

    it('rejects non-positive grant amount', () => {
      const result = validateTreasuryGrant(100, 80, 0);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Amount must be positive');
    });

    it('rejects grant exceeding treasury', () => {
      const result = validateTreasuryGrant(100, 90, 20);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Insufficient treasury');
      expect(result.treasury).toBe(10);
    });
  });
});
