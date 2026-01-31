/**
 * Integration Tests: Tasks API
 * Tests for task creation, claiming, completion, and management
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDb, cleanupTestDb, type TestDbContext } from '../utils/db';
import { Hono } from 'hono';
import * as schema from '../../src/db/schema';

import { agentsRouter } from '../../src/api/agents';
import { companiesRouter } from '../../src/api/companies';
import { tasksRouter } from '../../src/api/tasks';

// ============================================================================
// TEST SETUP
// ============================================================================

let testDbContext: TestDbContext;

function createTestApp() {
  const app = new Hono();
  app.route('/agents', agentsRouter);
  app.route('/companies', companiesRouter);
  app.route('/tasks', tasksRouter);
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

// Helper to create a company
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

describe('Tasks API Integration Tests', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeAll(async () => {
    testDbContext = await createTestDb();
  });

  afterAll(async () => {
    await testDbContext.cleanup();
  });

  beforeEach(async () => {
    // Clean up tables
    await testDbContext.db.delete(schema.tasks);
    await testDbContext.db.delete(schema.companyMembers);
    await testDbContext.db.delete(schema.companies);
    await testDbContext.db.delete(schema.agents);
    app = createTestApp();
  });

  // ============================================================================
  // GET /tasks
  // ============================================================================

  describe('GET /tasks', () => {
    it('returns tasks for agent companies', async () => {
      const agent = await createClaimedAgent(app, 'task-list-agent');
      await createTestCompany(app, agent.apiKey, 'task-list-company');

      // Create a task
      await app.request('/tasks/task-list-company/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({
          title: 'Test Task',
          description: 'A test task',
          priority: 'medium',
        }),
      });

      const res = await app.request('/tasks', {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.tasks).toBeDefined();
      expect(data.tasks.length).toBeGreaterThan(0);
    });

    it('supports status filter', async () => {
      const agent = await createClaimedAgent(app, 'status-filter-agent');
      await createTestCompany(app, agent.apiKey, 'status-filter-company');

      // Create open task
      await app.request('/tasks/status-filter-company/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({ title: 'Open Task' }),
      });

      const res = await app.request('/tasks?status=open', {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.tasks.every((t: any) => t.status === 'open')).toBe(true);
    });

    it('supports cursor pagination', async () => {
      const agent = await createClaimedAgent(app, 'cursor-agent');
      await createTestCompany(app, agent.apiKey, 'cursor-company');

      // Create multiple tasks
      for (let i = 0; i < 5; i++) {
        await app.request('/tasks/cursor-company/tasks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${agent.apiKey}`,
          },
          body: JSON.stringify({ title: `Task ${i}` }),
        });
      }

      const res = await app.request('/tasks?limit=2', {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.pagination).toBeDefined();
      expect(data.pagination.has_more).toBe(true);
      expect(data.pagination.next_cursor).toBeDefined();
    });

    it('returns empty for agent with no companies', async () => {
      const agent = await createClaimedAgent(app, 'no-company-agent');

      const res = await app.request('/tasks', {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.tasks).toEqual([]);
    });
  });

  // ============================================================================
  // GET /tasks/:company/tasks
  // ============================================================================

  describe('GET /tasks/:company/tasks', () => {
    it('returns company tasks', async () => {
      const agent = await createClaimedAgent(app, 'company-tasks-agent');
      await createTestCompany(app, agent.apiKey, 'company-tasks-company');

      await app.request('/tasks/company-tasks-company/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({ title: 'Company Task' }),
      });

      const res = await app.request('/tasks/company-tasks-company/tasks', {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.tasks.length).toBeGreaterThan(0);
      expect(data.tasks[0].title).toBe('Company Task');
    });

    it('returns 404 for non-existent company', async () => {
      const agent = await createClaimedAgent(app, 'nonexistent-company-agent');

      const res = await app.request('/tasks/nonexistent-company/tasks', {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      expect(res.status).toBe(404);
    });
  });

  // ============================================================================
  // POST /tasks/:company/tasks
  // ============================================================================

  describe('POST /tasks/:company/tasks', () => {
    it('creates a task', async () => {
      const agent = await createClaimedAgent(app, 'create-task-agent');
      await createTestCompany(app, agent.apiKey, 'create-task-company');

      const res = await app.request('/tasks/create-task-company/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({
          title: 'New Task',
          description: 'Task description',
          priority: 'high',
          equity_reward: 5,
          karma_reward: 20,
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.task.title).toBe('New Task');
      expect(data.task.id).toBeDefined();
    });

    it('rejects task creation for non-members', async () => {
      const founder = await createClaimedAgent(app, 'task-founder');
      const outsider = await createClaimedAgent(app, 'task-outsider');
      await createTestCompany(app, founder.apiKey, 'member-only-company');

      const res = await app.request('/tasks/member-only-company/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${outsider.apiKey}`,
        },
        body: JSON.stringify({ title: 'Outsider Task' }),
      });

      expect(res.status).toBe(403);
    });

    it('validates task data', async () => {
      const agent = await createClaimedAgent(app, 'validate-task-agent');
      await createTestCompany(app, agent.apiKey, 'validate-task-company');

      const res = await app.request('/tasks/validate-task-company/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({
          title: '', // Empty title should fail
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  // ============================================================================
  // GET /tasks/:company/tasks/:taskId
  // ============================================================================

  describe('GET /tasks/:company/tasks/:taskId', () => {
    it('returns task details', async () => {
      const agent = await createClaimedAgent(app, 'task-detail-agent');
      await createTestCompany(app, agent.apiKey, 'task-detail-company');

      const createRes = await app.request('/tasks/task-detail-company/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({
          title: 'Detail Task',
          description: 'Task with details',
          priority: 'urgent',
        }),
      });
      const createData = await createRes.json();
      const taskId = createData.task.id;

      const res = await app.request(`/tasks/task-detail-company/tasks/${taskId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.task.title).toBe('Detail Task');
      expect(data.task.priority).toBe('urgent');
    });

    it('returns 404 for non-existent task', async () => {
      const agent = await createClaimedAgent(app, 'nonexistent-task-agent');
      await createTestCompany(app, agent.apiKey, 'nonexistent-task-company');

      const res = await app.request('/tasks/nonexistent-task-company/tasks/00000000-0000-0000-0000-000000000000', {
        method: 'GET',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      expect(res.status).toBe(404);
    });
  });

  // ============================================================================
  // POST /tasks/:company/tasks/:taskId/claim
  // ============================================================================

  describe('POST /tasks/:company/tasks/:taskId/claim', () => {
    it('claims an open task', async () => {
      const agent = await createClaimedAgent(app, 'claim-task-agent');
      await createTestCompany(app, agent.apiKey, 'claim-task-company');

      const createRes = await app.request('/tasks/claim-task-company/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({ title: 'Claimable Task' }),
      });
      const createData = await createRes.json();
      const taskId = createData.task.id;

      const res = await app.request(`/tasks/claim-task-company/tasks/${taskId}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('claimed');
    });

    it('rejects claiming already claimed task', async () => {
      const founder = await createClaimedAgent(app, 'double-claim-founder');
      const member = await createClaimedAgent(app, 'double-claim-member');
      await createTestCompany(app, founder.apiKey, 'double-claim-company');

      // Member joins company
      await app.request('/companies/double-claim-company/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${member.apiKey}`,
        },
        body: JSON.stringify({ pitch: 'Joining' }),
      });

      // Founder creates task
      const createRes = await app.request('/tasks/double-claim-company/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${founder.apiKey}`,
        },
        body: JSON.stringify({ title: 'Single Claim Task' }),
      });
      const createData = await createRes.json();
      const taskId = createData.task.id;

      // Founder claims
      await app.request(`/tasks/double-claim-company/tasks/${taskId}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${founder.apiKey}` },
      });

      // Member tries to claim
      const res = await app.request(`/tasks/double-claim-company/tasks/${taskId}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${member.apiKey}` },
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('not open');
    });
  });

  // ============================================================================
  // PATCH /tasks/:company/tasks/:taskId
  // ============================================================================

  describe('PATCH /tasks/:company/tasks/:taskId', () => {
    it('updates task status', async () => {
      const agent = await createClaimedAgent(app, 'update-task-agent');
      await createTestCompany(app, agent.apiKey, 'update-task-company');

      const createRes = await app.request('/tasks/update-task-company/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({ title: 'Updatable Task' }),
      });
      const createData = await createRes.json();
      const taskId = createData.task.id;

      // Claim first
      await app.request(`/tasks/update-task-company/tasks/${taskId}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      // Update to in_progress
      const res = await app.request(`/tasks/update-task-company/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({ status: 'in_progress' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('completes task and awards karma', async () => {
      const agent = await createClaimedAgent(app, 'complete-task-agent');
      await createTestCompany(app, agent.apiKey, 'complete-task-company');

      const createRes = await app.request('/tasks/complete-task-company/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({
          title: 'Completable Task',
          karma_reward: 50,
        }),
      });
      const createData = await createRes.json();
      const taskId = createData.task.id;

      // Claim
      await app.request(`/tasks/complete-task-company/tasks/${taskId}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
      });

      // Complete
      const res = await app.request(`/tasks/complete-task-company/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify({
          status: 'completed',
          deliverable_url: 'https://github.com/example/pr/123',
          deliverable_notes: 'Completed the task!',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toContain('completed');
      expect(data.message).toContain('karma');
    });

    it('rejects update from non-assignee', async () => {
      const founder = await createClaimedAgent(app, 'unauth-update-founder');
      const member = await createClaimedAgent(app, 'unauth-update-member');
      await createTestCompany(app, founder.apiKey, 'unauth-update-company');

      await app.request('/companies/unauth-update-company/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${member.apiKey}`,
        },
        body: JSON.stringify({ pitch: 'Joining' }),
      });

      const createRes = await app.request('/tasks/unauth-update-company/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${founder.apiKey}`,
        },
        body: JSON.stringify({ title: 'Founder Task' }),
      });
      const createData = await createRes.json();
      const taskId = createData.task.id;

      await app.request(`/tasks/unauth-update-company/tasks/${taskId}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${founder.apiKey}` },
      });

      // Member tries to update
      const res = await app.request(`/tasks/unauth-update-company/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${member.apiKey}`,
        },
        body: JSON.stringify({ status: 'completed' }),
      });

      expect(res.status).toBe(403);
    });
  });
});
