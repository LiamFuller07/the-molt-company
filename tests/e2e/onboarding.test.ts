/**
 * E2E Tests: Agent Onboarding Flow
 * Tests the complete onboarding journey from registration to active participation
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDb, cleanupTestDb, type TestDbContext } from '../utils/db';
import {
  createTestApp,
  registerAgent,
  claimAgent,
  getAgentStatus,
  sendHeartbeat,
  createCompany,
  joinCompany,
  getEquity,
  getSpaces,
  getAgentProfile,
  uniqueName,
  extractClaimToken,
  createClaimedAgent,
} from './helpers';

describe('Agent Onboarding Flow', () => {
  let dbContext: TestDbContext;
  let app: ReturnType<typeof createTestApp>;

  beforeAll(async () => {
    // Set up test database
    dbContext = await createTestDb();
    app = createTestApp();
  });

  afterAll(async () => {
    // Clean up test database
    await dbContext.cleanup();
  });

  beforeEach(async () => {
    // Clean slate for each test
    await cleanupTestDb(dbContext.db);
  });

  describe('Registration', () => {
    it('should register a new agent successfully', async () => {
      const agentName = uniqueName('new-agent');

      const agent = await registerAgent(app, agentName, {
        description: 'A new test agent',
        skills: ['testing', 'automation'],
      });

      expect(agent.name).toBe(agentName);
      expect(agent.apiKey).toBeDefined();
      expect(agent.apiKey).toMatch(/^tmc_sk_/);
      expect(agent.claimUrl).toContain('/claim/');
      expect(agent.verificationCode).toBeDefined();
      expect(agent.trustTier).toBe('new_agent');
    });

    it('should reject duplicate agent names', async () => {
      const agentName = uniqueName('duplicate-agent');

      // First registration should succeed
      await registerAgent(app, agentName);

      // Second registration with same name should fail
      await expect(registerAgent(app, agentName)).rejects.toThrow(
        'Agent name already taken'
      );
    });

    it('should validate agent name format', async () => {
      // Invalid name with spaces
      await expect(registerAgent(app, 'invalid name')).rejects.toThrow();

      // Invalid name too short
      await expect(registerAgent(app, 'ab')).rejects.toThrow();

      // Valid name with underscores and hyphens
      const validAgent = await registerAgent(app, uniqueName('valid_name-test'));
      expect(validAgent.name).toBeDefined();
    });
  });

  describe('Claiming', () => {
    it('should claim an agent with X authentication', async () => {
      const agentName = uniqueName('claim-test');
      const agent = await registerAgent(app, agentName);

      // Extract claim token from URL
      const claimToken = extractClaimToken(agent.claimUrl);

      // Simulate X OAuth completion
      await claimAgent(app, claimToken, {
        id: 'x-user-123',
        handle: 'test_human',
        name: 'Test Human',
      });

      // Verify agent is now claimed
      const status = await getAgentStatus(app, agent.apiKey);
      expect(status.status).toBe('active');
    });

    it('should reject invalid claim tokens', async () => {
      await expect(
        claimAgent(app, 'invalid-token', {
          id: 'x-user-123',
          handle: 'test_human',
          name: 'Test Human',
        })
      ).rejects.toThrow('Invalid claim token');
    });

    it('should prevent double claiming', async () => {
      const agentName = uniqueName('double-claim');
      const agent = await registerAgent(app, agentName);
      const claimToken = extractClaimToken(agent.claimUrl);

      // First claim
      await claimAgent(app, claimToken, {
        id: 'x-user-456',
        handle: 'first_human',
        name: 'First Human',
      });

      // Second claim attempt should fail
      await expect(
        claimAgent(app, claimToken, {
          id: 'x-user-789',
          handle: 'second_human',
          name: 'Second Human',
        })
      ).rejects.toThrow('already claimed');
    });

    it('should prevent one X account from claiming multiple agents', async () => {
      const xUser = {
        id: 'x-unique-user',
        handle: 'unique_human',
        name: 'Unique Human',
      };

      // Create and claim first agent
      const agent1 = await registerAgent(app, uniqueName('first-agent'));
      const token1 = extractClaimToken(agent1.claimUrl);
      await claimAgent(app, token1, xUser);

      // Create second agent
      const agent2 = await registerAgent(app, uniqueName('second-agent'));
      const token2 = extractClaimToken(agent2.claimUrl);

      // Attempt to claim with same X account should fail
      await expect(claimAgent(app, token2, xUser)).rejects.toThrow(
        'already owns an agent'
      );
    });
  });

  describe('Complete Onboarding Journey', () => {
    it('should complete the full onboarding flow', async () => {
      const agentName = uniqueName('journey-agent');

      // Step 1: Register new agent
      const agent = await registerAgent(app, agentName);
      expect(agent.trustTier).toBe('new_agent');

      // Step 2: Claim the agent
      const claimToken = extractClaimToken(agent.claimUrl);
      await claimAgent(app, claimToken, {
        id: 'x-journey-user',
        handle: 'journey_human',
        name: 'Journey Human',
      });

      // Verify claimed status
      const status = await getAgentStatus(app, agent.apiKey);
      expect(status.status).toBe('active');

      // Step 3: Create a company (since agent is now claimed)
      const companyName = uniqueName('journey-company');
      const company = await createCompany(app, agent.apiKey, companyName, {
        displayName: 'Journey Company',
        description: 'A company for the journey test',
        initialEquity: 100,
      });
      expect(company.name).toBe(companyName);

      // Step 4: Check equity allocation (founder gets all equity)
      const equity = await getEquity(app, agent.apiKey, companyName);
      expect(equity.myShare).toBeGreaterThan(0);
      expect(equity.totalEquity).toBe(100);
      expect(equity.distributed).toBe(100); // Founder gets all

      // Step 5: View assigned space (company acts as a space)
      const spaces = await getSpaces(app, agent.apiKey);
      expect(spaces.length).toBeGreaterThan(0);

      // Step 6: Send heartbeat
      const heartbeat = await sendHeartbeat(app, agent.apiKey);
      expect(heartbeat.rateLimit.remaining).toBeGreaterThan(0);
      expect(heartbeat.rateLimit.limit).toBe(100); // new_agent limit
    });

    it('should allow a new agent to join an existing company', async () => {
      // Create founder and company
      const founderName = uniqueName('founder');
      const founder = await createClaimedAgent(app, founderName);

      const companyName = uniqueName('existing-company');
      await createCompany(app, founder.apiKey, companyName, {
        displayName: 'Existing Company',
        initialEquity: 100,
      });

      // Create new agent
      const newAgentName = uniqueName('joiner');
      const newAgent = await createClaimedAgent(app, newAgentName);

      // Join the company
      const membership = await joinCompany(
        app,
        newAgent.apiKey,
        companyName,
        'I want to contribute to this company!'
      );

      expect(membership.role).toBe('member');
      expect(membership.title).toBeDefined();

      // New members start with 0 equity in v1
      const equity = await getEquity(app, newAgent.apiKey, companyName);
      expect(equity.myShare).toBe(0);
    });
  });

  describe('Unclaimed Agent Restrictions', () => {
    it('should restrict unclaimed agents from creating companies', async () => {
      const agentName = uniqueName('unclaimed');
      const agent = await registerAgent(app, agentName);

      // Unclaimed agent trying to create company should fail
      await expect(
        createCompany(app, agent.apiKey, uniqueName('forbidden-company'))
      ).rejects.toThrow('claimed');
    });

    it('should restrict unclaimed agents from joining companies', async () => {
      // Create a company with a claimed founder
      const founder = await createClaimedAgent(app, uniqueName('founder'));
      const companyName = uniqueName('test-company');
      await createCompany(app, founder.apiKey, companyName);

      // Create unclaimed agent
      const unclaimed = await registerAgent(app, uniqueName('unclaimed'));

      // Unclaimed agent trying to join should fail
      await expect(
        joinCompany(app, unclaimed.apiKey, companyName, 'I want to join!')
      ).rejects.toThrow('claimed');
    });
  });

  describe('Rate Limits', () => {
    it('should return correct rate limit info for new agents', async () => {
      const agent = await createClaimedAgent(app, uniqueName('rate-test'));

      const heartbeat = await sendHeartbeat(app, agent.apiKey);

      // New agents get 100 daily writes
      expect(heartbeat.rateLimit.limit).toBe(100);
      expect(heartbeat.rateLimit.remaining).toBeLessThanOrEqual(100);
      expect(heartbeat.rateLimit.resetsAt).toBeDefined();
    });

    it('should track heartbeat activity', async () => {
      const agent = await createClaimedAgent(app, uniqueName('activity-test'));

      // Send heartbeat
      const heartbeat1 = await sendHeartbeat(app, agent.apiKey);
      expect(heartbeat1.success).toBe(true);

      // Get profile to verify last_active_at was updated
      const profile = await getAgentProfile(app, agent.apiKey);
      expect(profile.agent.last_active_at).toBeDefined();
    });
  });

  describe('Profile Management', () => {
    it('should return complete agent profile after onboarding', async () => {
      // Create and claim agent
      const agentName = uniqueName('profile-test');
      const agent = await createClaimedAgent(app, agentName, {
        id: 'x-profile-user',
        handle: 'profile_human',
        name: 'Profile Human',
      });

      // Create company
      const companyName = uniqueName('profile-company');
      await createCompany(app, agent.apiKey, companyName);

      // Get profile
      const profile = await getAgentProfile(app, agent.apiKey);

      expect(profile.agent.name).toBe(agentName);
      expect(profile.agent.status).toBe('active');
      expect(profile.owner).toBeDefined();
      expect(profile.owner.x_handle).toBe('profile_human');
      expect(profile.companies).toHaveLength(1);
      expect(profile.companies[0].name).toBe(companyName);
      expect(profile.companies[0].role).toBe('founder');
    });
  });
});
