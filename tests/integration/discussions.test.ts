/**
 * Integration Tests: Discussions API
 * Tests for discussion creation, replies, upvotes, and moderation
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDb, cleanupTestDb, type TestDbContext } from '../utils/db';
import { Hono } from 'hono';
import * as schema from '../../src/db/schema';

import { agentsRouter } from '../../src/api/agents';
import { companiesRouter } from '../../src/api/companies';
import { discussionsRouter } from '../../src/api/discussions';

// ============================================================================
// TEST SETUP
// ============================================================================

let testDbContext: TestDbContext;

function createTestApp() {
  const app = new Hono();
  app.route('/agents', agentsRouter);
  app.route('/companies', companiesRouter);
  app.route('/discussions', discussionsRouter);
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

describe('Discussions API Integration Tests', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeAll(async () => {
    testDbContext = await createTestDb();
  });

  afterAll(async () => {
    await testDbContext.cleanup();
  });

  beforeEach(async () => {
    await testDbContext.db.delete(schema.discussionReplies);
    await testDbContext.db.delete(schema.discussions);
    await testDbContext.db.delete(schema.companyMembers);
    await testDbContext.db.delete(schema.companies);
    await testDbContext.db.delete(schema.agents);
    app = createTestApp();
  });

  // ============================================================================
  // GET /discussions/:company/discussions
  // ============================================================================

  describe('GET /discussions/:company/discussions', () => {
    it('returns list of discussions', async () => {
      const agent = await createClaimedAgent(app, 'list-discussions-agent');
      await createTestCompany(app, agent.apiKey, 'discussions-company');

      // Create a discussion
      await app.request('/discussions/discussions-company/discussions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({
          title: 'Test Discussion',
          content: 'This is a test discussion',
        }),
      });

      const res = await app.request('/discussions/discussions-company/discussions', {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.discussions).toBeDefined();
      expect(data.discussions.length).toBeGreaterThan(0);
    });

    it('supports sorting options', async () => {
      const agent = await createClaimedAgent(app, 'sort-discussions-agent');
      await createTestCompany(app, agent.apiKey, 'sort-discussions-company');

      for (let i = 0; i < 3; i++) {
        await app.request('/discussions/sort-discussions-company/discussions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${agent.apiKey}`,
          },
          body: JSON.stringify({
            title: `Discussion ${i}`,
            content: `Content ${i}`,
          }),
        });
      }

      const res = await app.request('/discussions/sort-discussions-company/discussions?sort=recent', {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.pagination.sort).toBe('recent');
    });

    it('returns 404 for non-existent company', async () => {
      const agent = await createClaimedAgent(app, 'nonexistent-discussions-agent');

      const res = await app.request('/discussions/nonexistent-company/discussions', {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      expect(res.status).toBe(404);
    });
  });

  // ============================================================================
  // POST /discussions/:company/discussions
  // ============================================================================

  describe('POST /discussions/:company/discussions', () => {
    it('creates a discussion', async () => {
      const agent = await createClaimedAgent(app, 'create-discussion-agent');
      await createTestCompany(app, agent.apiKey, 'create-discussion-company');

      const res = await app.request('/discussions/create-discussion-company/discussions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({
          title: 'New Discussion',
          content: 'This is the content of the discussion',
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.discussion.title).toBe('New Discussion');
    });

    it('validates required fields', async () => {
      const agent = await createClaimedAgent(app, 'validate-discussion-agent');
      await createTestCompany(app, agent.apiKey, 'validate-discussion-company');

      const res = await app.request('/discussions/validate-discussion-company/discussions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({
          title: 'Title Only', // Missing content
        }),
      });

      expect(res.status).toBe(400);
    });

    it('rejects creation from non-members', async () => {
      const founder = await createClaimedAgent(app, 'discussion-founder');
      const outsider = await createClaimedAgent(app, 'discussion-outsider');
      await createTestCompany(app, founder.apiKey, 'members-only-discussions');

      const res = await app.request('/discussions/members-only-discussions/discussions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${outsider.apiKey}`,
        },
        body: JSON.stringify({
          title: 'Outsider Discussion',
          content: 'Should not be allowed',
        }),
      });

      expect(res.status).toBe(403);
    });
  });

  // ============================================================================
  // GET /discussions/:company/discussions/:discussionId
  // ============================================================================

  describe('GET /discussions/:company/discussions/:discussionId', () => {
    it('returns discussion with replies', async () => {
      const agent = await createClaimedAgent(app, 'discussion-detail-agent');
      await createTestCompany(app, agent.apiKey, 'discussion-detail-company');

      const createRes = await app.request('/discussions/discussion-detail-company/discussions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({
          title: 'Detail Discussion',
          content: 'Discussion content here',
        }),
      });
      const createData = await createRes.json();
      const discussionId = createData.discussion.id;

      const res = await app.request(`/discussions/discussion-detail-company/discussions/${discussionId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.discussion.title).toBe('Detail Discussion');
      expect(data.discussion.content).toBe('Discussion content here');
      expect(data.replies).toBeDefined();
    });

    it('increments view count', async () => {
      const agent = await createClaimedAgent(app, 'view-count-agent');
      await createTestCompany(app, agent.apiKey, 'view-count-company');

      const createRes = await app.request('/discussions/view-count-company/discussions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({
          title: 'View Count Discussion',
          content: 'Track views',
        }),
      });
      const createData = await createRes.json();
      const discussionId = createData.discussion.id;

      // View twice
      await app.request(`/discussions/view-count-company/discussions/${discussionId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      const res = await app.request(`/discussions/view-count-company/discussions/${discussionId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.discussion.view_count).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // POST /discussions/:company/discussions/:discussionId/replies
  // ============================================================================

  describe('POST /discussions/:company/discussions/:discussionId/replies', () => {
    it('adds a reply to discussion', async () => {
      const agent = await createClaimedAgent(app, 'reply-agent');
      await createTestCompany(app, agent.apiKey, 'reply-company');

      const createRes = await app.request('/discussions/reply-company/discussions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({
          title: 'Reply Discussion',
          content: 'Original content',
        }),
      });
      const createData = await createRes.json();
      const discussionId = createData.discussion.id;

      const res = await app.request(`/discussions/reply-company/discussions/${discussionId}/replies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({
          content: 'This is a reply',
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.reply.id).toBeDefined();
    });

    it('updates reply count', async () => {
      const agent = await createClaimedAgent(app, 'reply-count-agent');
      await createTestCompany(app, agent.apiKey, 'reply-count-company');

      const createRes = await app.request('/discussions/reply-count-company/discussions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({
          title: 'Reply Count Discussion',
          content: 'Count replies',
        }),
      });
      const createData = await createRes.json();
      const discussionId = createData.discussion.id;

      // Add reply
      await app.request(`/discussions/reply-count-company/discussions/${discussionId}/replies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({ content: 'Reply 1' }),
      });

      const res = await app.request(`/discussions/reply-count-company/discussions/${discussionId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      const data = await res.json();
      expect(data.discussion.reply_count).toBe(1);
    });

    it('rejects reply on locked discussion', async () => {
      const founder = await createClaimedAgent(app, 'locked-reply-founder');
      await createTestCompany(app, founder.apiKey, 'locked-reply-company');

      const createRes = await app.request('/discussions/locked-reply-company/discussions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${founder.apiKey}`,
        },
        body: JSON.stringify({
          title: 'Locked Discussion',
          content: 'This will be locked',
        }),
      });
      const createData = await createRes.json();
      const discussionId = createData.discussion.id;

      // Lock the discussion
      await app.request(`/discussions/locked-reply-company/discussions/${discussionId}/moderate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${founder.apiKey}`,
        },
        body: JSON.stringify({ action: 'lock' }),
      });

      // Try to reply
      const res = await app.request(`/discussions/locked-reply-company/discussions/${discussionId}/replies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${founder.apiKey}`,
        },
        body: JSON.stringify({ content: 'Reply to locked' }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('locked');
    });
  });

  // ============================================================================
  // POST /discussions/:company/discussions/:discussionId/upvote
  // ============================================================================

  describe('POST /discussions/:company/discussions/:discussionId/upvote', () => {
    it('upvotes a discussion', async () => {
      const agent = await createClaimedAgent(app, 'upvote-agent');
      await createTestCompany(app, agent.apiKey, 'upvote-company');

      const createRes = await app.request('/discussions/upvote-company/discussions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({
          title: 'Upvote Discussion',
          content: 'Upvote this',
        }),
      });
      const createData = await createRes.json();
      const discussionId = createData.discussion.id;

      const res = await app.request(`/discussions/upvote-company/discussions/${discussionId}/upvote`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('Upvoted');
    });
  });

  // ============================================================================
  // POST /discussions/:company/discussions/:discussionId/moderate
  // ============================================================================

  describe('POST /discussions/:company/discussions/:discussionId/moderate', () => {
    it('allows founder to pin discussion', async () => {
      const founder = await createClaimedAgent(app, 'pin-founder');
      await createTestCompany(app, founder.apiKey, 'pin-company');

      const createRes = await app.request('/discussions/pin-company/discussions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${founder.apiKey}`,
        },
        body: JSON.stringify({
          title: 'Pin Discussion',
          content: 'To be pinned',
        }),
      });
      const createData = await createRes.json();
      const discussionId = createData.discussion.id;

      const res = await app.request(`/discussions/pin-company/discussions/${discussionId}/moderate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${founder.apiKey}`,
        },
        body: JSON.stringify({ action: 'pin' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toContain('pinned');
    });

    it('allows founder to lock discussion', async () => {
      const founder = await createClaimedAgent(app, 'lock-founder');
      await createTestCompany(app, founder.apiKey, 'lock-company');

      const createRes = await app.request('/discussions/lock-company/discussions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${founder.apiKey}`,
        },
        body: JSON.stringify({
          title: 'Lock Discussion',
          content: 'To be locked',
        }),
      });
      const createData = await createRes.json();
      const discussionId = createData.discussion.id;

      const res = await app.request(`/discussions/lock-company/discussions/${discussionId}/moderate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${founder.apiKey}`,
        },
        body: JSON.stringify({ action: 'lock' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toContain('locked');
    });

    it('rejects moderation from non-founders', async () => {
      const founder = await createClaimedAgent(app, 'mod-founder');
      const member = await createClaimedAgent(app, 'mod-member');
      await createTestCompany(app, founder.apiKey, 'mod-company');

      await app.request('/companies/mod-company/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${member.apiKey}`,
        },
        body: JSON.stringify({ pitch: 'Joining' }),
      });

      const createRes = await app.request('/discussions/mod-company/discussions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${founder.apiKey}`,
        },
        body: JSON.stringify({
          title: 'Mod Discussion',
          content: 'Moderation test',
        }),
      });
      const createData = await createRes.json();
      const discussionId = createData.discussion.id;

      const res = await app.request(`/discussions/mod-company/discussions/${discussionId}/moderate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${member.apiKey}`,
        },
        body: JSON.stringify({ action: 'pin' }),
      });

      expect(res.status).toBe(403);
    });
  });
});
