/**
 * E2E Tests: Task Completion Flow
 * Tests task lifecycle from creation to completion with equity rewards
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDb, cleanupTestDb, type TestDbContext } from '../utils/db';
import {
  createTestApp,
  createCompany,
  createTask,
  getTask,
  claimTask,
  updateTask,
  completeTask,
  listTasks,
  getEquity,
  getAgentProfile,
  joinCompany,
  grantEquity,
  uniqueName,
  createClaimedAgent,
} from './helpers';

describe('Task Completion Flow', () => {
  let dbContext: TestDbContext;
  let app: ReturnType<typeof createTestApp>;

  // Shared test fixtures
  let founder: { apiKey: string; name: string };
  let member: { apiKey: string; name: string };
  let companyName: string;

  beforeAll(async () => {
    dbContext = await createTestDb();
    app = createTestApp();
  });

  afterAll(async () => {
    await dbContext.cleanup();
  });

  beforeEach(async () => {
    await cleanupTestDb(dbContext.db);

    // Set up company with founder and member
    founder = await createClaimedAgent(app, uniqueName('founder'));
    member = await createClaimedAgent(app, uniqueName('member'));

    companyName = uniqueName('task-company');
    await createCompany(app, founder.apiKey, companyName, {
      displayName: 'Task Test Company',
      initialEquity: 100,
    });

    // Member joins the company
    await joinCompany(app, member.apiKey, companyName, 'I want to help!');

    // Grant some initial equity to member so they can participate
    await grantEquity(app, founder.apiKey, companyName, member.name, 10, 'Initial grant');
  });

  describe('Task Creation', () => {
    it('should create a task successfully', async () => {
      const task = await createTask(app, founder.apiKey, companyName, 'Test Task', {
        description: 'A test task description',
        priority: 'high',
        equityReward: 5,
        karmaReward: 50,
      });

      expect(task.id).toBeDefined();
      expect(task.title).toBe('Test Task');
      expect(task.status).toBe('open');
      expect(task.priority).toBe('high');
    });

    it('should create a task with an assignee', async () => {
      const task = await createTask(app, founder.apiKey, companyName, 'Assigned Task', {
        assignedTo: member.name,
        equityReward: 3,
      });

      const taskDetails = await getTask(app, founder.apiKey, companyName, task.id);
      expect(taskDetails.assigned_to?.name).toBe(member.name);
    });

    it('should enforce permission for task creation', async () => {
      // Create a third agent with no company membership
      const outsider = await createClaimedAgent(app, uniqueName('outsider'));

      await expect(
        createTask(app, outsider.apiKey, companyName, 'Forbidden Task')
      ).rejects.toThrow('not a member');
    });

    it('should create tasks with different priorities', async () => {
      const urgentTask = await createTask(app, founder.apiKey, companyName, 'Urgent!', {
        priority: 'urgent',
      });
      const lowTask = await createTask(app, founder.apiKey, companyName, 'Low priority', {
        priority: 'low',
      });

      expect(urgentTask.priority).toBe('urgent');
      expect(lowTask.priority).toBe('low');
    });
  });

  describe('Task Claiming', () => {
    it('should allow claiming an open task', async () => {
      const task = await createTask(app, founder.apiKey, companyName, 'Claimable Task');

      await claimTask(app, member.apiKey, companyName, task.id);

      const taskDetails = await getTask(app, member.apiKey, companyName, task.id);
      expect(taskDetails.status).toBe('claimed');
      expect(taskDetails.assigned_to?.name).toBe(member.name);
      expect(taskDetails.claimed_at).toBeDefined();
    });

    it('should prevent claiming an already claimed task', async () => {
      const task = await createTask(app, founder.apiKey, companyName, 'Single Claim Task');

      // First claim
      await claimTask(app, member.apiKey, companyName, task.id);

      // Second claim should fail (even by founder)
      await expect(
        claimTask(app, founder.apiKey, companyName, task.id)
      ).rejects.toThrow('not open');
    });

    it('should allow claiming a pre-assigned task by the assignee', async () => {
      const task = await createTask(app, founder.apiKey, companyName, 'Pre-assigned', {
        assignedTo: member.name,
      });

      await claimTask(app, member.apiKey, companyName, task.id);

      const taskDetails = await getTask(app, member.apiKey, companyName, task.id);
      expect(taskDetails.status).toBe('claimed');
    });

    it('should prevent claiming a task assigned to someone else', async () => {
      // Create a third member
      const thirdMember = await createClaimedAgent(app, uniqueName('third'));
      await joinCompany(app, thirdMember.apiKey, companyName, 'Me too!');

      const task = await createTask(app, founder.apiKey, companyName, 'Exclusive Task', {
        assignedTo: member.name,
      });

      await expect(
        claimTask(app, thirdMember.apiKey, companyName, task.id)
      ).rejects.toThrow('assigned to someone else');
    });
  });

  describe('Task Progress Updates', () => {
    it('should update task status to in_progress', async () => {
      const task = await createTask(app, founder.apiKey, companyName, 'Progress Task');
      await claimTask(app, member.apiKey, companyName, task.id);

      await updateTask(app, member.apiKey, companyName, task.id, {
        status: 'in_progress',
      });

      const taskDetails = await getTask(app, member.apiKey, companyName, task.id);
      expect(taskDetails.status).toBe('in_progress');
    });

    it('should update task to review status', async () => {
      const task = await createTask(app, founder.apiKey, companyName, 'Review Task');
      await claimTask(app, member.apiKey, companyName, task.id);

      await updateTask(app, member.apiKey, companyName, task.id, {
        status: 'review',
        deliverableNotes: 'Ready for review',
      });

      const taskDetails = await getTask(app, member.apiKey, companyName, task.id);
      expect(taskDetails.status).toBe('review');
      expect(taskDetails.deliverable_notes).toBe('Ready for review');
    });

    it('should allow updating task priority', async () => {
      const task = await createTask(app, founder.apiKey, companyName, 'Priority Change', {
        priority: 'low',
      });

      await updateTask(app, founder.apiKey, companyName, task.id, {
        priority: 'urgent',
      });

      const taskDetails = await getTask(app, founder.apiKey, companyName, task.id);
      expect(taskDetails.priority).toBe('urgent');
    });
  });

  describe('Task Completion and Rewards', () => {
    it('should complete task and earn equity reward', async () => {
      const equityReward = 5;

      // Get initial equity
      const initialEquity = await getEquity(app, member.apiKey, companyName);
      const initialMemberShare = initialEquity.myShare;

      // Create task with equity reward
      const task = await createTask(app, founder.apiKey, companyName, 'Rewarded Task', {
        equityReward,
        karmaReward: 100,
      });

      // Claim and complete task
      await claimTask(app, member.apiKey, companyName, task.id);
      await completeTask(app, member.apiKey, companyName, task.id, {
        url: 'https://github.com/example/pr/123',
        notes: 'Completed the task successfully',
      });

      // Verify task is completed
      const taskDetails = await getTask(app, member.apiKey, companyName, task.id);
      expect(taskDetails.status).toBe('completed');
      expect(taskDetails.completed_at).toBeDefined();

      // Verify equity was granted
      const finalEquity = await getEquity(app, member.apiKey, companyName);
      expect(finalEquity.myShare).toBe(initialMemberShare + equityReward);
    });

    it('should earn karma reward on task completion', async () => {
      const karmaReward = 100;

      // Get initial karma
      const initialProfile = await getAgentProfile(app, member.apiKey);
      const initialKarma = initialProfile.agent.karma;
      const initialTasksCompleted = initialProfile.agent.tasks_completed;

      // Create and complete task
      const task = await createTask(app, founder.apiKey, companyName, 'Karma Task', {
        karmaReward,
      });

      await claimTask(app, member.apiKey, companyName, task.id);
      await completeTask(app, member.apiKey, companyName, task.id, {
        notes: 'Done!',
      });

      // Verify karma and task count increased
      const finalProfile = await getAgentProfile(app, member.apiKey);
      expect(finalProfile.agent.karma).toBe(initialKarma + karmaReward);
      expect(finalProfile.agent.tasks_completed).toBe(initialTasksCompleted + 1);
    });

    it('should only allow assignee to complete task', async () => {
      const task = await createTask(app, founder.apiKey, companyName, 'Exclusive Complete');
      await claimTask(app, member.apiKey, companyName, task.id);

      // Founder (not assignee) trying to complete should fail
      await expect(
        completeTask(app, founder.apiKey, companyName, task.id, {
          notes: 'Trying to steal completion',
        })
      ).rejects.toThrow('Only the assignee');
    });

    it('should complete task without equity reward', async () => {
      const initialEquity = await getEquity(app, member.apiKey, companyName);
      const initialMemberShare = initialEquity.myShare;

      // Task with no equity reward
      const task = await createTask(app, founder.apiKey, companyName, 'No Equity Task', {
        equityReward: 0,
        karmaReward: 10,
      });

      await claimTask(app, member.apiKey, companyName, task.id);
      await completeTask(app, member.apiKey, companyName, task.id, {
        notes: 'Done without equity',
      });

      // Equity should remain the same
      const finalEquity = await getEquity(app, member.apiKey, companyName);
      expect(finalEquity.myShare).toBe(initialMemberShare);
    });
  });

  describe('Task Listing and Filtering', () => {
    it('should list tasks for a company', async () => {
      // Create multiple tasks
      await createTask(app, founder.apiKey, companyName, 'Task 1');
      await createTask(app, founder.apiKey, companyName, 'Task 2');
      await createTask(app, founder.apiKey, companyName, 'Task 3');

      const { tasks } = await listTasks(app, founder.apiKey, companyName);
      expect(tasks.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter tasks by status', async () => {
      // Create tasks with different statuses
      const openTask = await createTask(app, founder.apiKey, companyName, 'Open Task');
      const claimedTask = await createTask(app, founder.apiKey, companyName, 'Claimed Task');

      await claimTask(app, member.apiKey, companyName, claimedTask.id);

      // Filter by open status
      const { tasks: openTasks } = await listTasks(app, founder.apiKey, companyName, {
        status: 'open',
      });

      const openTaskIds = openTasks.map((t: any) => t.id);
      expect(openTaskIds).toContain(openTask.id);
      expect(openTaskIds).not.toContain(claimedTask.id);
    });

    it('should paginate task results', async () => {
      // Create several tasks
      for (let i = 0; i < 5; i++) {
        await createTask(app, founder.apiKey, companyName, `Batch Task ${i}`);
      }

      // Get first page
      const { tasks: page1, hasMore, nextCursor } = await listTasks(
        app,
        founder.apiKey,
        companyName,
        { limit: 3 }
      );

      expect(page1.length).toBe(3);
      expect(hasMore).toBe(true);
      expect(nextCursor).toBeDefined();

      // Get second page
      const { tasks: page2 } = await listTasks(app, founder.apiKey, companyName, {
        limit: 3,
        cursor: nextCursor!,
      });

      expect(page2.length).toBeGreaterThanOrEqual(2);

      // Ensure no overlap
      const page1Ids = page1.map((t: any) => t.id);
      const page2Ids = page2.map((t: any) => t.id);
      const overlap = page1Ids.filter((id: string) => page2Ids.includes(id));
      expect(overlap).toHaveLength(0);
    });
  });

  describe('Task Cancellation', () => {
    it('should allow cancelling an open task', async () => {
      const task = await createTask(app, founder.apiKey, companyName, 'Cancellable Task');

      await updateTask(app, founder.apiKey, companyName, task.id, {
        status: 'cancelled',
      });

      const taskDetails = await getTask(app, founder.apiKey, companyName, task.id);
      expect(taskDetails.status).toBe('cancelled');
    });

    it('should prevent claiming a cancelled task', async () => {
      const task = await createTask(app, founder.apiKey, companyName, 'To Cancel');
      await updateTask(app, founder.apiKey, companyName, task.id, {
        status: 'cancelled',
      });

      await expect(
        claimTask(app, member.apiKey, companyName, task.id)
      ).rejects.toThrow('not open');
    });
  });

  describe('Complete Task Flow E2E', () => {
    it('should handle full task lifecycle with multiple participants', async () => {
      // Create a new member
      const developer = await createClaimedAgent(app, uniqueName('developer'));
      await joinCompany(app, developer.apiKey, companyName, 'I am a developer!', 'Developer');

      // Founder creates task
      const task = await createTask(app, founder.apiKey, companyName, 'Feature Implementation', {
        description: 'Implement the new feature',
        priority: 'high',
        equityReward: 2,
        karmaReward: 50,
      });

      // Developer claims task
      await claimTask(app, developer.apiKey, companyName, task.id);

      // Developer updates progress
      await updateTask(app, developer.apiKey, companyName, task.id, {
        status: 'in_progress',
      });

      // Developer marks for review
      await updateTask(app, developer.apiKey, companyName, task.id, {
        status: 'review',
        deliverableUrl: 'https://github.com/org/repo/pull/42',
        deliverableNotes: 'Please review the implementation',
      });

      // Developer completes the task
      await completeTask(app, developer.apiKey, companyName, task.id, {
        url: 'https://github.com/org/repo/pull/42',
        notes: 'Feature complete and merged',
      });

      // Verify final state
      const finalTask = await getTask(app, founder.apiKey, companyName, task.id);
      expect(finalTask.status).toBe('completed');
      expect(finalTask.deliverable_url).toBe('https://github.com/org/repo/pull/42');
      expect(finalTask.completed_at).toBeDefined();

      // Verify developer earned equity
      const developerEquity = await getEquity(app, developer.apiKey, companyName);
      expect(developerEquity.myShare).toBe(2);

      // Verify developer karma increased
      const developerProfile = await getAgentProfile(app, developer.apiKey);
      expect(developerProfile.agent.tasks_completed).toBe(1);
    });
  });
});
