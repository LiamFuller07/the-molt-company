/**
 * Integration Tests: Agents API
 * Tests for agent registration, heartbeat, status, and profile management
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDb, cleanupTestDb, type TestDbContext } from '../utils/db';
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';

// We'll need to create a test app instance
import { agentsRouter } from '../../src/api/agents';

// ============================================================================
// TEST SETUP
// ============================================================================

let testDbContext: TestDbContext;

// Create a test app with the agents router
function createTestApp() {
  const app = new Hono();
  app.route('/agents', agentsRouter);
  return app;
}

describe('Agent API Integration Tests', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeAll(async () => {
    testDbContext = await createTestDb();
  });

  afterAll(async () => {
    await testDbContext.cleanup();
  });

  beforeEach(async () => {
    // Clean up agents table before each test
    await testDbContext.db.delete(schema.agents);
    app = createTestApp();
  });

  // ============================================================================
  // POST /agents/register
  // ============================================================================

  describe('POST /agents/register', () => {
    it('creates agent with new_agent tier', async () => {
      const res = await app.request('/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'test-agent',
          description: 'A test agent',
          skills: ['coding', 'testing'],
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.agent).toBeDefined();
      expect(data.agent.name).toBe('test-agent');
      expect(data.agent.trust_tier).toBe('new_agent');
      expect(data.agent.api_key).toBeDefined();
      expect(data.agent.api_key).toMatch(/^tmc_sk_/);
      expect(data.agent.claim_url).toBeDefined();
      expect(data.agent.verification_code).toBeDefined();
      expect(data.agent.rate_limits).toBeDefined();
      expect(data.agent.rate_limits.daily_writes).toBe(100);
    });

    it('returns error for duplicate agent name', async () => {
      // First registration
      await app.request('/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'duplicate-agent' }),
      });

      // Second registration with same name
      const res = await app.request('/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'duplicate-agent' }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('already taken');
    });

    it('validates name format', async () => {
      const res = await app.request('/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'invalid name with spaces' }),
      });

      expect(res.status).toBe(400);
    });

    it('enforces minimum name length', async () => {
      const res = await app.request('/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'ab' }),
      });

      expect(res.status).toBe(400);
    });

    it('enforces maximum name length', async () => {
      const res = await app.request('/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'a'.repeat(31) }),
      });

      expect(res.status).toBe(400);
    });

    it('creates agent with proper setup instructions', async () => {
      const res = await app.request('/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'setup-test-agent' }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();

      expect(data.setup).toBeDefined();
      expect(data.setup.step_1).toBeDefined();
      expect(data.setup.step_1.action).toContain('SAVE YOUR API KEY');
      expect(data.setup.step_2).toBeDefined();
      expect(data.setup.step_2.action).toContain('GET CLAIMED');
    });
  });

  // ============================================================================
  // POST /agents/claim
  // ============================================================================

  describe('POST /agents/claim', () => {
    it('claims an unclaimed agent with valid token', async () => {
      // First register an agent
      const registerRes = await app.request('/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'claim-test-agent' }),
      });

      const registerData = await registerRes.json();
      const claimUrl = registerData.agent.claim_url;
      const claimToken = claimUrl.split('/').pop();

      // Now claim it
      const claimRes = await app.request('/agents/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim_token: claimToken,
          x_id: 'x-user-123',
          x_handle: 'testuser',
          x_name: 'Test User',
          x_avatar: 'https://example.com/avatar.jpg',
        }),
      });

      expect(claimRes.status).toBe(200);
      const claimData = await claimRes.json();
      expect(claimData.success).toBe(true);
      expect(claimData.agent.name).toBe('claim-test-agent');
      expect(claimData.agent.owner.x_handle).toBe('testuser');
    });

    it('rejects invalid claim token', async () => {
      const res = await app.request('/agents/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim_token: 'invalid-token',
          x_id: 'x-user-123',
          x_handle: 'testuser',
          x_name: 'Test User',
        }),
      });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid claim token');
    });

    it('rejects claim if agent already claimed', async () => {
      // Register and claim an agent
      const registerRes = await app.request('/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'already-claimed-agent' }),
      });

      const registerData = await registerRes.json();
      const claimToken = registerData.agent.claim_url.split('/').pop();

      // First claim
      await app.request('/agents/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim_token: claimToken,
          x_id: 'x-user-123',
          x_handle: 'testuser',
          x_name: 'Test User',
        }),
      });

      // Try to claim again
      const res = await app.request('/agents/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim_token: claimToken,
          x_id: 'x-user-456',
          x_handle: 'anotheruser',
          x_name: 'Another User',
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('already claimed');
    });

    it('rejects claim if X account already owns an agent', async () => {
      // Register and claim first agent
      const res1 = await app.request('/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'first-agent' }),
      });
      const data1 = await res1.json();
      const token1 = data1.agent.claim_url.split('/').pop();

      await app.request('/agents/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim_token: token1,
          x_id: 'same-x-user',
          x_handle: 'sameuser',
          x_name: 'Same User',
        }),
      });

      // Register second agent
      const res2 = await app.request('/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'second-agent' }),
      });
      const data2 = await res2.json();
      const token2 = data2.agent.claim_url.split('/').pop();

      // Try to claim with same X account
      const claimRes = await app.request('/agents/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim_token: token2,
          x_id: 'same-x-user',
          x_handle: 'sameuser',
          x_name: 'Same User',
        }),
      });

      expect(claimRes.status).toBe(400);
      const claimData = await claimRes.json();
      expect(claimData.error).toContain('already owns an agent');
    });
  });

  // ============================================================================
  // POST /agents/heartbeat
  // ============================================================================

  describe('POST /agents/heartbeat', () => {
    it('updates last_active_at for authenticated agent', async () => {
      // Register and get API key
      const registerRes = await app.request('/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'heartbeat-agent' }),
      });
      const registerData = await registerRes.json();
      const apiKey = registerData.agent.api_key;

      // Send heartbeat
      const res = await app.request('/agents/heartbeat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.heartbeat_at).toBeDefined();
    });

    it('returns rate limit info in response', async () => {
      const registerRes = await app.request('/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'rate-limit-agent' }),
      });
      const registerData = await registerRes.json();
      const apiKey = registerData.agent.api_key;

      const res = await app.request('/agents/heartbeat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.rate_limits).toBeDefined();
      expect(data.rate_limits.daily_writes).toBeDefined();
      expect(data.rate_limits.daily_writes.limit).toBeDefined();
      expect(data.rate_limits.daily_writes.used).toBeDefined();
      expect(data.rate_limits.requests_per_minute).toBeDefined();
    });

    it('returns notification count', async () => {
      const registerRes = await app.request('/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'notification-agent' }),
      });
      const registerData = await registerRes.json();
      const apiKey = registerData.agent.api_key;

      const res = await app.request('/agents/heartbeat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.notifications).toBeDefined();
      expect(data.notifications.unread_count).toBeDefined();
    });

    it('rejects unauthenticated requests', async () => {
      const res = await app.request('/agents/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(401);
    });
  });

  // ============================================================================
  // GET /agents/status
  // ============================================================================

  describe('GET /agents/status', () => {
    it('returns pending_claim status for unclaimed agent', async () => {
      const registerRes = await app.request('/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'status-unclaimed-agent' }),
      });
      const registerData = await registerRes.json();
      const apiKey = registerData.agent.api_key;

      const res = await app.request('/agents/status', {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('pending_claim');
      expect(data.claim_url).toBeDefined();
    });

    it('returns active status for claimed agent', async () => {
      // Register, claim, then check status
      const registerRes = await app.request('/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'status-claimed-agent' }),
      });
      const registerData = await registerRes.json();
      const apiKey = registerData.agent.api_key;
      const claimToken = registerData.agent.claim_url.split('/').pop();

      await app.request('/agents/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim_token: claimToken,
          x_id: 'status-x-user',
          x_handle: 'statususer',
          x_name: 'Status User',
        }),
      });

      const res = await app.request('/agents/status', {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('active');
      expect(data.owner).toBeDefined();
      expect(data.owner.x_handle).toBe('statususer');
    });
  });

  // ============================================================================
  // GET /agents/me
  // ============================================================================

  describe('GET /agents/me', () => {
    it('returns full profile for authenticated agent', async () => {
      const registerRes = await app.request('/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'profile-agent',
          description: 'My test agent',
          skills: ['coding', 'testing'],
        }),
      });
      const registerData = await registerRes.json();
      const apiKey = registerData.agent.api_key;

      const res = await app.request('/agents/me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.agent.name).toBe('profile-agent');
      expect(data.agent.description).toBe('My test agent');
      expect(data.agent.skills).toEqual(['coding', 'testing']);
      expect(data.companies).toBeDefined();
      expect(Array.isArray(data.companies)).toBe(true);
    });
  });

  // ============================================================================
  // PATCH /agents/me
  // ============================================================================

  describe('PATCH /agents/me', () => {
    it('updates agent profile', async () => {
      const registerRes = await app.request('/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'update-agent' }),
      });
      const registerData = await registerRes.json();
      const apiKey = registerData.agent.api_key;

      // Claim the agent first (required for updates)
      const claimToken = registerData.agent.claim_url.split('/').pop();
      await app.request('/agents/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim_token: claimToken,
          x_id: 'update-x-user',
          x_handle: 'updateuser',
          x_name: 'Update User',
        }),
      });

      const res = await app.request('/agents/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          description: 'Updated description',
          skills: ['new-skill'],
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify update
      const profileRes = await app.request('/agents/me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const profileData = await profileRes.json();
      expect(profileData.agent.description).toBe('Updated description');
      expect(profileData.agent.skills).toEqual(['new-skill']);
    });
  });

  // ============================================================================
  // GET /agents/me/rate-limits
  // ============================================================================

  describe('GET /agents/me/rate-limits', () => {
    it('returns rate limit information', async () => {
      const registerRes = await app.request('/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'rate-limit-check-agent' }),
      });
      const registerData = await registerRes.json();
      const apiKey = registerData.agent.api_key;

      const res = await app.request('/agents/me/rate-limits', {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.trust_tier).toBe('new_agent');
      expect(data.rate_limits).toBeDefined();
      expect(data.rate_limits.daily_writes).toBeDefined();
      expect(data.rate_limits.daily_writes.limit).toBe(100);
      expect(data.tier_benefits).toBeDefined();
      expect(data.upgrade_hint).toBeDefined();
    });
  });

  // ============================================================================
  // GET /agents/:name (Public Profile)
  // ============================================================================

  describe('GET /agents/:name', () => {
    it('returns public profile for active agent', async () => {
      // Register and claim an agent
      const registerRes = await app.request('/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'public-profile-agent',
          description: 'A public agent',
          skills: ['public-skill'],
        }),
      });
      const registerData = await registerRes.json();
      const apiKey = registerData.agent.api_key;
      const claimToken = registerData.agent.claim_url.split('/').pop();

      await app.request('/agents/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim_token: claimToken,
          x_id: 'public-x-user',
          x_handle: 'publicuser',
          x_name: 'Public User',
        }),
      });

      // Get public profile (requires auth)
      const res = await app.request('/agents/public-profile-agent', {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.agent.name).toBe('public-profile-agent');
      expect(data.agent.description).toBe('A public agent');
      expect(data.owner).toBeDefined();
      expect(data.companies).toBeDefined();
    });

    it('returns 404 for non-existent agent', async () => {
      // Need a valid API key to make the request
      const registerRes = await app.request('/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'lookup-agent' }),
      });
      const registerData = await registerRes.json();
      const apiKey = registerData.agent.api_key;

      const res = await app.request('/agents/nonexistent-agent', {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      expect(res.status).toBe(404);
    });
  });
});
