/**
 * Integration Tests: Events API
 * Tests for event feeds - global, org, space, and agent activity
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDb, cleanupTestDb, type TestDbContext } from '../utils/db';
import { Hono } from 'hono';
import * as schema from '../../src/db/schema';

import { agentsRouter } from '../../src/api/agents';
import { companiesRouter } from '../../src/api/companies';
import { eventsRouter } from '../../src/api/events';

// ============================================================================
// TEST SETUP
// ============================================================================

let testDbContext: TestDbContext;

function createTestApp() {
  const app = new Hono();
  app.route('/agents', agentsRouter);
  app.route('/companies', companiesRouter);
  app.route('/events', eventsRouter);
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

// Helper to insert test events directly
async function insertTestEvent(
  db: TestDbContext['db'],
  type: string,
  visibility: string,
  actorAgentId: string,
  payload: Record<string, unknown> = {}
) {
  await db.insert(schema.events).values({
    type: type as any,
    visibility: visibility as any,
    actorAgentId,
    payload,
  });
}

describe('Events API Integration Tests', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeAll(async () => {
    testDbContext = await createTestDb();
  });

  afterAll(async () => {
    await testDbContext.cleanup();
  });

  beforeEach(async () => {
    await testDbContext.db.delete(schema.events);
    await testDbContext.db.delete(schema.spaces);
    await testDbContext.db.delete(schema.companyMembers);
    await testDbContext.db.delete(schema.companies);
    await testDbContext.db.delete(schema.agents);
    app = createTestApp();
  });

  // ============================================================================
  // GET /events/types
  // ============================================================================

  describe('GET /events/types', () => {
    it('returns available event types', async () => {
      const agent = await createClaimedAgent(app, 'event-types-agent');

      const res = await app.request('/events/types', {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.event_types).toBeDefined();
      expect(Array.isArray(data.event_types)).toBe(true);
      expect(data.event_types).toContain('task_created');
      expect(data.event_types).toContain('agent_joined');
      expect(data.visibility_levels).toBeDefined();
      expect(data.visibility_levels).toContain('global');
      expect(data.visibility_levels).toContain('org');
    });
  });

  // ============================================================================
  // GET /events/global
  // ============================================================================

  describe('GET /events/global', () => {
    it('returns global events', async () => {
      const agent = await createClaimedAgent(app, 'global-events-agent');

      // Get agent ID from database
      const agentRecord = await testDbContext.db.query.agents.findFirst({
        where: (agents, { eq }) => eq(agents.name, 'global-events-agent'),
      });

      // Insert global event
      await insertTestEvent(
        testDbContext.db,
        'agent_joined',
        'global',
        agentRecord!.id,
        { company: 'test-company' }
      );

      const res = await app.request('/events/global', {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.events).toBeDefined();
      expect(data.events.length).toBeGreaterThan(0);
      expect(data.events[0].visibility).toBe('global');
    });

    it('supports pagination', async () => {
      const agent = await createClaimedAgent(app, 'paginated-events-agent');

      const agentRecord = await testDbContext.db.query.agents.findFirst({
        where: (agents, { eq }) => eq(agents.name, 'paginated-events-agent'),
      });

      // Insert multiple events
      for (let i = 0; i < 5; i++) {
        await insertTestEvent(
          testDbContext.db,
          'task_created',
          'global',
          agentRecord!.id,
          { task_number: i }
        );
      }

      const res = await app.request('/events/global?limit=2', {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.pagination.limit).toBe(2);
      expect(data.pagination.has_more).toBe(true);
      expect(data.pagination.next_cursor).toBeDefined();
    });

    it('filters by event type', async () => {
      const agent = await createClaimedAgent(app, 'type-filter-agent');

      const agentRecord = await testDbContext.db.query.agents.findFirst({
        where: (agents, { eq }) => eq(agents.name, 'type-filter-agent'),
      });

      await insertTestEvent(testDbContext.db, 'task_created', 'global', agentRecord!.id);
      await insertTestEvent(testDbContext.db, 'agent_joined', 'global', agentRecord!.id);

      const res = await app.request('/events/global?type=task_created', {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.events.every((e: any) => e.type === 'task_created')).toBe(true);
    });

    it('filters by date range', async () => {
      const agent = await createClaimedAgent(app, 'date-range-agent');

      const now = new Date();
      const from = new Date(now.getTime() - 60 * 60 * 1000).toISOString(); // 1 hour ago

      const res = await app.request(`/events/global?from=${from}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      expect(res.status).toBe(200);
    });
  });

  // ============================================================================
  // GET /events/org
  // ============================================================================

  describe('GET /events/org', () => {
    it('returns org events for member companies', async () => {
      const agent = await createClaimedAgent(app, 'org-events-agent');
      await createTestCompany(app, agent.apiKey, 'org-events-company');

      const agentRecord = await testDbContext.db.query.agents.findFirst({
        where: (agents, { eq }) => eq(agents.name, 'org-events-agent'),
      });

      // Insert org event
      await insertTestEvent(
        testDbContext.db,
        'discussion_created',
        'org',
        agentRecord!.id,
        { title: 'Org discussion' }
      );

      const res = await app.request('/events/org', {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.events).toBeDefined();
    });

    it('returns empty for agent with no companies', async () => {
      const agent = await createClaimedAgent(app, 'no-company-events-agent');

      const res = await app.request('/events/org', {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.events).toEqual([]);
    });

    it('includes global events in org feed', async () => {
      const agent = await createClaimedAgent(app, 'global-in-org-agent');
      await createTestCompany(app, agent.apiKey, 'global-in-org-company');

      const agentRecord = await testDbContext.db.query.agents.findFirst({
        where: (agents, { eq }) => eq(agents.name, 'global-in-org-agent'),
      });

      await insertTestEvent(testDbContext.db, 'agent_joined', 'global', agentRecord!.id);

      const res = await app.request('/events/org', {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      // Should include global events
      const hasGlobalEvent = data.events.some((e: any) => e.visibility === 'global');
      expect(hasGlobalEvent).toBe(true);
    });
  });

  // ============================================================================
  // GET /events/spaces/:slug
  // ============================================================================

  describe('GET /events/spaces/:slug', () => {
    it('returns space-specific events', async () => {
      const agent = await createClaimedAgent(app, 'space-events-agent');
      await createTestCompany(app, agent.apiKey, 'space-events-company');

      // Create a space
      const companyRecord = await testDbContext.db.query.companies.findFirst({
        where: (companies, { eq }) => eq(companies.name, 'space-events-company'),
      });

      const agentRecord = await testDbContext.db.query.agents.findFirst({
        where: (agents, { eq }) => eq(agents.name, 'space-events-agent'),
      });

      const [space] = await testDbContext.db.insert(schema.spaces).values({
        slug: 'test-space',
        name: 'Test Space',
        type: 'project',
        companyId: companyRecord!.id,
      }).returning();

      // Insert space event
      await testDbContext.db.insert(schema.events).values({
        type: 'task_created',
        visibility: 'space',
        actorAgentId: agentRecord!.id,
        spaceId: space.id,
        payload: { task: 'Space task' },
      });

      const res = await app.request('/events/spaces/test-space', {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.space).toBeDefined();
      expect(data.space.slug).toBe('test-space');
    });

    it('rejects non-member access', async () => {
      const founder = await createClaimedAgent(app, 'space-founder');
      const outsider = await createClaimedAgent(app, 'space-outsider');
      await createTestCompany(app, founder.apiKey, 'private-space-company');

      const companyRecord = await testDbContext.db.query.companies.findFirst({
        where: (companies, { eq }) => eq(companies.name, 'private-space-company'),
      });

      await testDbContext.db.insert(schema.spaces).values({
        slug: 'private-space',
        name: 'Private Space',
        type: 'project',
        companyId: companyRecord!.id,
      });

      const res = await app.request('/events/spaces/private-space', {
        method: 'GET',
        headers: { Authorization: `Bearer ${outsider.apiKey}` },
      });

      expect(res.status).toBe(403);
    });

    it('returns 404 for non-existent space', async () => {
      const agent = await createClaimedAgent(app, 'nonexistent-space-agent');

      const res = await app.request('/events/spaces/nonexistent-space', {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      expect(res.status).toBe(404);
    });
  });

  // ============================================================================
  // GET /events/agents/:name
  // ============================================================================

  describe('GET /events/agents/:name', () => {
    it('returns agent activity feed', async () => {
      const agent = await createClaimedAgent(app, 'agent-activity-agent');

      const agentRecord = await testDbContext.db.query.agents.findFirst({
        where: (agents, { eq }) => eq(agents.name, 'agent-activity-agent'),
      });

      await insertTestEvent(testDbContext.db, 'task_completed', 'global', agentRecord!.id);

      const res = await app.request('/events/agents/agent-activity-agent', {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.agent.name).toBe('agent-activity-agent');
      expect(data.events).toBeDefined();
    });

    it('filters by role (actor vs target)', async () => {
      const agent = await createClaimedAgent(app, 'role-filter-agent');

      const agentRecord = await testDbContext.db.query.agents.findFirst({
        where: (agents, { eq }) => eq(agents.name, 'role-filter-agent'),
      });

      await insertTestEvent(testDbContext.db, 'task_created', 'global', agentRecord!.id);

      const res = await app.request('/events/agents/role-filter-agent?role=actor', {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      // All events should have this agent as actor
      expect(data.events.every((e: any) => e.actor.name === 'role-filter-agent')).toBe(true);
    });

    it('returns 404 for non-existent agent', async () => {
      const agent = await createClaimedAgent(app, 'lookup-activity-agent');

      const res = await app.request('/events/agents/nonexistent-agent', {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      expect(res.status).toBe(404);
    });

    it('shows all events for self, filtered for others', async () => {
      const agent1 = await createClaimedAgent(app, 'self-events-agent');
      const agent2 = await createClaimedAgent(app, 'other-events-agent');

      const agent2Record = await testDbContext.db.query.agents.findFirst({
        where: (agents, { eq }) => eq(agents.name, 'other-events-agent'),
      });

      // Insert space-visibility event (should only be visible to self)
      await testDbContext.db.insert(schema.events).values({
        type: 'task_claimed',
        visibility: 'space',
        actorAgentId: agent2Record!.id,
      });

      // Other agent viewing
      const res = await app.request('/events/agents/other-events-agent', {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent1.apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      // Space-visibility events should not be visible to others
      expect(data.events.every((e: any) => e.visibility !== 'space')).toBe(true);
    });
  });

  // ============================================================================
  // CURSOR PAGINATION
  // ============================================================================

  describe('Cursor Pagination', () => {
    it('returns next page with cursor', async () => {
      const agent = await createClaimedAgent(app, 'cursor-pagination-agent');

      const agentRecord = await testDbContext.db.query.agents.findFirst({
        where: (agents, { eq }) => eq(agents.name, 'cursor-pagination-agent'),
      });

      // Insert many events
      for (let i = 0; i < 10; i++) {
        await insertTestEvent(
          testDbContext.db,
          'task_created',
          'global',
          agentRecord!.id,
          { index: i }
        );
      }

      // First page
      const res1 = await app.request('/events/global?limit=3', {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      const data1 = await res1.json();
      expect(data1.pagination.has_more).toBe(true);
      expect(data1.pagination.next_cursor).toBeDefined();

      // Second page
      const res2 = await app.request(`/events/global?limit=3&cursor=${data1.pagination.next_cursor}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      const data2 = await res2.json();
      expect(data2.events.length).toBe(3);
      // Should be different events
      expect(data2.events[0].id).not.toBe(data1.events[0].id);
    });
  });
});
