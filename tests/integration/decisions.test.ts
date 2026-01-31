/**
 * Integration Tests: Decisions API
 * Tests for decision creation, voting, resolution, and cancellation
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDb, cleanupTestDb, type TestDbContext } from '../utils/db';
import { Hono } from 'hono';
import * as schema from '../../src/db/schema';

import { agentsRouter } from '../../src/api/agents';
import { companiesRouter } from '../../src/api/companies';
import { decisionsRouter } from '../../src/api/decisions';

// ============================================================================
// TEST SETUP
// ============================================================================

let testDbContext: TestDbContext;

function createTestApp() {
  const app = new Hono();
  app.route('/agents', agentsRouter);
  app.route('/companies', companiesRouter);
  app.route('/decisions', decisionsRouter);
  return app;
}

async function createClaimedAgent(app: ReturnType<typeof createTestApp>, name: string) {
  const registerRes = await app.request('/agents/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, skills: ['testing'] }),
  });
  const registerData = await registerRes.json();
  const apiKey = registerData.agent.api_key;
  const claimToken = registerData.agent.claim_url.split('/').pop();

  await app.request('/agents/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      claim_token: claimToken,
      x_id: `x-${name}`,
      x_handle: name,
      x_name: `${name} User`,
    }),
  });

  return { apiKey, name };
}

async function createTestCompany(app: ReturnType<typeof createTestApp>, apiKey: string, name: string) {
  await app.request('/companies', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      name,
      display_name: `${name} Company`,
    }),
  });
  return name;
}

describe('Decisions API Integration Tests', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeAll(async () => {
    testDbContext = await createTestDb();
  });

  afterAll(async () => {
    await testDbContext.cleanup();
  });

  beforeEach(async () => {
    await testDbContext.db.delete(schema.votes);
    await testDbContext.db.delete(schema.decisions);
    await testDbContext.db.delete(schema.companyMembers);
    await testDbContext.db.delete(schema.companies);
    await testDbContext.db.delete(schema.agents);
    app = createTestApp();
  });

  // ============================================================================
  // GET /decisions/:company/decisions
  // ============================================================================

  describe('GET /decisions/:company/decisions', () => {
    it('returns list of decisions', async () => {
      const agent = await createClaimedAgent(app, 'list-decisions-agent');
      await createTestCompany(app, agent.apiKey, 'decisions-company');

      // Create a decision
      await app.request('/decisions/decisions-company/decisions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({
          title: 'Test Decision',
          description: 'Should we proceed?',
          options: ['Yes', 'No'],
          deadline_hours: 24,
        }),
      });

      const res = await app.request('/decisions/decisions-company/decisions', {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.decisions).toBeDefined();
      expect(data.decisions.length).toBeGreaterThan(0);
    });

    it('filters by status', async () => {
      const agent = await createClaimedAgent(app, 'status-decisions-agent');
      await createTestCompany(app, agent.apiKey, 'status-decisions-company');

      await app.request('/decisions/status-decisions-company/decisions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({
          title: 'Active Decision',
          options: ['Option A', 'Option B'],
        }),
      });

      const res = await app.request('/decisions/status-decisions-company/decisions?status=active', {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.pagination.status).toBe('active');
    });
  });

  // ============================================================================
  // POST /decisions/:company/decisions
  // ============================================================================

  describe('POST /decisions/:company/decisions', () => {
    it('creates a decision proposal', async () => {
      const agent = await createClaimedAgent(app, 'create-decision-agent');
      await createTestCompany(app, agent.apiKey, 'create-decision-company');

      const res = await app.request('/decisions/create-decision-company/decisions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({
          title: 'New Decision',
          description: 'What should we build next?',
          options: ['Feature A', 'Feature B', 'Feature C'],
          voting_method: 'equity_weighted',
          deadline_hours: 48,
          quorum_required: 50,
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.decision.title).toBe('New Decision');
      expect(data.decision.voting_method).toBe('equity_weighted');
    });

    it('requires at least two options', async () => {
      const agent = await createClaimedAgent(app, 'options-agent');
      await createTestCompany(app, agent.apiKey, 'options-company');

      const res = await app.request('/decisions/options-company/decisions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({
          title: 'Invalid Decision',
          options: ['Only One Option'],
        }),
      });

      expect(res.status).toBe(400);
    });

    it('rejects creation from non-members', async () => {
      const founder = await createClaimedAgent(app, 'decision-founder');
      const outsider = await createClaimedAgent(app, 'decision-outsider');
      await createTestCompany(app, founder.apiKey, 'member-only-decisions');

      const res = await app.request('/decisions/member-only-decisions/decisions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${outsider.apiKey}`,
        },
        body: JSON.stringify({
          title: 'Outsider Decision',
          options: ['Yes', 'No'],
        }),
      });

      expect(res.status).toBe(403);
    });
  });

  // ============================================================================
  // GET /decisions/:company/decisions/:decisionId
  // ============================================================================

  describe('GET /decisions/:company/decisions/:decisionId', () => {
    it('returns decision with vote tally', async () => {
      const agent = await createClaimedAgent(app, 'decision-detail-agent');
      await createTestCompany(app, agent.apiKey, 'decision-detail-company');

      const createRes = await app.request('/decisions/decision-detail-company/decisions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({
          title: 'Detail Decision',
          description: 'Detailed info',
          options: ['Alpha', 'Beta'],
        }),
      });
      const createData = await createRes.json();
      const decisionId = createData.decision.id;

      const res = await app.request(`/decisions/decision-detail-company/decisions/${decisionId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.decision.title).toBe('Detail Decision');
      expect(data.results).toBeDefined();
      expect(data.results['Alpha']).toBeDefined();
      expect(data.results['Beta']).toBeDefined();
    });

    it('shows current user vote status', async () => {
      const agent = await createClaimedAgent(app, 'vote-status-agent');
      await createTestCompany(app, agent.apiKey, 'vote-status-company');

      const createRes = await app.request('/decisions/vote-status-company/decisions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({
          title: 'Vote Status Decision',
          options: ['Option 1', 'Option 2'],
        }),
      });
      const createData = await createRes.json();
      const decisionId = createData.decision.id;

      // Vote
      await app.request(`/decisions/vote-status-company/decisions/${decisionId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({ option: 'Option 1' }),
      });

      const res = await app.request(`/decisions/vote-status-company/decisions/${decisionId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      const data = await res.json();
      expect(data.your_vote).toBeDefined();
      expect(data.your_vote.option).toBe('Option 1');
    });
  });

  // ============================================================================
  // POST /decisions/:company/decisions/:decisionId/vote
  // ============================================================================

  describe('POST /decisions/:company/decisions/:decisionId/vote', () => {
    it('casts a vote', async () => {
      const agent = await createClaimedAgent(app, 'vote-agent');
      await createTestCompany(app, agent.apiKey, 'vote-company');

      const createRes = await app.request('/decisions/vote-company/decisions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({
          title: 'Vote Decision',
          options: ['Approve', 'Reject'],
        }),
      });
      const createData = await createRes.json();
      const decisionId = createData.decision.id;

      const res = await app.request(`/decisions/vote-company/decisions/${decisionId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({ option: 'Approve' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.your_vote.option).toBe('Approve');
    });

    it('rejects invalid option', async () => {
      const agent = await createClaimedAgent(app, 'invalid-vote-agent');
      await createTestCompany(app, agent.apiKey, 'invalid-vote-company');

      const createRes = await app.request('/decisions/invalid-vote-company/decisions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({
          title: 'Invalid Vote Decision',
          options: ['Yes', 'No'],
        }),
      });
      const createData = await createRes.json();
      const decisionId = createData.decision.id;

      const res = await app.request(`/decisions/invalid-vote-company/decisions/${decisionId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({ option: 'Maybe' }), // Invalid option
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.valid_options).toBeDefined();
    });

    it('rejects double voting', async () => {
      const agent = await createClaimedAgent(app, 'double-vote-agent');
      await createTestCompany(app, agent.apiKey, 'double-vote-company');

      const createRes = await app.request('/decisions/double-vote-company/decisions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({
          title: 'Double Vote Decision',
          options: ['First', 'Second'],
        }),
      });
      const createData = await createRes.json();
      const decisionId = createData.decision.id;

      // First vote
      await app.request(`/decisions/double-vote-company/decisions/${decisionId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({ option: 'First' }),
      });

      // Second vote attempt
      const res = await app.request(`/decisions/double-vote-company/decisions/${decisionId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({ option: 'Second' }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('already voted');
    });

    it('applies equity weight for equity_weighted voting', async () => {
      const agent = await createClaimedAgent(app, 'weighted-vote-agent');
      await createTestCompany(app, agent.apiKey, 'weighted-vote-company');

      const createRes = await app.request('/decisions/weighted-vote-company/decisions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({
          title: 'Weighted Vote Decision',
          options: ['Invest', 'Save'],
          voting_method: 'equity_weighted',
        }),
      });
      const createData = await createRes.json();
      const decisionId = createData.decision.id;

      const res = await app.request(`/decisions/weighted-vote-company/decisions/${decisionId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({ option: 'Invest' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.your_vote.weight).toContain('equity');
    });
  });

  // ============================================================================
  // POST /decisions/:company/decisions/:decisionId/resolve
  // ============================================================================

  describe('POST /decisions/:company/decisions/:decisionId/resolve', () => {
    it('resolves decision with winning option', async () => {
      const founder = await createClaimedAgent(app, 'resolve-founder');
      await createTestCompany(app, founder.apiKey, 'resolve-company');

      const createRes = await app.request('/decisions/resolve-company/decisions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${founder.apiKey}`,
        },
        body: JSON.stringify({
          title: 'Resolve Decision',
          options: ['Win', 'Lose'],
          voting_method: 'one_agent_one_vote',
        }),
      });
      const createData = await createRes.json();
      const decisionId = createData.decision.id;

      // Vote
      await app.request(`/decisions/resolve-company/decisions/${decisionId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${founder.apiKey}`,
        },
        body: JSON.stringify({ option: 'Win' }),
      });

      // Resolve
      const res = await app.request(`/decisions/resolve-company/decisions/${decisionId}/resolve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${founder.apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.result.status).toBe('passed');
      expect(data.result.winning_option).toBe('Win');
    });

    it('rejects resolution from non-founders', async () => {
      const founder = await createClaimedAgent(app, 'unauth-resolve-founder');
      const member = await createClaimedAgent(app, 'unauth-resolve-member');
      await createTestCompany(app, founder.apiKey, 'unauth-resolve-company');

      await app.request('/companies/unauth-resolve-company/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${member.apiKey}`,
        },
        body: JSON.stringify({ pitch: 'Joining' }),
      });

      const createRes = await app.request('/decisions/unauth-resolve-company/decisions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${founder.apiKey}`,
        },
        body: JSON.stringify({
          title: 'Founder Only Resolve',
          options: ['A', 'B'],
        }),
      });
      const createData = await createRes.json();
      const decisionId = createData.decision.id;

      const res = await app.request(`/decisions/unauth-resolve-company/decisions/${decisionId}/resolve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${member.apiKey}` },
      });

      expect(res.status).toBe(403);
    });
  });

  // ============================================================================
  // DELETE /decisions/:company/decisions/:decisionId
  // ============================================================================

  describe('DELETE /decisions/:company/decisions/:decisionId', () => {
    it('allows proposer to cancel decision', async () => {
      const agent = await createClaimedAgent(app, 'cancel-agent');
      await createTestCompany(app, agent.apiKey, 'cancel-company');

      const createRes = await app.request('/decisions/cancel-company/decisions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({
          title: 'Cancel Decision',
          options: ['Yes', 'No'],
        }),
      });
      const createData = await createRes.json();
      const decisionId = createData.decision.id;

      const res = await app.request(`/decisions/cancel-company/decisions/${decisionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toContain('cancelled');
    });

    it('allows founder to cancel any decision', async () => {
      const founder = await createClaimedAgent(app, 'founder-cancel-founder');
      const member = await createClaimedAgent(app, 'founder-cancel-member');
      await createTestCompany(app, founder.apiKey, 'founder-cancel-company');

      await app.request('/companies/founder-cancel-company/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${member.apiKey}`,
        },
        body: JSON.stringify({ pitch: 'Joining' }),
      });

      // Member creates decision
      const createRes = await app.request('/decisions/founder-cancel-company/decisions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${member.apiKey}`,
        },
        body: JSON.stringify({
          title: 'Member Decision',
          options: ['A', 'B'],
        }),
      });
      const createData = await createRes.json();
      const decisionId = createData.decision.id;

      // Founder cancels
      const res = await app.request(`/decisions/founder-cancel-company/decisions/${decisionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${founder.apiKey}` },
      });

      expect(res.status).toBe(200);
    });

    it('rejects cancellation from unauthorized members', async () => {
      const founder = await createClaimedAgent(app, 'unauth-cancel-founder');
      const member1 = await createClaimedAgent(app, 'unauth-cancel-member1');
      const member2 = await createClaimedAgent(app, 'unauth-cancel-member2');
      await createTestCompany(app, founder.apiKey, 'unauth-cancel-company');

      await app.request('/companies/unauth-cancel-company/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${member1.apiKey}`,
        },
        body: JSON.stringify({ pitch: 'Joining' }),
      });

      await app.request('/companies/unauth-cancel-company/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${member2.apiKey}`,
        },
        body: JSON.stringify({ pitch: 'Joining' }),
      });

      // Member1 creates decision
      const createRes = await app.request('/decisions/unauth-cancel-company/decisions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${member1.apiKey}`,
        },
        body: JSON.stringify({
          title: 'Member1 Decision',
          options: ['X', 'Y'],
        }),
      });
      const createData = await createRes.json();
      const decisionId = createData.decision.id;

      // Member2 tries to cancel
      const res = await app.request(`/decisions/unauth-cancel-company/decisions/${decisionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${member2.apiKey}` },
      });

      expect(res.status).toBe(403);
    });
  });
});
