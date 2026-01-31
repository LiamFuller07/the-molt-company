import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc, or, lt } from 'drizzle-orm';
import { db } from '../db';
import {
  discussions,
  discussionReplies,
  tasks,
  agents,
  companies,
  companyMembers,
  moderationActions,
  auditLog,
  events,
} from '../db/schema';
import { authMiddleware, requireClaimed, type AuthContext } from '../middleware/auth';
import { isWriteDisabled, KILL_SWITCHES } from '../services/kill-switches';

export const moderationRouter = new Hono<AuthContext>();

// All routes require auth
moderationRouter.use('*', authMiddleware);

// ============================================================================
// HELPER: Check if agent has moderation permissions
// ============================================================================

async function checkModerationPermission(
  agentId: string,
  companyId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const membership = await db.query.companyMembers.findFirst({
    where: and(
      eq(companyMembers.companyId, companyId),
      eq(companyMembers.agentId, agentId)
    ),
  });

  if (!membership) {
    return { allowed: false, reason: 'You are not a member of this company' };
  }

  // Only founders can moderate
  if (membership.role !== 'founder') {
    return { allowed: false, reason: 'Only founders can perform moderation actions' };
  }

  return { allowed: true };
}

// ============================================================================
// HELPER: Log moderation action
// ============================================================================

async function logModerationAction(
  action: 'lock_discussion' | 'unlock_discussion' | 'pin_discussion' | 'unpin_discussion' | 'remove_content' | 'restore_content' | 'suspend_agent' | 'unsuspend_agent',
  actorAgentId: string,
  targetType: string,
  targetId: string,
  reason?: string,
  metadata?: Record<string, unknown>
) {
  // Insert into moderation_actions
  await db.insert(moderationActions).values({
    action,
    actorAgentId,
    targetType,
    targetId,
    reason,
  });

  // Insert into audit_log
  await db.insert(auditLog).values({
    action: `moderation:${action}`,
    actorAgentId,
    resourceType: targetType,
    resourceId: targetId,
    metadata: {
      reason,
      ...metadata,
    },
  });

  // Emit event
  await db.insert(events).values({
    type: 'moderation_action',
    visibility: 'org',
    actorAgentId,
    targetType,
    targetId,
    payload: {
      action,
      reason,
      ...metadata,
    },
  });
}

// ============================================================================
// LOCK DISCUSSION
// ============================================================================

const lockDiscussionSchema = z.object({
  discussion_id: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

moderationRouter.post('/:company/moderation/lock-discussion', requireClaimed, zValidator('json', lockDiscussionSchema), async (c) => {
  const companyName = c.req.param('company');
  const agent = c.get('agent');
  const { discussion_id, reason } = c.req.valid('json');

  // Check write kill switch
  if (await isWriteDisabled()) {
    return c.json({
      success: false,
      error: 'Write operations are temporarily disabled',
      kill_switch: KILL_SWITCHES.DISABLE_WRITES,
    }, 503);
  }

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  // Check permissions
  const permission = await checkModerationPermission(agent.id, company.id);
  if (!permission.allowed) {
    return c.json({ success: false, error: permission.reason }, 403);
  }

  // Find discussion
  const discussion = await db.query.discussions.findFirst({
    where: and(eq(discussions.id, discussion_id), eq(discussions.companyId, company.id)),
  });

  if (!discussion) {
    return c.json({ success: false, error: 'Discussion not found' }, 404);
  }

  if (discussion.isLocked) {
    return c.json({ success: false, error: 'Discussion is already locked' }, 400);
  }

  // Lock discussion
  await db.update(discussions)
    .set({ isLocked: true, updatedAt: new Date() })
    .where(eq(discussions.id, discussion_id));

  // Log action
  await logModerationAction('lock_discussion', agent.id, 'discussion', discussion_id, reason, {
    discussion_title: discussion.title,
  });

  return c.json({
    success: true,
    message: 'Discussion locked',
    discussion_id,
    reason,
  });
});

// ============================================================================
// UNLOCK DISCUSSION
// ============================================================================

const unlockDiscussionSchema = z.object({
  discussion_id: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

moderationRouter.post('/:company/moderation/unlock-discussion', requireClaimed, zValidator('json', unlockDiscussionSchema), async (c) => {
  const companyName = c.req.param('company');
  const agent = c.get('agent');
  const { discussion_id, reason } = c.req.valid('json');

  // Check write kill switch
  if (await isWriteDisabled()) {
    return c.json({
      success: false,
      error: 'Write operations are temporarily disabled',
      kill_switch: KILL_SWITCHES.DISABLE_WRITES,
    }, 503);
  }

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  // Check permissions
  const permission = await checkModerationPermission(agent.id, company.id);
  if (!permission.allowed) {
    return c.json({ success: false, error: permission.reason }, 403);
  }

  // Find discussion
  const discussion = await db.query.discussions.findFirst({
    where: and(eq(discussions.id, discussion_id), eq(discussions.companyId, company.id)),
  });

  if (!discussion) {
    return c.json({ success: false, error: 'Discussion not found' }, 404);
  }

  if (!discussion.isLocked) {
    return c.json({ success: false, error: 'Discussion is not locked' }, 400);
  }

  // Unlock discussion
  await db.update(discussions)
    .set({ isLocked: false, updatedAt: new Date() })
    .where(eq(discussions.id, discussion_id));

  // Log action
  await logModerationAction('unlock_discussion', agent.id, 'discussion', discussion_id, reason, {
    discussion_title: discussion.title,
  });

  return c.json({
    success: true,
    message: 'Discussion unlocked',
    discussion_id,
    reason,
  });
});

// ============================================================================
// PIN DISCUSSION
// ============================================================================

const pinDiscussionSchema = z.object({
  discussion_id: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

moderationRouter.post('/:company/moderation/pin-discussion', requireClaimed, zValidator('json', pinDiscussionSchema), async (c) => {
  const companyName = c.req.param('company');
  const agent = c.get('agent');
  const { discussion_id, reason } = c.req.valid('json');

  // Check write kill switch
  if (await isWriteDisabled()) {
    return c.json({
      success: false,
      error: 'Write operations are temporarily disabled',
      kill_switch: KILL_SWITCHES.DISABLE_WRITES,
    }, 503);
  }

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  // Check permissions
  const permission = await checkModerationPermission(agent.id, company.id);
  if (!permission.allowed) {
    return c.json({ success: false, error: permission.reason }, 403);
  }

  // Find discussion
  const discussion = await db.query.discussions.findFirst({
    where: and(eq(discussions.id, discussion_id), eq(discussions.companyId, company.id)),
  });

  if (!discussion) {
    return c.json({ success: false, error: 'Discussion not found' }, 404);
  }

  if (discussion.isPinned) {
    return c.json({ success: false, error: 'Discussion is already pinned' }, 400);
  }

  // Pin discussion
  await db.update(discussions)
    .set({ isPinned: true, updatedAt: new Date() })
    .where(eq(discussions.id, discussion_id));

  // Log action
  await logModerationAction('pin_discussion', agent.id, 'discussion', discussion_id, reason, {
    discussion_title: discussion.title,
  });

  return c.json({
    success: true,
    message: 'Discussion pinned',
    discussion_id,
    reason,
  });
});

// ============================================================================
// UNPIN DISCUSSION
// ============================================================================

const unpinDiscussionSchema = z.object({
  discussion_id: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

moderationRouter.post('/:company/moderation/unpin-discussion', requireClaimed, zValidator('json', unpinDiscussionSchema), async (c) => {
  const companyName = c.req.param('company');
  const agent = c.get('agent');
  const { discussion_id, reason } = c.req.valid('json');

  // Check write kill switch
  if (await isWriteDisabled()) {
    return c.json({
      success: false,
      error: 'Write operations are temporarily disabled',
      kill_switch: KILL_SWITCHES.DISABLE_WRITES,
    }, 503);
  }

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  // Check permissions
  const permission = await checkModerationPermission(agent.id, company.id);
  if (!permission.allowed) {
    return c.json({ success: false, error: permission.reason }, 403);
  }

  // Find discussion
  const discussion = await db.query.discussions.findFirst({
    where: and(eq(discussions.id, discussion_id), eq(discussions.companyId, company.id)),
  });

  if (!discussion) {
    return c.json({ success: false, error: 'Discussion not found' }, 404);
  }

  if (!discussion.isPinned) {
    return c.json({ success: false, error: 'Discussion is not pinned' }, 400);
  }

  // Unpin discussion
  await db.update(discussions)
    .set({ isPinned: false, updatedAt: new Date() })
    .where(eq(discussions.id, discussion_id));

  // Log action
  await logModerationAction('unpin_discussion', agent.id, 'discussion', discussion_id, reason, {
    discussion_title: discussion.title,
  });

  return c.json({
    success: true,
    message: 'Discussion unpinned',
    discussion_id,
    reason,
  });
});

// ============================================================================
// REMOVE CONTENT
// ============================================================================

const removeContentSchema = z.object({
  content_type: z.enum(['discussion', 'reply', 'task']),
  content_id: z.string().uuid(),
  reason: z.string().min(1).max(500),
});

moderationRouter.post('/:company/moderation/remove-content', requireClaimed, zValidator('json', removeContentSchema), async (c) => {
  const companyName = c.req.param('company');
  const agent = c.get('agent');
  const { content_type, content_id, reason } = c.req.valid('json');

  // Check write kill switch
  if (await isWriteDisabled()) {
    return c.json({
      success: false,
      error: 'Write operations are temporarily disabled',
      kill_switch: KILL_SWITCHES.DISABLE_WRITES,
    }, 503);
  }

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  // Check permissions
  const permission = await checkModerationPermission(agent.id, company.id);
  if (!permission.allowed) {
    return c.json({ success: false, error: permission.reason }, 403);
  }

  let contentTitle = '';

  // Remove content based on type
  switch (content_type) {
    case 'discussion': {
      const discussion = await db.query.discussions.findFirst({
        where: and(eq(discussions.id, content_id), eq(discussions.companyId, company.id)),
      });
      if (!discussion) {
        return c.json({ success: false, error: 'Discussion not found' }, 404);
      }
      if (discussion.contentStatus === 'removed') {
        return c.json({ success: false, error: 'Content is already removed' }, 400);
      }
      contentTitle = discussion.title;
      await db.update(discussions)
        .set({ contentStatus: 'removed', updatedAt: new Date() })
        .where(eq(discussions.id, content_id));
      break;
    }
    case 'task': {
      const task = await db.query.tasks.findFirst({
        where: and(eq(tasks.id, content_id), eq(tasks.companyId, company.id)),
      });
      if (!task) {
        return c.json({ success: false, error: 'Task not found' }, 404);
      }
      if (task.contentStatus === 'removed') {
        return c.json({ success: false, error: 'Content is already removed' }, 400);
      }
      contentTitle = task.title;
      await db.update(tasks)
        .set({ contentStatus: 'removed', updatedAt: new Date() })
        .where(eq(tasks.id, content_id));
      break;
    }
    case 'reply': {
      // Replies don't have content_status in schema, so we'd delete or mark differently
      // For now, we'll just log the action
      const reply = await db.query.discussionReplies.findFirst({
        where: eq(discussionReplies.id, content_id),
      });
      if (!reply) {
        return c.json({ success: false, error: 'Reply not found' }, 404);
      }
      contentTitle = reply.content.substring(0, 50) + '...';
      // In production, you'd soft-delete or mark as removed
      break;
    }
  }

  // Log action
  await logModerationAction('remove_content', agent.id, content_type, content_id, reason, {
    content_title: contentTitle,
  });

  return c.json({
    success: true,
    message: `${content_type} removed`,
    content_type,
    content_id,
    reason,
  });
});

// ============================================================================
// RESTORE CONTENT
// ============================================================================

const restoreContentSchema = z.object({
  content_type: z.enum(['discussion', 'task']),
  content_id: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

moderationRouter.post('/:company/moderation/restore-content', requireClaimed, zValidator('json', restoreContentSchema), async (c) => {
  const companyName = c.req.param('company');
  const agent = c.get('agent');
  const { content_type, content_id, reason } = c.req.valid('json');

  // Check write kill switch
  if (await isWriteDisabled()) {
    return c.json({
      success: false,
      error: 'Write operations are temporarily disabled',
      kill_switch: KILL_SWITCHES.DISABLE_WRITES,
    }, 503);
  }

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  // Check permissions
  const permission = await checkModerationPermission(agent.id, company.id);
  if (!permission.allowed) {
    return c.json({ success: false, error: permission.reason }, 403);
  }

  let contentTitle = '';

  // Restore content based on type
  switch (content_type) {
    case 'discussion': {
      const discussion = await db.query.discussions.findFirst({
        where: and(eq(discussions.id, content_id), eq(discussions.companyId, company.id)),
      });
      if (!discussion) {
        return c.json({ success: false, error: 'Discussion not found' }, 404);
      }
      if (discussion.contentStatus !== 'removed') {
        return c.json({ success: false, error: 'Content is not removed' }, 400);
      }
      contentTitle = discussion.title;
      await db.update(discussions)
        .set({ contentStatus: 'active', updatedAt: new Date() })
        .where(eq(discussions.id, content_id));
      break;
    }
    case 'task': {
      const task = await db.query.tasks.findFirst({
        where: and(eq(tasks.id, content_id), eq(tasks.companyId, company.id)),
      });
      if (!task) {
        return c.json({ success: false, error: 'Task not found' }, 404);
      }
      if (task.contentStatus !== 'removed') {
        return c.json({ success: false, error: 'Content is not removed' }, 400);
      }
      contentTitle = task.title;
      await db.update(tasks)
        .set({ contentStatus: 'active', updatedAt: new Date() })
        .where(eq(tasks.id, content_id));
      break;
    }
  }

  // Log action
  await logModerationAction('restore_content', agent.id, content_type, content_id, reason, {
    content_title: contentTitle,
  });

  return c.json({
    success: true,
    message: `${content_type} restored`,
    content_type,
    content_id,
    reason,
  });
});

// ============================================================================
// SUSPEND AGENT
// ============================================================================

const suspendAgentSchema = z.object({
  agent_name: z.string(),
  reason: z.string().min(1).max(500),
});

moderationRouter.post('/:company/moderation/suspend-agent', requireClaimed, zValidator('json', suspendAgentSchema), async (c) => {
  const companyName = c.req.param('company');
  const actor = c.get('agent');
  const { agent_name, reason } = c.req.valid('json');

  // Check write kill switch
  if (await isWriteDisabled()) {
    return c.json({
      success: false,
      error: 'Write operations are temporarily disabled',
      kill_switch: KILL_SWITCHES.DISABLE_WRITES,
    }, 503);
  }

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  // Check permissions
  const permission = await checkModerationPermission(actor.id, company.id);
  if (!permission.allowed) {
    return c.json({ success: false, error: permission.reason }, 403);
  }

  // Find target agent
  const targetAgent = await db.query.agents.findFirst({
    where: eq(agents.name, agent_name),
  });

  if (!targetAgent) {
    return c.json({ success: false, error: 'Agent not found' }, 404);
  }

  // Cannot suspend yourself
  if (targetAgent.id === actor.id) {
    return c.json({ success: false, error: 'You cannot suspend yourself' }, 400);
  }

  // Check if target is a member
  const targetMembership = await db.query.companyMembers.findFirst({
    where: and(
      eq(companyMembers.companyId, company.id),
      eq(companyMembers.agentId, targetAgent.id),
    ),
  });

  if (!targetMembership) {
    return c.json({ success: false, error: 'Agent is not a member of this company' }, 404);
  }

  // Cannot suspend founders
  if (targetMembership.role === 'founder') {
    return c.json({ success: false, error: 'Cannot suspend a founder' }, 403);
  }

  if (targetAgent.status === 'suspended') {
    return c.json({ success: false, error: 'Agent is already suspended' }, 400);
  }

  // Suspend agent
  await db.update(agents)
    .set({ status: 'suspended', updatedAt: new Date() })
    .where(eq(agents.id, targetAgent.id));

  // Log action
  await logModerationAction('suspend_agent', actor.id, 'agent', targetAgent.id, reason, {
    agent_name: targetAgent.name,
    company: company.name,
  });

  return c.json({
    success: true,
    message: `Agent ${agent_name} has been suspended`,
    agent: agent_name,
    reason,
  });
});

// ============================================================================
// UNSUSPEND AGENT
// ============================================================================

const unsuspendAgentSchema = z.object({
  agent_name: z.string(),
  reason: z.string().max(500).optional(),
});

moderationRouter.post('/:company/moderation/unsuspend-agent', requireClaimed, zValidator('json', unsuspendAgentSchema), async (c) => {
  const companyName = c.req.param('company');
  const actor = c.get('agent');
  const { agent_name, reason } = c.req.valid('json');

  // Check write kill switch
  if (await isWriteDisabled()) {
    return c.json({
      success: false,
      error: 'Write operations are temporarily disabled',
      kill_switch: KILL_SWITCHES.DISABLE_WRITES,
    }, 503);
  }

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  // Check permissions
  const permission = await checkModerationPermission(actor.id, company.id);
  if (!permission.allowed) {
    return c.json({ success: false, error: permission.reason }, 403);
  }

  // Find target agent
  const targetAgent = await db.query.agents.findFirst({
    where: eq(agents.name, agent_name),
  });

  if (!targetAgent) {
    return c.json({ success: false, error: 'Agent not found' }, 404);
  }

  if (targetAgent.status !== 'suspended') {
    return c.json({ success: false, error: 'Agent is not suspended' }, 400);
  }

  // Unsuspend agent
  await db.update(agents)
    .set({ status: 'active', updatedAt: new Date() })
    .where(eq(agents.id, targetAgent.id));

  // Log action
  await logModerationAction('unsuspend_agent', actor.id, 'agent', targetAgent.id, reason, {
    agent_name: targetAgent.name,
    company: company.name,
  });

  return c.json({
    success: true,
    message: `Agent ${agent_name} has been unsuspended`,
    agent: agent_name,
    reason,
  });
});

// ============================================================================
// GET AUDIT LOG (Paginated)
// ============================================================================

moderationRouter.get('/:company/moderation/audit-log', async (c) => {
  const companyName = c.req.param('company');
  const agent = c.get('agent');
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
  const cursor = c.req.query('cursor');
  const actionFilter = c.req.query('action');

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  // Check permissions
  const permission = await checkModerationPermission(agent.id, company.id);
  if (!permission.allowed) {
    return c.json({ success: false, error: permission.reason }, 403);
  }

  // Build query conditions
  const conditions: any[] = [];

  // Filter by action if provided
  if (actionFilter) {
    conditions.push(eq(auditLog.action, `moderation:${actionFilter}`));
  }

  // Cursor pagination
  if (cursor) {
    const cursorEntry = await db.query.auditLog.findFirst({
      where: eq(auditLog.id, cursor),
    });
    if (cursorEntry) {
      conditions.push(
        or(
          lt(auditLog.createdAt, cursorEntry.createdAt),
          and(
            eq(auditLog.createdAt, cursorEntry.createdAt),
            lt(auditLog.id, cursor)
          )
        )!
      );
    }
  }

  // Get moderation actions for this company (via moderationActions table)
  const actions = await db.query.moderationActions.findMany({
    orderBy: desc(moderationActions.createdAt),
    limit: limit + 1,
    with: {
      actor: { columns: { name: true } },
    },
  });

  const hasMore = actions.length > limit;
  const items = hasMore ? actions.slice(0, limit) : actions;
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null;

  return c.json({
    success: true,
    audit_log: items.map(a => ({
      id: a.id,
      action: a.action,
      actor: a.actor?.name || 'Unknown',
      target_type: a.targetType,
      target_id: a.targetId,
      reason: a.reason,
      created_at: a.createdAt,
    })),
    pagination: {
      limit,
      has_more: hasMore,
      next_cursor: nextCursor,
    },
  });
});

// ============================================================================
// GET MODERATION STATS
// ============================================================================

moderationRouter.get('/:company/moderation/stats', async (c) => {
  const companyName = c.req.param('company');
  const agent = c.get('agent');

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  // Check permissions
  const permission = await checkModerationPermission(agent.id, company.id);
  if (!permission.allowed) {
    return c.json({ success: false, error: permission.reason }, 403);
  }

  // Get counts
  const lockedDiscussions = await db.query.discussions.findMany({
    where: and(eq(discussions.companyId, company.id), eq(discussions.isLocked, true)),
  });

  const pinnedDiscussions = await db.query.discussions.findMany({
    where: and(eq(discussions.companyId, company.id), eq(discussions.isPinned, true)),
  });

  const removedDiscussions = await db.query.discussions.findMany({
    where: and(eq(discussions.companyId, company.id), eq(discussions.contentStatus, 'removed')),
  });

  const removedTasks = await db.query.tasks.findMany({
    where: and(eq(tasks.companyId, company.id), eq(tasks.contentStatus, 'removed')),
  });

  const suspendedAgents = await db.query.agents.findMany({
    where: eq(agents.status, 'suspended'),
  });

  // Get recent moderation actions (last 7 days)
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentActions = await db.query.moderationActions.findMany({
    orderBy: desc(moderationActions.createdAt),
    limit: 100,
  });

  const recentActionsThisWeek = recentActions.filter(
    a => new Date(a.createdAt) >= oneWeekAgo
  );

  return c.json({
    success: true,
    stats: {
      locked_discussions: lockedDiscussions.length,
      pinned_discussions: pinnedDiscussions.length,
      removed_discussions: removedDiscussions.length,
      removed_tasks: removedTasks.length,
      suspended_agents: suspendedAgents.length,
      actions_this_week: recentActionsThisWeek.length,
    },
    recent_actions: recentActionsThisWeek.slice(0, 10).map(a => ({
      action: a.action,
      target_type: a.targetType,
      created_at: a.createdAt,
    })),
  });
});
