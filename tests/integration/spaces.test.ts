/**
 * Integration Tests: Spaces API
 * Tests for space creation, management, and events
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

describe('Spaces API Integration Tests', () => {
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
  // SPACE CREATION
  // ============================================================================

  describe('Space Creation', () => {
    it('creates a space with required fields', async () => {
      const agent = await createClaimedAgent(app, 'create-space-agent');
      await createTestCompany(app, agent.apiKey, 'create-space-company');

      const companyRecord = await testDbContext.db.query.companies.findFirst({
        where: (companies, { eq }) => eq(companies.name, 'create-space-company'),
      });

      const agentRecord = await testDbContext.db.query.agents.findFirst({
        where: (agents, { eq }) => eq(agents.name, 'create-space-agent'),
      });

      // Create space directly in DB (as API might not be fully implemented)
      const [space] = await testDbContext.db.insert(schema.spaces).values({
        slug: 'new-space',
        name: 'New Space',
        type: 'project',
        description: 'A project space',
        companyId: companyRecord!.id,
        adminAgentId: agentRecord!.id,
      }).returning();

      expect(space.id).toBeDefined();
      expect(space.slug).toBe('new-space');
      expect(space.name).toBe('New Space');
      expect(space.type).toBe('project');
    });

    it('creates spaces with different types', async () => {
      const agent = await createClaimedAgent(app, 'type-space-agent');
      await createTestCompany(app, agent.apiKey, 'type-space-company');

      const companyRecord = await testDbContext.db.query.companies.findFirst({
        where: (companies, { eq }) => eq(companies.name, 'type-space-company'),
      });

      const spaceTypes = ['home', 'project', 'department', 'social'] as const;

      for (const type of spaceTypes) {
        const [space] = await testDbContext.db.insert(schema.spaces).values({
          slug: `${type}-space`,
          name: `${type.charAt(0).toUpperCase() + type.slice(1)} Space`,
          type,
          companyId: companyRecord!.id,
        }).returning();

        expect(space.type).toBe(type);
      }

      const allSpaces = await testDbContext.db.query.spaces.findMany({
        where: (spaces, { eq }) => eq(spaces.companyId, companyRecord!.id),
      });

      expect(allSpaces.length).toBe(4);
    });

    it('enforces unique slug constraint', async () => {
      const agent = await createClaimedAgent(app, 'unique-slug-agent');
      await createTestCompany(app, agent.apiKey, 'unique-slug-company');

      const companyRecord = await testDbContext.db.query.companies.findFirst({
        where: (companies, { eq }) => eq(companies.name, 'unique-slug-company'),
      });

      // Create first space
      await testDbContext.db.insert(schema.spaces).values({
        slug: 'unique-slug',
        name: 'First Space',
        type: 'project',
        companyId: companyRecord!.id,
      });

      // Try to create duplicate slug
      await expect(
        testDbContext.db.insert(schema.spaces).values({
          slug: 'unique-slug',
          name: 'Second Space',
          type: 'project',
          companyId: companyRecord!.id,
        })
      ).rejects.toThrow();
    });
  });

  // ============================================================================
  // SPACE MEMBERSHIP
  // ============================================================================

  describe('Space Membership', () => {
    it('space belongs to a company', async () => {
      const agent = await createClaimedAgent(app, 'company-space-agent');
      await createTestCompany(app, agent.apiKey, 'company-space-company');

      const companyRecord = await testDbContext.db.query.companies.findFirst({
        where: (companies, { eq }) => eq(companies.name, 'company-space-company'),
      });

      const [space] = await testDbContext.db.insert(schema.spaces).values({
        slug: 'company-space',
        name: 'Company Space',
        type: 'project',
        companyId: companyRecord!.id,
      }).returning();

      expect(space.companyId).toBe(companyRecord!.id);
    });

    it('space can have an admin agent', async () => {
      const agent = await createClaimedAgent(app, 'admin-space-agent');
      await createTestCompany(app, agent.apiKey, 'admin-space-company');

      const companyRecord = await testDbContext.db.query.companies.findFirst({
        where: (companies, { eq }) => eq(companies.name, 'admin-space-company'),
      });

      const agentRecord = await testDbContext.db.query.agents.findFirst({
        where: (agents, { eq }) => eq(agents.name, 'admin-space-agent'),
      });

      const [space] = await testDbContext.db.insert(schema.spaces).values({
        slug: 'admin-space',
        name: 'Admin Space',
        type: 'project',
        companyId: companyRecord!.id,
        adminAgentId: agentRecord!.id,
      }).returning();

      expect(space.adminAgentId).toBe(agentRecord!.id);
    });
  });

  // ============================================================================
  // SPACE EVENTS
  // ============================================================================

  describe('Space Events', () => {
    it('events can be scoped to a space', async () => {
      const agent = await createClaimedAgent(app, 'space-event-agent');
      await createTestCompany(app, agent.apiKey, 'space-event-company');

      const companyRecord = await testDbContext.db.query.companies.findFirst({
        where: (companies, { eq }) => eq(companies.name, 'space-event-company'),
      });

      const agentRecord = await testDbContext.db.query.agents.findFirst({
        where: (agents, { eq }) => eq(agents.name, 'space-event-agent'),
      });

      const [space] = await testDbContext.db.insert(schema.spaces).values({
        slug: 'event-space',
        name: 'Event Space',
        type: 'project',
        companyId: companyRecord!.id,
      }).returning();

      // Create space-scoped event
      const [event] = await testDbContext.db.insert(schema.events).values({
        type: 'task_created',
        visibility: 'space',
        actorAgentId: agentRecord!.id,
        spaceId: space.id,
        payload: { task: 'Space-scoped task' },
      }).returning();

      expect(event.spaceId).toBe(space.id);
      expect(event.visibility).toBe('space');
    });

    it('space events are filtered by access', async () => {
      const founder = await createClaimedAgent(app, 'space-access-founder');
      const outsider = await createClaimedAgent(app, 'space-access-outsider');
      await createTestCompany(app, founder.apiKey, 'space-access-company');

      const companyRecord = await testDbContext.db.query.companies.findFirst({
        where: (companies, { eq }) => eq(companies.name, 'space-access-company'),
      });

      const founderRecord = await testDbContext.db.query.agents.findFirst({
        where: (agents, { eq }) => eq(agents.name, 'space-access-founder'),
      });

      const [space] = await testDbContext.db.insert(schema.spaces).values({
        slug: 'access-space',
        name: 'Access Space',
        type: 'project',
        companyId: companyRecord!.id,
      }).returning();

      // Create space event
      await testDbContext.db.insert(schema.events).values({
        type: 'discussion_created',
        visibility: 'space',
        actorAgentId: founderRecord!.id,
        spaceId: space.id,
      });

      // Outsider tries to access
      const res = await app.request('/events/spaces/access-space', {
        method: 'GET',
        headers: { Authorization: `Bearer ${outsider.apiKey}` },
      });

      expect(res.status).toBe(403);
    });

    it('member can access space events', async () => {
      const founder = await createClaimedAgent(app, 'member-access-founder');
      await createTestCompany(app, founder.apiKey, 'member-access-company');

      const companyRecord = await testDbContext.db.query.companies.findFirst({
        where: (companies, { eq }) => eq(companies.name, 'member-access-company'),
      });

      const founderRecord = await testDbContext.db.query.agents.findFirst({
        where: (agents, { eq }) => eq(agents.name, 'member-access-founder'),
      });

      const [space] = await testDbContext.db.insert(schema.spaces).values({
        slug: 'member-access-space',
        name: 'Member Access Space',
        type: 'project',
        companyId: companyRecord!.id,
      }).returning();

      // Create space event
      await testDbContext.db.insert(schema.events).values({
        type: 'task_completed',
        visibility: 'space',
        actorAgentId: founderRecord!.id,
        spaceId: space.id,
      });

      // Member (founder) accesses
      const res = await app.request('/events/spaces/member-access-space', {
        method: 'GET',
        headers: { Authorization: `Bearer ${founder.apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.space.slug).toBe('member-access-space');
    });
  });

  // ============================================================================
  // PINNED CONTEXT
  // ============================================================================

  describe('Pinned Context', () => {
    it('space can have pinned context', async () => {
      const agent = await createClaimedAgent(app, 'pinned-context-agent');
      await createTestCompany(app, agent.apiKey, 'pinned-context-company');

      const companyRecord = await testDbContext.db.query.companies.findFirst({
        where: (companies, { eq }) => eq(companies.name, 'pinned-context-company'),
      });

      const [space] = await testDbContext.db.insert(schema.spaces).values({
        slug: 'pinned-context-space',
        name: 'Pinned Context Space',
        type: 'project',
        companyId: companyRecord!.id,
        pinnedContext: 'This is the pinned context for agents in this space.',
      }).returning();

      expect(space.pinnedContext).toBe('This is the pinned context for agents in this space.');
    });

    it('pinned context can be updated', async () => {
      const agent = await createClaimedAgent(app, 'update-context-agent');
      await createTestCompany(app, agent.apiKey, 'update-context-company');

      const companyRecord = await testDbContext.db.query.companies.findFirst({
        where: (companies, { eq }) => eq(companies.name, 'update-context-company'),
      });

      const [space] = await testDbContext.db.insert(schema.spaces).values({
        slug: 'update-context-space',
        name: 'Update Context Space',
        type: 'project',
        companyId: companyRecord!.id,
        pinnedContext: 'Original context',
      }).returning();

      // Update pinned context
      await testDbContext.db.update(schema.spaces)
        .set({ pinnedContext: 'Updated context' })
        .where((spaces) => spaces.id.equals(space.id));

      const updatedSpace = await testDbContext.db.query.spaces.findFirst({
        where: (spaces, { eq }) => eq(spaces.id, space.id),
      });

      expect(updatedSpace?.pinnedContext).toBe('Updated context');
    });
  });

  // ============================================================================
  // SPACE QUERIES
  // ============================================================================

  describe('Space Queries', () => {
    it('spaces are linked to companies via relations', async () => {
      const agent = await createClaimedAgent(app, 'relation-space-agent');
      await createTestCompany(app, agent.apiKey, 'relation-space-company');

      const companyRecord = await testDbContext.db.query.companies.findFirst({
        where: (companies, { eq }) => eq(companies.name, 'relation-space-company'),
      });

      await testDbContext.db.insert(schema.spaces).values({
        slug: 'relation-space',
        name: 'Relation Space',
        type: 'project',
        companyId: companyRecord!.id,
      });

      // Query company with spaces relation
      const companyWithSpaces = await testDbContext.db.query.companies.findFirst({
        where: (companies, { eq }) => eq(companies.name, 'relation-space-company'),
        with: {
          spaces: true,
        },
      });

      expect(companyWithSpaces?.spaces).toBeDefined();
      expect(companyWithSpaces?.spaces.length).toBeGreaterThan(0);
      expect(companyWithSpaces?.spaces[0].slug).toBe('relation-space');
    });

    it('spaces can be queried by type', async () => {
      const agent = await createClaimedAgent(app, 'type-query-agent');
      await createTestCompany(app, agent.apiKey, 'type-query-company');

      const companyRecord = await testDbContext.db.query.companies.findFirst({
        where: (companies, { eq }) => eq(companies.name, 'type-query-company'),
      });

      // Create spaces of different types
      await testDbContext.db.insert(schema.spaces).values([
        { slug: 'project-1', name: 'Project 1', type: 'project', companyId: companyRecord!.id },
        { slug: 'project-2', name: 'Project 2', type: 'project', companyId: companyRecord!.id },
        { slug: 'social-1', name: 'Social 1', type: 'social', companyId: companyRecord!.id },
      ]);

      // Query project spaces only
      const projectSpaces = await testDbContext.db.query.spaces.findMany({
        where: (spaces, { and, eq }) => and(
          eq(spaces.companyId, companyRecord!.id),
          eq(spaces.type, 'project')
        ),
      });

      expect(projectSpaces.length).toBe(2);
      expect(projectSpaces.every(s => s.type === 'project')).toBe(true);
    });
  });
});
