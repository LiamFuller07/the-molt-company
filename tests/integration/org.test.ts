/**
 * Integration Tests: Org/Companies API
 * Tests for company creation, joining, settings, and membership management
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDb, cleanupTestDb, type TestDbContext } from '../utils/db';
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';

import { agentsRouter } from '../../src/api/agents';
import { companiesRouter } from '../../src/api/companies';

// ============================================================================
// TEST SETUP
// ============================================================================

let testDbContext: TestDbContext;

function createTestApp() {
  const app = new Hono();
  app.route('/agents', agentsRouter);
  app.route('/companies', companiesRouter);
  return app;
}

// Helper to register and claim an agent
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

describe('Org/Companies API Integration Tests', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeAll(async () => {
    testDbContext = await createTestDb();
  });

  afterAll(async () => {
    await testDbContext.cleanup();
  });

  beforeEach(async () => {
    // Clean up tables before each test
    await testDbContext.db.delete(schema.companyMembers);
    await testDbContext.db.delete(schema.companies);
    await testDbContext.db.delete(schema.agents);
    app = createTestApp();
  });

  // ============================================================================
  // GET /companies
  // ============================================================================

  describe('GET /companies', () => {
    it('returns list of public companies', async () => {
      const agent = await createClaimedAgent(app, 'list-companies-agent');

      // Create a company first
      await app.request('/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({
          name: 'test-company',
          display_name: 'Test Company',
          description: 'A test company',
          is_public: true,
        }),
      });

      const res = await app.request('/companies', {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.companies).toBeDefined();
      expect(Array.isArray(data.companies)).toBe(true);
      expect(data.companies.length).toBeGreaterThan(0);
    });

    it('supports pagination parameters', async () => {
      const agent = await createClaimedAgent(app, 'pagination-agent');

      // Create multiple companies
      for (let i = 0; i < 5; i++) {
        await app.request('/companies', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${agent.apiKey}`,
          },
          body: JSON.stringify({
            name: `paginated-company-${i}`,
            display_name: `Paginated Company ${i}`,
          }),
        });
      }

      const res = await app.request('/companies?limit=2&offset=1', {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.pagination).toBeDefined();
      expect(data.pagination.limit).toBe(2);
      expect(data.pagination.offset).toBe(1);
    });
  });

  // ============================================================================
  // GET /companies/:name
  // ============================================================================

  describe('GET /companies/:name', () => {
    it('returns company details', async () => {
      const agent = await createClaimedAgent(app, 'get-company-agent');

      // Create company
      await app.request('/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({
          name: 'detail-company',
          display_name: 'Detail Company',
          description: 'Company for detail testing',
          mission: 'Test the details',
        }),
      });

      const res = await app.request('/companies/detail-company', {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.company.name).toBe('detail-company');
      expect(data.company.display_name).toBe('Detail Company');
      expect(data.company.description).toBe('Company for detail testing');
      expect(data.company.mission).toBe('Test the details');
      expect(data.members).toBeDefined();
    });

    it('includes equity policy', async () => {
      const agent = await createClaimedAgent(app, 'equity-policy-agent');

      await app.request('/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({
          name: 'equity-policy-company',
          display_name: 'Equity Policy Company',
          initial_equity: 200,
        }),
      });

      const res = await app.request('/companies/equity-policy-company', {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.company.total_equity).toBeDefined();
    });

    it('returns 404 for non-existent company', async () => {
      const agent = await createClaimedAgent(app, 'lookup-company-agent');

      const res = await app.request('/companies/nonexistent-company', {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      expect(res.status).toBe(404);
    });
  });

  // ============================================================================
  // POST /companies
  // ============================================================================

  describe('POST /companies', () => {
    it('creates a new company', async () => {
      const agent = await createClaimedAgent(app, 'create-company-agent');

      const res = await app.request('/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({
          name: 'new-company',
          display_name: 'New Company',
          description: 'A brand new company',
          mission: 'Do great things',
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.company.name).toBe('new-company');
      expect(data.your_role.role).toBe('founder');
    });

    it('makes creator the founder with initial equity', async () => {
      const agent = await createClaimedAgent(app, 'founder-equity-agent');

      await app.request('/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({
          name: 'founder-equity-company',
          display_name: 'Founder Equity Company',
          initial_equity: 100,
        }),
      });

      const detailRes = await app.request('/companies/founder-equity-company', {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      const detailData = await detailRes.json();
      expect(detailData.your_membership).toBeDefined();
      expect(detailData.your_membership.role).toBe('founder');
      expect(parseFloat(detailData.your_membership.equity)).toBe(100);
    });

    it('rejects duplicate company name', async () => {
      const agent = await createClaimedAgent(app, 'duplicate-company-agent');

      // Create first company
      await app.request('/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({
          name: 'duplicate-name',
          display_name: 'First Company',
        }),
      });

      // Try to create duplicate
      const res = await app.request('/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({
          name: 'duplicate-name',
          display_name: 'Second Company',
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('already taken');
    });

    it('requires claimed agent', async () => {
      // Register but don't claim
      const registerRes = await app.request('/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'unclaimed-company-agent' }),
      });
      const registerData = await registerRes.json();
      const apiKey = registerData.agent.api_key;

      const res = await app.request('/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          name: 'unclaimed-company',
          display_name: 'Unclaimed Company',
        }),
      });

      expect(res.status).toBe(403);
    });
  });

  // ============================================================================
  // POST /companies/:name/join
  // ============================================================================

  describe('POST /companies/:name/join', () => {
    it('adds agent to org', async () => {
      const founder = await createClaimedAgent(app, 'join-founder');
      const joiner = await createClaimedAgent(app, 'join-member');

      // Create company that allows applications
      await app.request('/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${founder.apiKey}`,
        },
        body: JSON.stringify({
          name: 'join-test-company',
          display_name: 'Join Test Company',
          is_public: true,
        }),
      });

      // Joiner applies
      const res = await app.request('/companies/join-test-company/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${joiner.apiKey}`,
        },
        body: JSON.stringify({
          pitch: 'I want to join this company!',
          role: 'Developer',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('assigns default space/role to new member', async () => {
      const founder = await createClaimedAgent(app, 'space-founder');
      const joiner = await createClaimedAgent(app, 'space-member');

      await app.request('/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${founder.apiKey}`,
        },
        body: JSON.stringify({
          name: 'space-test-company',
          display_name: 'Space Test Company',
        }),
      });

      const res = await app.request('/companies/space-test-company/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${joiner.apiKey}`,
        },
        body: JSON.stringify({
          pitch: 'Ready to contribute!',
        }),
      });

      const data = await res.json();
      expect(data.membership).toBeDefined();
      expect(data.membership.role).toBe('member');
    });

    it('rejects join if applications disabled', async () => {
      const founder = await createClaimedAgent(app, 'closed-founder');
      const joiner = await createClaimedAgent(app, 'closed-member');

      // Create company with applications disabled
      await app.request('/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${founder.apiKey}`,
        },
        body: JSON.stringify({
          name: 'closed-company',
          display_name: 'Closed Company',
        }),
      });

      // Disable applications via settings
      await app.request('/companies/closed-company/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${founder.apiKey}`,
        },
        body: JSON.stringify({ allow_applications: false }),
      });

      // Try to join
      const res = await app.request('/companies/closed-company/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${joiner.apiKey}`,
        },
        body: JSON.stringify({ pitch: 'Please let me in!' }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('not accepting applications');
    });

    it('rejects duplicate membership', async () => {
      const founder = await createClaimedAgent(app, 'dup-member-founder');
      const joiner = await createClaimedAgent(app, 'dup-member-joiner');

      await app.request('/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${founder.apiKey}`,
        },
        body: JSON.stringify({
          name: 'dup-member-company',
          display_name: 'Duplicate Member Company',
        }),
      });

      // First join
      await app.request('/companies/dup-member-company/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${joiner.apiKey}`,
        },
        body: JSON.stringify({ pitch: 'First join' }),
      });

      // Try to join again
      const res = await app.request('/companies/dup-member-company/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${joiner.apiKey}`,
        },
        body: JSON.stringify({ pitch: 'Second join' }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('already a member');
    });
  });

  // ============================================================================
  // DELETE /companies/:name/membership
  // ============================================================================

  describe('DELETE /companies/:name/membership', () => {
    it('removes agent from company', async () => {
      const founder = await createClaimedAgent(app, 'leave-founder');
      const member = await createClaimedAgent(app, 'leave-member');

      await app.request('/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${founder.apiKey}`,
        },
        body: JSON.stringify({
          name: 'leave-company',
          display_name: 'Leave Company',
        }),
      });

      await app.request('/companies/leave-company/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${member.apiKey}`,
        },
        body: JSON.stringify({ pitch: 'Joining to leave' }),
      });

      const res = await app.request('/companies/leave-company/membership', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${member.apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('left');
    });

    it('founders cannot leave', async () => {
      const founder = await createClaimedAgent(app, 'founder-leave-agent');

      await app.request('/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${founder.apiKey}`,
        },
        body: JSON.stringify({
          name: 'founder-leave-company',
          display_name: 'Founder Leave Company',
        }),
      });

      const res = await app.request('/companies/founder-leave-company/membership', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${founder.apiKey}` },
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Founders cannot leave');
    });
  });

  // ============================================================================
  // PATCH /companies/:name/settings
  // ============================================================================

  describe('PATCH /companies/:name/settings', () => {
    it('updates company settings', async () => {
      const founder = await createClaimedAgent(app, 'settings-founder');

      await app.request('/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${founder.apiKey}`,
        },
        body: JSON.stringify({
          name: 'settings-company',
          display_name: 'Settings Company',
        }),
      });

      const res = await app.request('/companies/settings-company/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${founder.apiKey}`,
        },
        body: JSON.stringify({
          display_name: 'Updated Company Name',
          description: 'Updated description',
          is_public: false,
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify changes
      const detailRes = await app.request('/companies/settings-company', {
        method: 'GET',
        headers: { Authorization: `Bearer ${founder.apiKey}` },
      });
      const detailData = await detailRes.json();
      expect(detailData.company.display_name).toBe('Updated Company Name');
      expect(detailData.company.description).toBe('Updated description');
    });

    it('rejects unauthorized settings update', async () => {
      const founder = await createClaimedAgent(app, 'unauth-settings-founder');
      const member = await createClaimedAgent(app, 'unauth-settings-member');

      await app.request('/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${founder.apiKey}`,
        },
        body: JSON.stringify({
          name: 'unauth-settings-company',
          display_name: 'Unauth Settings Company',
        }),
      });

      await app.request('/companies/unauth-settings-company/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${member.apiKey}`,
        },
        body: JSON.stringify({ pitch: 'Joining' }),
      });

      const res = await app.request('/companies/unauth-settings-company/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${member.apiKey}`,
        },
        body: JSON.stringify({ display_name: 'Hacked Name' }),
      });

      expect(res.status).toBe(403);
    });
  });

  // ============================================================================
  // GET /companies/:name/prompt
  // ============================================================================

  describe('GET /companies/:name/prompt', () => {
    it('returns company prompt for members', async () => {
      const founder = await createClaimedAgent(app, 'prompt-founder');

      await app.request('/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${founder.apiKey}`,
        },
        body: JSON.stringify({
          name: 'prompt-company',
          display_name: 'Prompt Company',
          mission: 'Build great things',
        }),
      });

      const res = await app.request('/companies/prompt-company/prompt', {
        method: 'GET',
        headers: { Authorization: `Bearer ${founder.apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.prompt).toBeDefined();
      expect(data.company).toBe('Prompt Company');
      expect(data.your_role).toBeDefined();
    });

    it('rejects non-member access to prompt', async () => {
      const founder = await createClaimedAgent(app, 'private-prompt-founder');
      const outsider = await createClaimedAgent(app, 'private-prompt-outsider');

      await app.request('/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${founder.apiKey}`,
        },
        body: JSON.stringify({
          name: 'private-prompt-company',
          display_name: 'Private Prompt Company',
        }),
      });

      const res = await app.request('/companies/private-prompt-company/prompt', {
        method: 'GET',
        headers: { Authorization: `Bearer ${outsider.apiKey}` },
      });

      expect(res.status).toBe(403);
    });
  });
});
