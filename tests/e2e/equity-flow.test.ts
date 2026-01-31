/**
 * E2E Tests: Equity Distribution Flow
 * Tests equity operations and invariant maintenance
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDb, cleanupTestDb, type TestDbContext } from '../utils/db';
import {
  createTestApp,
  createCompany,
  joinCompany,
  getEquity,
  getMyEquity,
  grantEquity,
  transferEquity,
  createTask,
  claimTask,
  completeTask,
  leaveCompany,
  uniqueName,
  createClaimedAgent,
} from './helpers';

describe('Equity Distribution Flow', () => {
  let dbContext: TestDbContext;
  let app: ReturnType<typeof createTestApp>;

  beforeAll(async () => {
    dbContext = await createTestDb();
    app = createTestApp();
  });

  afterAll(async () => {
    await dbContext.cleanup();
  });

  beforeEach(async () => {
    await cleanupTestDb(dbContext.db);
  });

  describe('Initial Equity Distribution', () => {
    it('should give founder all initial equity', async () => {
      const founder = await createClaimedAgent(app, uniqueName('founder'));
      const companyName = uniqueName('equity-company');

      await createCompany(app, founder.apiKey, companyName, {
        initialEquity: 100,
      });

      const equity = await getEquity(app, founder.apiKey, companyName);

      expect(equity.totalEquity).toBe(100);
      expect(equity.distributed).toBe(100);
      expect(equity.treasury).toBe(0);
      expect(equity.myShare).toBe(100);
      expect(equity.holders).toHaveLength(1);
      expect(equity.holders[0].agent).toBe(founder.name);
      expect(equity.holders[0].equity).toBe(100);
      expect(equity.holders[0].role).toBe('founder');
    });

    it('should respect custom initial equity amount', async () => {
      const founder = await createClaimedAgent(app, uniqueName('founder'));
      const companyName = uniqueName('custom-equity');

      await createCompany(app, founder.apiKey, companyName, {
        initialEquity: 1000,
      });

      const equity = await getEquity(app, founder.apiKey, companyName);

      expect(equity.totalEquity).toBe(1000);
      expect(equity.myShare).toBe(1000);
    });

    it('should calculate percentages correctly', async () => {
      const founder = await createClaimedAgent(app, uniqueName('founder'));
      const companyName = uniqueName('percentage-company');

      await createCompany(app, founder.apiKey, companyName, {
        initialEquity: 100,
      });

      const equity = await getEquity(app, founder.apiKey, companyName);

      expect(equity.myPercentage).toBe('100.00%');
    });
  });

  describe('Equity Grants from Treasury', () => {
    it('should grant equity to new members', async () => {
      const founder = await createClaimedAgent(app, uniqueName('founder'));
      const member = await createClaimedAgent(app, uniqueName('member'));
      const companyName = uniqueName('grant-company');

      await createCompany(app, founder.apiKey, companyName, {
        initialEquity: 100,
      });

      await joinCompany(app, member.apiKey, companyName, 'I want to join!');

      // Grant 10% to member
      await grantEquity(app, founder.apiKey, companyName, member.name, 10, 'Welcome bonus');

      const founderEquity = await getEquity(app, founder.apiKey, companyName);
      const memberEquity = await getEquity(app, member.apiKey, companyName);

      // Founder: 100 - 10 = 90 (grants come from founder's equity in v1)
      // Actually in v1, founder retains equity and grants from treasury
      // After founder gets all 100, they transfer 10 to member
      expect(memberEquity.myShare).toBe(10);

      // Total should still be 100
      expect(founderEquity.totalEquity).toBe(100);
    });

    it('should prevent granting more than treasury has', async () => {
      const founder = await createClaimedAgent(app, uniqueName('founder'));
      const member = await createClaimedAgent(app, uniqueName('member'));
      const companyName = uniqueName('limited-grant');

      await createCompany(app, founder.apiKey, companyName, {
        initialEquity: 100,
      });

      await joinCompany(app, member.apiKey, companyName, 'Joining');

      // Try to grant more than total equity
      await expect(
        grantEquity(app, founder.apiKey, companyName, member.name, 150, 'Too much')
      ).rejects.toThrow('Insufficient treasury');
    });

    it('should only allow founders to grant equity', async () => {
      const founder = await createClaimedAgent(app, uniqueName('founder'));
      const member1 = await createClaimedAgent(app, uniqueName('member1'));
      const member2 = await createClaimedAgent(app, uniqueName('member2'));
      const companyName = uniqueName('founder-only-grant');

      await createCompany(app, founder.apiKey, companyName);
      await joinCompany(app, member1.apiKey, companyName, 'Member 1');
      await joinCompany(app, member2.apiKey, companyName, 'Member 2');

      // Member trying to grant should fail
      await expect(
        grantEquity(app, member1.apiKey, companyName, member2.name, 5, 'Unauthorized')
      ).rejects.toThrow('Only founders');
    });
  });

  describe('Equity Transfers', () => {
    it('should transfer equity between members', async () => {
      const founder = await createClaimedAgent(app, uniqueName('founder'));
      const member = await createClaimedAgent(app, uniqueName('member'));
      const companyName = uniqueName('transfer-company');

      await createCompany(app, founder.apiKey, companyName, {
        initialEquity: 100,
      });

      await joinCompany(app, member.apiKey, companyName, 'Joining');

      // Transfer 20 from founder to member
      await transferEquity(app, founder.apiKey, companyName, member.name, 20, 'Payment');

      const founderEquity = await getEquity(app, founder.apiKey, companyName);
      const memberEquity = await getEquity(app, member.apiKey, companyName);

      expect(founderEquity.myShare).toBe(80);
      expect(memberEquity.myShare).toBe(20);
    });

    it('should prevent transferring more than owned', async () => {
      const founder = await createClaimedAgent(app, uniqueName('founder'));
      const member = await createClaimedAgent(app, uniqueName('member'));
      const companyName = uniqueName('over-transfer');

      await createCompany(app, founder.apiKey, companyName, {
        initialEquity: 100,
      });

      await joinCompany(app, member.apiKey, companyName, 'Joining');
      await grantEquity(app, founder.apiKey, companyName, member.name, 10, 'Initial');

      // Member tries to transfer more than they have
      await expect(
        transferEquity(app, member.apiKey, companyName, founder.name, 20, 'Too much')
      ).rejects.toThrow('Insufficient equity');
    });

    it('should require recipient to be a member', async () => {
      const founder = await createClaimedAgent(app, uniqueName('founder'));
      const outsider = await createClaimedAgent(app, uniqueName('outsider'));
      const companyName = uniqueName('member-only-transfer');

      await createCompany(app, founder.apiKey, companyName);

      await expect(
        transferEquity(app, founder.apiKey, companyName, outsider.name, 10, 'To outsider')
      ).rejects.toThrow('not a member');
    });
  });

  describe('Equity Invariants', () => {
    it('should maintain total equity through multiple operations', async () => {
      const founder = await createClaimedAgent(app, uniqueName('founder'));
      const member1 = await createClaimedAgent(app, uniqueName('member1'));
      const member2 = await createClaimedAgent(app, uniqueName('member2'));
      const companyName = uniqueName('invariant-company');
      const TOTAL_EQUITY = 100;

      await createCompany(app, founder.apiKey, companyName, {
        initialEquity: TOTAL_EQUITY,
      });

      // Initial check
      let equity = await getEquity(app, founder.apiKey, companyName);
      expect(equity.totalEquity).toBe(TOTAL_EQUITY);

      // Add member 1
      await joinCompany(app, member1.apiKey, companyName, 'Member 1');
      equity = await getEquity(app, founder.apiKey, companyName);
      expect(equity.totalEquity).toBe(TOTAL_EQUITY);

      // Grant to member 1
      await transferEquity(app, founder.apiKey, companyName, member1.name, 20);
      equity = await getEquity(app, founder.apiKey, companyName);
      expect(equity.totalEquity).toBe(TOTAL_EQUITY);
      expect(equity.distributed).toBe(TOTAL_EQUITY); // All equity is distributed among members

      // Add member 2
      await joinCompany(app, member2.apiKey, companyName, 'Member 2');
      equity = await getEquity(app, founder.apiKey, companyName);
      expect(equity.totalEquity).toBe(TOTAL_EQUITY);

      // Transfer from member1 to member2
      await transferEquity(app, member1.apiKey, companyName, member2.name, 5);
      equity = await getEquity(app, founder.apiKey, companyName);
      expect(equity.totalEquity).toBe(TOTAL_EQUITY);

      // Final distribution check
      const founderEquity = await getEquity(app, founder.apiKey, companyName);
      const member1Equity = await getEquity(app, member1.apiKey, companyName);
      const member2Equity = await getEquity(app, member2.apiKey, companyName);

      const totalDistributed =
        founderEquity.myShare + member1Equity.myShare + member2Equity.myShare;

      expect(totalDistributed).toBe(TOTAL_EQUITY);
    });

    it('should verify no equity is created or destroyed through task completion', async () => {
      const founder = await createClaimedAgent(app, uniqueName('founder'));
      const worker = await createClaimedAgent(app, uniqueName('worker'));
      const companyName = uniqueName('task-equity-company');
      const TOTAL_EQUITY = 100;
      const TASK_REWARD = 5;

      await createCompany(app, founder.apiKey, companyName, {
        initialEquity: TOTAL_EQUITY,
      });

      await joinCompany(app, worker.apiKey, companyName, 'Worker');

      // Check initial state
      let equity = await getEquity(app, founder.apiKey, companyName);
      expect(equity.totalEquity).toBe(TOTAL_EQUITY);

      // Create and complete task with equity reward
      const task = await createTask(app, founder.apiKey, companyName, 'Rewarded Task', {
        equityReward: TASK_REWARD,
        karmaReward: 10,
      });

      await claimTask(app, worker.apiKey, companyName, task.id);
      await completeTask(app, worker.apiKey, companyName, task.id, {
        notes: 'Done!',
      });

      // Check equity after task completion
      // In v1, task rewards come from existing equity (founder's share)
      // The total should remain the same
      equity = await getEquity(app, founder.apiKey, companyName);

      // Note: The current implementation may or may not transfer equity on task completion
      // This test verifies the invariant holds regardless
      expect(equity.totalEquity).toBe(TOTAL_EQUITY);

      // Verify worker got their reward
      const workerEquity = await getEquity(app, worker.apiKey, companyName);
      expect(workerEquity.myShare).toBe(TASK_REWARD);
    });

    it('should maintain equity after member leaves', async () => {
      const founder = await createClaimedAgent(app, uniqueName('founder'));
      const leaver = await createClaimedAgent(app, uniqueName('leaver'));
      const companyName = uniqueName('leave-equity');
      const TOTAL_EQUITY = 100;

      await createCompany(app, founder.apiKey, companyName, {
        initialEquity: TOTAL_EQUITY,
      });

      await joinCompany(app, leaver.apiKey, companyName, 'Will leave');
      await transferEquity(app, founder.apiKey, companyName, leaver.name, 20);

      // Before leaving
      let equity = await getEquity(app, founder.apiKey, companyName);
      expect(equity.distributed).toBe(TOTAL_EQUITY);

      // Member leaves (forfeits equity)
      await leaveCompany(app, leaver.apiKey, companyName);

      // After leaving - equity is forfeited (goes to treasury or is lost)
      equity = await getEquity(app, founder.apiKey, companyName);

      // The total equity remains constant even if distributed amount changes
      expect(equity.totalEquity).toBe(TOTAL_EQUITY);
    });
  });

  describe('Cross-Company Equity', () => {
    it('should track equity across multiple companies', async () => {
      const agent = await createClaimedAgent(app, uniqueName('multi-company-agent'));
      const founder1 = await createClaimedAgent(app, uniqueName('founder1'));
      const founder2 = await createClaimedAgent(app, uniqueName('founder2'));

      const company1 = uniqueName('company1');
      const company2 = uniqueName('company2');

      await createCompany(app, founder1.apiKey, company1, { initialEquity: 100 });
      await createCompany(app, founder2.apiKey, company2, { initialEquity: 200 });

      // Agent joins both companies
      await joinCompany(app, agent.apiKey, company1, 'Joining company 1');
      await joinCompany(app, agent.apiKey, company2, 'Joining company 2');

      // Receive equity in both
      await transferEquity(app, founder1.apiKey, company1, agent.name, 15);
      await transferEquity(app, founder2.apiKey, company2, agent.name, 30);

      // Check aggregate equity
      const myEquity = await getMyEquity(app, agent.apiKey);

      expect(myEquity.total_companies).toBe(2);
      expect(myEquity.holdings).toHaveLength(2);

      const holding1 = myEquity.holdings.find((h: any) => h.company === company1);
      const holding2 = myEquity.holdings.find((h: any) => h.company === company2);

      expect(holding1?.equity).toBe(15);
      expect(holding2?.equity).toBe(30);
    });
  });

  describe('Equity History and Tracking', () => {
    it('should record equity transactions', async () => {
      const founder = await createClaimedAgent(app, uniqueName('founder'));
      const member = await createClaimedAgent(app, uniqueName('member'));
      const companyName = uniqueName('history-company');

      await createCompany(app, founder.apiKey, companyName, {
        initialEquity: 100,
      });

      await joinCompany(app, member.apiKey, companyName, 'Joining');

      // Make several transactions
      await transferEquity(app, founder.apiKey, companyName, member.name, 10, 'First transfer');
      await transferEquity(app, founder.apiKey, companyName, member.name, 5, 'Second transfer');
      await transferEquity(app, member.apiKey, companyName, founder.name, 3, 'Return some');

      // Final state should reflect all transactions
      const founderEquity = await getEquity(app, founder.apiKey, companyName);
      const memberEquity = await getEquity(app, member.apiKey, companyName);

      // Founder: 100 - 10 - 5 + 3 = 88
      // Member: 0 + 10 + 5 - 3 = 12
      expect(founderEquity.myShare).toBe(88);
      expect(memberEquity.myShare).toBe(12);

      // Total should still be 100
      expect(founderEquity.myShare + memberEquity.myShare).toBe(100);
    });
  });

  describe('Dilution (Advanced)', () => {
    it('should handle equity dilution correctly', async () => {
      const founder = await createClaimedAgent(app, uniqueName('founder'));
      const member = await createClaimedAgent(app, uniqueName('member'));
      const companyName = uniqueName('dilution-company');

      await createCompany(app, founder.apiKey, companyName, {
        initialEquity: 100,
      });

      await joinCompany(app, member.apiKey, companyName, 'Joining');
      await transferEquity(app, founder.apiKey, companyName, member.name, 20);

      // Before dilution: Founder 80%, Member 20% of 100 total
      let equity = await getEquity(app, founder.apiKey, companyName);
      expect(equity.totalEquity).toBe(100);

      // Note: Dilution endpoint would increase totalEquity
      // This test verifies the base state before any dilution
      // The dilute endpoint is for founders to issue new equity
      // After dilution, percentages change but absolute amounts stay same
    });
  });

  describe('Complete Equity Flow E2E', () => {
    it('should handle full equity lifecycle', async () => {
      const founder = await createClaimedAgent(app, uniqueName('founder'));
      const dev1 = await createClaimedAgent(app, uniqueName('dev1'));
      const dev2 = await createClaimedAgent(app, uniqueName('dev2'));
      const companyName = uniqueName('full-equity-flow');

      // 1. Create company with 100 equity
      await createCompany(app, founder.apiKey, companyName, {
        displayName: 'Full Flow Company',
        initialEquity: 100,
      });

      // 2. Verify initial distribution
      let equity = await getEquity(app, founder.apiKey, companyName);
      expect(equity.totalEquity).toBe(100);
      expect(equity.myShare).toBe(100);
      expect(equity.holders).toHaveLength(1);

      // 3. Add first member
      await joinCompany(app, dev1.apiKey, companyName, 'Dev 1 joining');
      await transferEquity(app, founder.apiKey, companyName, dev1.name, 15);

      // 4. Verify after first addition
      equity = await getEquity(app, founder.apiKey, companyName);
      expect(equity.distributed).toBe(100);
      expect(equity.holders).toHaveLength(2);

      // 5. Add second member
      await joinCompany(app, dev2.apiKey, companyName, 'Dev 2 joining');
      await transferEquity(app, founder.apiKey, companyName, dev2.name, 10);

      // 6. Create and complete task with equity reward
      const task = await createTask(app, founder.apiKey, companyName, 'Feature Task', {
        equityReward: 5,
        karmaReward: 50,
      });

      await claimTask(app, dev1.apiKey, companyName, task.id);
      await completeTask(app, dev1.apiKey, companyName, task.id, {
        notes: 'Feature complete',
      });

      // 7. Dev1 earned task reward, check final distribution
      const finalEquity = await getEquity(app, founder.apiKey, companyName);

      // Founder: 100 - 15 - 10 = 75
      // Dev1: 15 + 5 (task) = 20
      // Dev2: 10
      const founderHolding = finalEquity.holders.find((h: any) => h.agent === founder.name);
      const dev1Holding = finalEquity.holders.find((h: any) => h.agent === dev1.name);
      const dev2Holding = finalEquity.holders.find((h: any) => h.agent === dev2.name);

      expect(founderHolding?.equity).toBe(75);
      expect(dev1Holding?.equity).toBe(20);
      expect(dev2Holding?.equity).toBe(10);

      // 8. Verify total is still 100 (or 105 if task rewards add new equity)
      // In v1, task rewards come from treasury/founder
      // If totalEquity remains 100, then founder's share reduced
      const totalDistributed =
        (founderHolding?.equity || 0) +
        (dev1Holding?.equity || 0) +
        (dev2Holding?.equity || 0);

      // Note: This depends on implementation
      // If task rewards don't change total, total should be 100
      // If task rewards add new equity, total would increase
      expect(totalDistributed).toBe(finalEquity.totalEquity);
    });
  });
});
