import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc, asc, sql, or, gte, lte, inArray } from 'drizzle-orm';
import { db } from '../db';
import { tasks, companies, companyMembers, agents, equityTransactions, spaces } from '../db/schema';
import { authMiddleware, requireClaimed, type AuthContext } from '../middleware/auth';
import { emitEvent } from './events';
import { sanitizeLine, sanitizeContent } from '../utils/sanitize';

export const tasksRouter = new Hono<AuthContext>();

// All routes require auth
tasksRouter.use('*', authMiddleware);

// ============================================================================
// HELPER: Build cursor for pagination
// ============================================================================

function encodeCursor(sortValue: string, id: string): string {
  return Buffer.from(`${sortValue}|${id}`).toString('base64');
}

function decodeCursor(cursor: string): { sortValue: string; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const [sortValue, id] = decoded.split('|');
    return { sortValue, id };
  } catch {
    return null;
  }
}

// ============================================================================
// GET /tasks - Global Tasks List with Cursor Pagination
// ============================================================================

const listTasksQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(25),
  status: z.enum(['all', 'open', 'claimed', 'in_progress', 'review', 'completed', 'cancelled']).default('all'),
  priority: z.enum(['all', 'low', 'medium', 'high', 'urgent']).default('all'),
  assigned_to: z.string().optional(),
  space: z.string().optional(),
  sort: z.enum(['created', 'priority', 'due_date']).default('created'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

tasksRouter.get('/', zValidator('query', listTasksQuerySchema), async (c) => {
  const agent = c.get('agent');
  const { cursor, limit, status, priority, assigned_to, space, sort, order } = c.req.valid('query');

  // Get agent's companies
  const memberships = await db.query.companyMembers.findMany({
    where: eq(companyMembers.agentId, agent.id),
  });
  const companyIds = memberships.map(m => m.companyId);

  if (companyIds.length === 0) {
    return c.json({
      success: true,
      tasks: [],
      pagination: { limit, has_more: false, next_cursor: null },
    });
  }

  // Build where conditions
  const conditions: any[] = [
    inArray(tasks.companyId, companyIds),
  ];

  // Status filter
  if (status !== 'all') {
    conditions.push(eq(tasks.status, status));
  }

  // Priority filter
  if (priority !== 'all') {
    conditions.push(eq(tasks.priority, priority));
  }

  // Assigned to filter
  if (assigned_to) {
    const assignee = await db.query.agents.findFirst({
      where: eq(agents.name, assigned_to),
    });
    if (assignee) {
      conditions.push(eq(tasks.assignedTo, assignee.id));
    }
  }

  // Space filter - find tasks in company associated with space
  if (space) {
    const targetSpace = await db.query.spaces.findFirst({
      where: eq(spaces.slug, space),
    });
    if (targetSpace && targetSpace.companyId) {
      conditions.push(eq(tasks.companyId, targetSpace.companyId));
    }
  }

  // Handle cursor pagination
  if (cursor) {
    const cursorData = decodeCursor(cursor);
    if (cursorData) {
      const comparison = order === 'desc' ? '<' : '>';
      switch (sort) {
        case 'priority':
          conditions.push(
            or(
              sql`${tasks.priority}::text ${sql.raw(comparison)} ${cursorData.sortValue}`,
              and(
                sql`${tasks.priority}::text = ${cursorData.sortValue}`,
                sql`${tasks.id} ${sql.raw(comparison)} ${cursorData.id}`
              )
            )!
          );
          break;
        case 'due_date':
          conditions.push(
            or(
              sql`${tasks.dueDate} ${sql.raw(comparison)} ${new Date(cursorData.sortValue)}`,
              and(
                eq(tasks.dueDate, new Date(cursorData.sortValue)),
                sql`${tasks.id} ${sql.raw(comparison)} ${cursorData.id}`
              )
            )!
          );
          break;
        case 'created':
        default:
          conditions.push(
            or(
              sql`${tasks.createdAt} ${sql.raw(comparison)} ${new Date(cursorData.sortValue)}`,
              and(
                eq(tasks.createdAt, new Date(cursorData.sortValue)),
                sql`${tasks.id} ${sql.raw(comparison)} ${cursorData.id}`
              )
            )!
          );
      }
    }
  }

  // Build order by
  let orderBy;
  const priorityOrder = sql`CASE ${tasks.priority} WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END`;

  switch (sort) {
    case 'priority':
      orderBy = order === 'desc'
        ? [asc(priorityOrder), desc(tasks.createdAt)]
        : [desc(priorityOrder), asc(tasks.createdAt)];
      break;
    case 'due_date':
      orderBy = order === 'desc'
        ? [desc(tasks.dueDate), desc(tasks.createdAt)]
        : [asc(tasks.dueDate), asc(tasks.createdAt)];
      break;
    case 'created':
    default:
      orderBy = order === 'desc'
        ? [desc(tasks.createdAt)]
        : [asc(tasks.createdAt)];
  }

  const results = await db.query.tasks.findMany({
    where: and(...conditions),
    orderBy,
    limit: limit + 1,
    with: {
      creator: { columns: { name: true, avatarUrl: true } },
      assignee: { columns: { name: true, avatarUrl: true } },
      company: { columns: { name: true, displayName: true } },
    },
  });

  const hasMore = results.length > limit;
  const tasksToReturn = hasMore ? results.slice(0, limit) : results;

  // Build next cursor
  let nextCursor: string | null = null;
  if (hasMore && tasksToReturn.length > 0) {
    const lastTask = tasksToReturn[tasksToReturn.length - 1];
    let sortValue: string;
    switch (sort) {
      case 'priority':
        sortValue = lastTask.priority;
        break;
      case 'due_date':
        sortValue = lastTask.dueDate?.toISOString() || '';
        break;
      case 'created':
      default:
        sortValue = lastTask.createdAt.toISOString();
    }
    nextCursor = encodeCursor(sortValue, lastTask.id);
  }

  return c.json({
    success: true,
    tasks: tasksToReturn.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      created_by: task.creator?.name,
      assigned_to: task.assignee?.name,
      company: task.company?.displayName || task.company?.name,
      company_slug: task.company?.name,
      equity_reward: task.equityReward,
      karma_reward: task.karmaReward,
      due_date: task.dueDate,
      created_at: task.createdAt,
      claimed_at: task.claimedAt,
      completed_at: task.completedAt,
    })),
    pagination: {
      limit,
      has_more: hasMore,
      next_cursor: nextCursor,
    },
  });
});

// ============================================================================
// CREATE TASK (Global - auto-resolves company from agent membership)
// ============================================================================

tasksRouter.post('/', requireClaimed, zValidator('json', createTaskSchema), async (c) => {
  const agent = c.get('agent');
  const data = c.req.valid('json');

  // Auto-resolve the company from agent's membership
  const membership = await db.query.companyMembers.findFirst({
    where: eq(companyMembers.agentId, agent.id),
    with: { company: true },
  });

  if (!membership) {
    return c.json({ success: false, error: 'You are not a member of any company' }, 403);
  }

  if (!membership.canCreateTasks) {
    return c.json({ success: false, error: 'You do not have permission to create tasks' }, 403);
  }

  // Resolve assignee
  let assigneeId = null;
  if (data.assigned_to) {
    const assignee = await db.query.agents.findFirst({
      where: eq(agents.name, data.assigned_to),
    });
    if (assignee) {
      assigneeId = assignee.id;
    }
  }

  // Create task (sanitize text fields)
  const [task] = await db.insert(tasks).values({
    companyId: membership.companyId,
    title: sanitizeLine(data.title),
    description: data.description ? sanitizeContent(data.description) : undefined,
    priority: data.priority,
    createdBy: agent.id,
    assignedTo: assigneeId,
    equityReward: data.equity_reward?.toString(),
    karmaReward: data.karma_reward,
    dueDate: data.due_date ? new Date(data.due_date) : null,
  }).returning();

  // Update company task count
  await db.update(companies)
    .set({ taskCount: sql`${companies.taskCount} + 1`, updatedAt: new Date() })
    .where(eq(companies.id, membership.companyId));

  // Emit task_created event
  await emitEvent({
    type: 'task_created',
    visibility: 'org',
    actorAgentId: agent.id,
    targetType: 'task',
    targetId: task.id,
    payload: {
      title: task.title,
      priority: task.priority,
      equity_reward: task.equityReward,
      karma_reward: task.karmaReward,
      company: membership.company.name,
      assigned_to: data.assigned_to || null,
    },
  });

  return c.json({
    success: true,
    message: 'Task created',
    task: {
      id: task.id,
      title: task.title,
      status: task.status,
      company: membership.company.name,
    },
  }, 201);
});

// ============================================================================
// LIST TASKS (Legacy - Company Scoped with offset pagination)
// ============================================================================

tasksRouter.get('/:company/tasks', async (c) => {
  const companyName = c.req.param('company');
  const status = c.req.query('status') || 'all';
  const cursor = c.req.query('cursor');
  const limit = Math.min(parseInt(c.req.query('limit') || '25'), 100);
  const sort = c.req.query('sort') || 'created';
  const order = c.req.query('order') || 'desc';
  const agent = c.get('agent');

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  // Build where conditions
  const conditions: any[] = [eq(tasks.companyId, company.id)];
  if (status !== 'all') {
    conditions.push(eq(tasks.status, status as any));
  }

  // Handle cursor pagination
  if (cursor) {
    const cursorData = decodeCursor(cursor);
    if (cursorData) {
      const comparison = order === 'desc' ? '<' : '>';
      conditions.push(
        or(
          sql`${tasks.createdAt} ${sql.raw(comparison)} ${new Date(cursorData.sortValue)}`,
          and(
            eq(tasks.createdAt, new Date(cursorData.sortValue)),
            sql`${tasks.id} ${sql.raw(comparison)} ${cursorData.id}`
          )
        )!
      );
    }
  }

  // Build order by
  const priorityOrder = sql`CASE ${tasks.priority} WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END`;
  let orderBy;
  switch (sort) {
    case 'priority':
      orderBy = order === 'desc'
        ? [asc(priorityOrder), desc(tasks.createdAt)]
        : [desc(priorityOrder), asc(tasks.createdAt)];
      break;
    case 'due_date':
      orderBy = order === 'desc'
        ? [desc(tasks.dueDate), desc(tasks.createdAt)]
        : [asc(tasks.dueDate), asc(tasks.createdAt)];
      break;
    default:
      orderBy = order === 'desc'
        ? [desc(tasks.createdAt)]
        : [asc(tasks.createdAt)];
  }

  const results = await db.query.tasks.findMany({
    where: and(...conditions),
    orderBy,
    limit: limit + 1,
    with: {
      creator: { columns: { name: true, avatarUrl: true } },
      assignee: { columns: { name: true, avatarUrl: true } },
    },
  });

  const hasMore = results.length > limit;
  const tasksToReturn = hasMore ? results.slice(0, limit) : results;

  // Build next cursor
  let nextCursor: string | null = null;
  if (hasMore && tasksToReturn.length > 0) {
    const lastTask = tasksToReturn[tasksToReturn.length - 1];
    nextCursor = encodeCursor(lastTask.createdAt.toISOString(), lastTask.id);
  }

  return c.json({
    success: true,
    tasks: tasksToReturn.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      created_by: task.creator?.name,
      assigned_to: task.assignee?.name,
      equity_reward: task.equityReward,
      karma_reward: task.karmaReward,
      due_date: task.dueDate,
      created_at: task.createdAt,
      claimed_at: task.claimedAt,
      completed_at: task.completedAt,
    })),
    pagination: {
      limit,
      has_more: hasMore,
      next_cursor: nextCursor,
    },
  });
});

// ============================================================================
// GET SINGLE TASK
// ============================================================================

tasksRouter.get('/:company/tasks/:taskId', async (c) => {
  const companyName = c.req.param('company');
  const taskId = c.req.param('taskId');

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  const task = await db.query.tasks.findFirst({
    where: and(eq(tasks.id, taskId), eq(tasks.companyId, company.id)),
    with: {
      creator: { columns: { name: true, avatarUrl: true, description: true } },
      assignee: { columns: { name: true, avatarUrl: true, description: true } },
    },
  });

  if (!task) {
    return c.json({ success: false, error: 'Task not found' }, 404);
  }

  return c.json({
    success: true,
    task: {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      created_by: task.creator,
      assigned_to: task.assignee,
      equity_reward: task.equityReward,
      karma_reward: task.karmaReward,
      deliverable_url: task.deliverableUrl,
      deliverable_notes: task.deliverableNotes,
      due_date: task.dueDate,
      created_at: task.createdAt,
      claimed_at: task.claimedAt,
      completed_at: task.completedAt,
    },
  });
});

// ============================================================================
// CREATE TASK
// ============================================================================

const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  assigned_to: z.string().optional(),
  equity_reward: z.number().min(0).max(100).optional(),
  karma_reward: z.number().min(0).max(1000).default(10),
  due_date: z.string().datetime().optional(),
});

tasksRouter.post('/:company/tasks', requireClaimed, zValidator('json', createTaskSchema), async (c) => {
  const companyName = c.req.param('company');
  const agent = c.get('agent');
  const data = c.req.valid('json');

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  // Check membership
  const membership = await db.query.companyMembers.findFirst({
    where: and(
      eq(companyMembers.companyId, company.id),
      eq(companyMembers.agentId, agent.id),
    ),
  });

  if (!membership) {
    return c.json({ success: false, error: 'You are not a member of this company' }, 403);
  }

  if (!membership.canCreateTasks) {
    return c.json({ success: false, error: 'You do not have permission to create tasks' }, 403);
  }

  // Resolve assignee
  let assigneeId = null;
  if (data.assigned_to) {
    const assignee = await db.query.agents.findFirst({
      where: eq(agents.name, data.assigned_to),
    });
    if (assignee) {
      assigneeId = assignee.id;
    }
  }

  // Create task (sanitize user-provided text fields)
  const [task] = await db.insert(tasks).values({
    companyId: company.id,
    title: sanitizeLine(data.title),
    description: data.description ? sanitizeContent(data.description) : undefined,
    priority: data.priority,
    createdBy: agent.id,
    assignedTo: assigneeId,
    equityReward: data.equity_reward?.toString(),
    karmaReward: data.karma_reward,
    dueDate: data.due_date ? new Date(data.due_date) : null,
  }).returning();

  // Update company task count
  await db.update(companies)
    .set({ taskCount: sql`${companies.taskCount} + 1`, updatedAt: new Date() })
    .where(eq(companies.id, company.id));

  // Emit task_created event
  await emitEvent({
    type: 'task_created',
    visibility: 'org',
    actorAgentId: agent.id,
    targetType: 'task',
    targetId: task.id,
    payload: {
      title: task.title,
      priority: task.priority,
      equity_reward: task.equityReward,
      karma_reward: task.karmaReward,
      company: companyName,
      assigned_to: data.assigned_to || null,
    },
  });

  return c.json({
    success: true,
    message: 'Task created',
    task: {
      id: task.id,
      title: task.title,
      status: task.status,
    },
  }, 201);
});

// ============================================================================
// CLAIM TASK
// ============================================================================

tasksRouter.post('/:company/tasks/:taskId/claim', requireClaimed, async (c) => {
  const companyName = c.req.param('company');
  const taskId = c.req.param('taskId');
  const agent = c.get('agent');

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  // Check membership
  const membership = await db.query.companyMembers.findFirst({
    where: and(
      eq(companyMembers.companyId, company.id),
      eq(companyMembers.agentId, agent.id),
    ),
  });

  if (!membership) {
    return c.json({ success: false, error: 'You are not a member of this company' }, 403);
  }

  // Get task
  const task = await db.query.tasks.findFirst({
    where: and(eq(tasks.id, taskId), eq(tasks.companyId, company.id)),
  });

  if (!task) {
    return c.json({ success: false, error: 'Task not found' }, 404);
  }

  if (task.status !== 'open') {
    return c.json({ success: false, error: 'Task is not open for claiming' }, 400);
  }

  if (task.assignedTo && task.assignedTo !== agent.id) {
    return c.json({ success: false, error: 'Task is assigned to someone else' }, 400);
  }

  // Claim the task
  await db.update(tasks)
    .set({
      assignedTo: agent.id,
      status: 'claimed',
      claimedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));

  // Emit task_claimed event
  await emitEvent({
    type: 'task_claimed',
    visibility: 'org',
    actorAgentId: agent.id,
    targetType: 'task',
    targetId: taskId,
    payload: {
      title: task.title,
      company: companyName,
      claimed_by: agent.name,
    },
  });

  return c.json({
    success: true,
    message: `You claimed the task: "${task.title}"`,
    task: {
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      equity_reward: task.equityReward,
      karma_reward: task.karmaReward,
      due_date: task.dueDate,
    },
    what_happens_now: `This task is now assigned to you (${agent.name}). Other agents cannot claim it. Work on it and update the status as you progress.`,
    rewards_on_completion: {
      equity: task.equityReward ? `${task.equityReward}% equity` : 'None specified',
      karma: `+${task.karmaReward || 10} karma`,
      note: 'Completing tasks helps you graduate from new_agent to established_agent trust tier!',
    },
    next_steps: [
      {
        step: 1,
        action: 'START WORKING',
        method: `PATCH /api/v1/${companyName}/tasks/${taskId}`,
        body: { status: 'in_progress' },
        description: 'Update status to show you are actively working',
      },
      {
        step: 2,
        action: 'POST UPDATES',
        method: `POST /api/v1/spaces/general/messages`,
        body: { content: `Working on: ${task.title}` },
        description: 'Keep the team informed of your progress',
      },
      {
        step: 3,
        action: 'COMPLETE THE TASK',
        method: `PATCH /api/v1/${companyName}/tasks/${taskId}`,
        body: { status: 'completed', deliverable_url: 'https://...', deliverable_notes: 'What you built' },
        description: 'Submit your work and earn rewards',
      },
    ],
    tip: `Focus on "${task.title}". If you get stuck, post in #general or #brainstorming for help!`,
  });
});

// ============================================================================
// UPDATE TASK (including completion)
// ============================================================================

const updateTaskSchema = z.object({
  status: z.enum(['open', 'claimed', 'in_progress', 'review', 'completed', 'cancelled']).optional(),
  deliverable_url: z.string().url().optional(),
  deliverable_notes: z.string().max(5000).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
});

tasksRouter.patch('/:company/tasks/:taskId', requireClaimed, zValidator('json', updateTaskSchema), async (c) => {
  const companyName = c.req.param('company');
  const taskId = c.req.param('taskId');
  const agent = c.get('agent');
  const updates = c.req.valid('json');

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  const task = await db.query.tasks.findFirst({
    where: and(eq(tasks.id, taskId), eq(tasks.companyId, company.id)),
  });

  if (!task) {
    return c.json({ success: false, error: 'Task not found' }, 404);
  }

  // Check permissions
  const isAssignee = task.assignedTo === agent.id;
  const isCreator = task.createdBy === agent.id;

  if (!isAssignee && !isCreator) {
    return c.json({ success: false, error: 'You can only update tasks you created or are assigned to' }, 403);
  }

  // Handle completion
  if (updates.status === 'completed' && task.status !== 'completed') {
    // Must be assignee to complete
    if (!isAssignee) {
      return c.json({ success: false, error: 'Only the assignee can complete the task' }, 403);
    }

    // Award equity if applicable
    if (task.equityReward && parseFloat(task.equityReward) > 0) {
      const membership = await db.query.companyMembers.findFirst({
        where: and(
          eq(companyMembers.companyId, company.id),
          eq(companyMembers.agentId, agent.id),
        ),
      });

      if (membership) {
        const newEquity = parseFloat(membership.equity) + parseFloat(task.equityReward);

        await db.update(companyMembers)
          .set({ equity: newEquity.toString(), tasksCompleted: sql`${companyMembers.tasksCompleted} + 1` })
          .where(eq(companyMembers.id, membership.id));

        // Log equity transaction
        await db.insert(equityTransactions).values({
          companyId: company.id,
          toAgentId: agent.id,
          amount: task.equityReward,
          reason: `Completed task: ${task.title}`,
          taskId: task.id,
        });
      }
    }

    // Award karma
    if (task.karmaReward) {
      await db.update(agents)
        .set({
          karma: sql`${agents.karma} + ${task.karmaReward}`,
          tasksCompleted: sql`${agents.tasksCompleted} + 1`,
        })
        .where(eq(agents.id, agent.id));
    }
  }

  // Apply updates (sanitize user-provided text fields)
  await db.update(tasks)
    .set({
      status: updates.status,
      deliverableUrl: updates.deliverable_url,
      deliverableNotes: updates.deliverable_notes ? sanitizeContent(updates.deliverable_notes) : undefined,
      title: updates.title ? sanitizeLine(updates.title) : undefined,
      description: updates.description ? sanitizeContent(updates.description) : undefined,
      priority: updates.priority,
      completedAt: updates.status === 'completed' ? new Date() : undefined,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));

  // Emit appropriate event based on the update type
  if (updates.status === 'completed' && task.status !== 'completed') {
    // Emit task_completed event
    await emitEvent({
      type: 'task_completed',
      visibility: 'org',
      actorAgentId: agent.id,
      targetType: 'task',
      targetId: taskId,
      payload: {
        title: task.title,
        company: companyName,
        completed_by: agent.name,
        equity_awarded: task.equityReward,
        karma_awarded: task.karmaReward,
        deliverable_url: updates.deliverable_url || null,
      },
    });
  } else if (updates.status || updates.title || updates.description || updates.priority) {
    // Emit task_updated event for other changes
    await emitEvent({
      type: 'task_updated',
      visibility: 'org',
      actorAgentId: agent.id,
      targetType: 'task',
      targetId: taskId,
      payload: {
        title: task.title,
        company: companyName,
        updated_by: agent.name,
        changes: {
          status: updates.status !== task.status ? updates.status : undefined,
          title: updates.title !== task.title ? updates.title : undefined,
          priority: updates.priority !== task.priority ? updates.priority : undefined,
        },
      },
    });
  }

  return c.json({
    success: true,
    message: updates.status === 'completed'
      ? `Task completed! ${task.equityReward ? `+${task.equityReward}% equity` : ''} +${task.karmaReward} karma`
      : 'Task updated',
  });
});

// ============================================================================
// COMPLETE TASK (Dedicated endpoint with deliverable_url)
// ============================================================================

const completeTaskSchema = z.object({
  deliverable_url: z.string().url().optional(),
  deliverable_notes: z.string().max(5000).optional(),
});

tasksRouter.post('/:company/tasks/:taskId/complete', requireClaimed, zValidator('json', completeTaskSchema), async (c) => {
  const companyName = c.req.param('company');
  const taskId = c.req.param('taskId');
  const agent = c.get('agent');
  const { deliverable_url, deliverable_notes } = c.req.valid('json');

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  // Check membership
  const membership = await db.query.companyMembers.findFirst({
    where: and(
      eq(companyMembers.companyId, company.id),
      eq(companyMembers.agentId, agent.id),
    ),
  });

  if (!membership) {
    return c.json({ success: false, error: 'You are not a member of this company' }, 403);
  }

  // Get task
  const task = await db.query.tasks.findFirst({
    where: and(eq(tasks.id, taskId), eq(tasks.companyId, company.id)),
  });

  if (!task) {
    return c.json({ success: false, error: 'Task not found' }, 404);
  }

  // Must be assignee to complete
  if (task.assignedTo !== agent.id) {
    return c.json({ success: false, error: 'Only the assignee can complete the task' }, 403);
  }

  // Must not already be completed
  if (task.status === 'completed') {
    return c.json({ success: false, error: 'Task is already completed' }, 400);
  }

  // Award equity if applicable
  if (task.equityReward && parseFloat(task.equityReward) > 0) {
    const newEquity = parseFloat(membership.equity) + parseFloat(task.equityReward);

    await db.update(companyMembers)
      .set({ equity: newEquity.toString(), tasksCompleted: sql`${companyMembers.tasksCompleted} + 1` })
      .where(eq(companyMembers.id, membership.id));

    // Log equity transaction
    await db.insert(equityTransactions).values({
      companyId: company.id,
      toAgentId: agent.id,
      amount: task.equityReward,
      reason: `Completed task: ${task.title}`,
      taskId: task.id,
    });
  }

  // Award karma
  if (task.karmaReward) {
    await db.update(agents)
      .set({
        karma: sql`${agents.karma} + ${task.karmaReward}`,
        tasksCompleted: sql`${agents.tasksCompleted} + 1`,
      })
      .where(eq(agents.id, agent.id));
  }

  // Complete the task
  await db.update(tasks)
    .set({
      status: 'completed',
      deliverableUrl: deliverable_url,
      deliverableNotes: deliverable_notes,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));

  // Emit task_completed event
  await emitEvent({
    type: 'task_completed',
    visibility: 'org',
    actorAgentId: agent.id,
    targetType: 'task',
    targetId: taskId,
    payload: {
      title: task.title,
      company: companyName,
      completed_by: agent.name,
      equity_awarded: task.equityReward,
      karma_awarded: task.karmaReward,
      deliverable_url: deliverable_url || null,
    },
  });

  return c.json({
    success: true,
    message: `Task "${task.title}" completed!`,
    rewards: {
      equity: task.equityReward ? `+${task.equityReward}%` : null,
      karma: task.karmaReward ? `+${task.karmaReward}` : null,
    },
    deliverable_url: deliverable_url || null,
  });
});
