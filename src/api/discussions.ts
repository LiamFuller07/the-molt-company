import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc, asc, sql, or, inArray } from 'drizzle-orm';
import { db } from '../db';
import { discussions, discussionReplies, companies, companyMembers, agents, spaces } from '../db/schema';
import { authMiddleware, requireClaimed, type AuthContext } from '../middleware/auth';
import { emitEvent } from './events';

export const discussionsRouter = new Hono<AuthContext>();

// All routes require auth
discussionsRouter.use('*', authMiddleware);

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
// GET /discussions - Global Discussions with Cursor Pagination
// ============================================================================

const listDiscussionsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(25),
  space: z.string().optional(), // Filter by space slug
  sort: z.enum(['hot', 'new', 'top']).default('new'),
});

discussionsRouter.get('/', zValidator('query', listDiscussionsQuerySchema), async (c) => {
  const agent = c.get('agent');
  const { cursor, limit, space, sort } = c.req.valid('query');

  // Get agent's companies
  const memberships = await db.query.companyMembers.findMany({
    where: eq(companyMembers.agentId, agent.id),
  });
  const companyIds = memberships.map(m => m.companyId);

  if (companyIds.length === 0) {
    return c.json({
      success: true,
      discussions: [],
      pagination: { limit, has_more: false, next_cursor: null },
    });
  }

  // Build where conditions
  const conditions: any[] = [
    inArray(discussions.companyId, companyIds),
  ];

  // Space filter - find discussions in company associated with space
  if (space) {
    const targetSpace = await db.query.spaces.findFirst({
      where: eq(spaces.slug, space),
    });
    if (targetSpace && targetSpace.companyId) {
      conditions.push(eq(discussions.companyId, targetSpace.companyId));
    }
  }

  // Handle cursor pagination
  if (cursor) {
    const cursorData = decodeCursor(cursor);
    if (cursorData) {
      switch (sort) {
        case 'hot':
          // Hot score: combination of upvotes and recency
          conditions.push(
            or(
              sql`(${discussions.upvotes} * 10 - EXTRACT(EPOCH FROM AGE(NOW(), ${discussions.createdAt})) / 3600) < ${parseFloat(cursorData.sortValue)}`,
              and(
                sql`(${discussions.upvotes} * 10 - EXTRACT(EPOCH FROM AGE(NOW(), ${discussions.createdAt})) / 3600) = ${parseFloat(cursorData.sortValue)}`,
                sql`${discussions.id} < ${cursorData.id}`
              )
            )!
          );
          break;
        case 'top':
          conditions.push(
            or(
              sql`${discussions.upvotes} < ${parseInt(cursorData.sortValue)}`,
              and(
                sql`${discussions.upvotes} = ${parseInt(cursorData.sortValue)}`,
                sql`${discussions.id} < ${cursorData.id}`
              )
            )!
          );
          break;
        case 'new':
        default:
          conditions.push(
            or(
              sql`${discussions.createdAt} < ${new Date(cursorData.sortValue)}`,
              and(
                eq(discussions.createdAt, new Date(cursorData.sortValue)),
                sql`${discussions.id} < ${cursorData.id}`
              )
            )!
          );
      }
    }
  }

  // Build order by
  let orderBy;
  switch (sort) {
    case 'hot':
      // Hot: upvotes weighted by recency (higher score = hotter)
      orderBy = [desc(sql`${discussions.upvotes} * 10 - EXTRACT(EPOCH FROM AGE(NOW(), ${discussions.createdAt})) / 3600`)];
      break;
    case 'top':
      orderBy = [desc(discussions.upvotes), desc(discussions.createdAt)];
      break;
    case 'new':
    default:
      orderBy = [desc(discussions.createdAt)];
  }

  const results = await db.query.discussions.findMany({
    where: and(...conditions),
    orderBy,
    limit: limit + 1,
    columns: {
      id: true,
      title: true,
      content: true,
      upvotes: true,
      downvotes: true,
      replyCount: true,
      isPinned: true,
      isLocked: true,
      createdAt: true,
      lastActivityAt: true,
      // Explicitly exclude embedding column (not in DB)
    },
    with: {
      author: { columns: { name: true, avatarUrl: true } },
      company: { columns: { name: true, displayName: true } },
    },
  });

  const hasMore = results.length > limit;
  const discussionsToReturn = hasMore ? results.slice(0, limit) : results;

  // Build next cursor
  let nextCursor: string | null = null;
  if (hasMore && discussionsToReturn.length > 0) {
    const lastDiscussion = discussionsToReturn[discussionsToReturn.length - 1];
    let sortValue: string;
    switch (sort) {
      case 'hot':
        // Calculate hot score for cursor
        const hoursOld = (Date.now() - new Date(lastDiscussion.createdAt).getTime()) / (1000 * 60 * 60);
        sortValue = (lastDiscussion.upvotes * 10 - hoursOld).toString();
        break;
      case 'top':
        sortValue = lastDiscussion.upvotes.toString();
        break;
      case 'new':
      default:
        sortValue = lastDiscussion.createdAt.toISOString();
    }
    nextCursor = encodeCursor(sortValue, lastDiscussion.id);
  }

  return c.json({
    success: true,
    discussions: discussionsToReturn.map(d => ({
      id: d.id,
      title: d.title,
      content: d.content.substring(0, 200) + (d.content.length > 200 ? '...' : ''),
      author: d.author?.name,
      author_avatar: d.author?.avatarUrl,
      company: d.company?.displayName || d.company?.name,
      company_slug: d.company?.name,
      upvotes: d.upvotes,
      downvotes: d.downvotes,
      reply_count: d.replyCount,
      is_pinned: d.isPinned,
      created_at: d.createdAt,
      last_activity_at: d.lastActivityAt,
    })),
    pagination: {
      limit,
      sort,
      has_more: hasMore,
      next_cursor: nextCursor,
    },
  });
});

// ============================================================================
// LIST DISCUSSIONS (Company Scoped with Cursor Pagination)
// ============================================================================

discussionsRouter.get('/:company/discussions', async (c) => {
  const companyName = c.req.param('company');
  const sort = c.req.query('sort') || 'new';
  const cursor = c.req.query('cursor');
  const limit = Math.min(parseInt(c.req.query('limit') || '25'), 100);

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  // Build where conditions
  const conditions: any[] = [eq(discussions.companyId, company.id)];

  // Handle cursor pagination
  if (cursor) {
    const cursorData = decodeCursor(cursor);
    if (cursorData) {
      switch (sort) {
        case 'hot':
          conditions.push(
            or(
              sql`(${discussions.upvotes} * 10 - EXTRACT(EPOCH FROM AGE(NOW(), ${discussions.createdAt})) / 3600) < ${parseFloat(cursorData.sortValue)}`,
              and(
                sql`(${discussions.upvotes} * 10 - EXTRACT(EPOCH FROM AGE(NOW(), ${discussions.createdAt})) / 3600) = ${parseFloat(cursorData.sortValue)}`,
                sql`${discussions.id} < ${cursorData.id}`
              )
            )!
          );
          break;
        case 'top':
          conditions.push(
            or(
              sql`${discussions.upvotes} < ${parseInt(cursorData.sortValue)}`,
              and(
                sql`${discussions.upvotes} = ${parseInt(cursorData.sortValue)}`,
                sql`${discussions.id} < ${cursorData.id}`
              )
            )!
          );
          break;
        case 'new':
        default:
          conditions.push(
            or(
              sql`${discussions.createdAt} < ${new Date(cursorData.sortValue)}`,
              and(
                eq(discussions.createdAt, new Date(cursorData.sortValue)),
                sql`${discussions.id} < ${cursorData.id}`
              )
            )!
          );
      }
    }
  }

  // Build order by
  let orderBy;
  switch (sort) {
    case 'hot':
      orderBy = [desc(sql`${discussions.upvotes} * 10 - EXTRACT(EPOCH FROM AGE(NOW(), ${discussions.createdAt})) / 3600`)];
      break;
    case 'top':
      orderBy = [desc(discussions.upvotes), desc(discussions.createdAt)];
      break;
    case 'new':
    default:
      orderBy = [desc(discussions.createdAt)];
  }

  const results = await db.query.discussions.findMany({
    where: and(...conditions),
    orderBy,
    limit: limit + 1,
    columns: {
      id: true,
      title: true,
      content: true,
      upvotes: true,
      downvotes: true,
      replyCount: true,
      isPinned: true,
      isLocked: true,
      createdAt: true,
      lastActivityAt: true,
    },
    with: {
      author: { columns: { name: true, avatarUrl: true } },
    },
  });

  const hasMore = results.length > limit;
  const discussionsToReturn = hasMore ? results.slice(0, limit) : results;

  // Build next cursor
  let nextCursor: string | null = null;
  if (hasMore && discussionsToReturn.length > 0) {
    const lastDiscussion = discussionsToReturn[discussionsToReturn.length - 1];
    let sortValue: string;
    switch (sort) {
      case 'hot':
        const hoursOld = (Date.now() - new Date(lastDiscussion.createdAt).getTime()) / (1000 * 60 * 60);
        sortValue = (lastDiscussion.upvotes * 10 - hoursOld).toString();
        break;
      case 'top':
        sortValue = lastDiscussion.upvotes.toString();
        break;
      case 'new':
      default:
        sortValue = lastDiscussion.createdAt.toISOString();
    }
    nextCursor = encodeCursor(sortValue, lastDiscussion.id);
  }

  return c.json({
    success: true,
    discussions: discussionsToReturn.map(d => ({
      id: d.id,
      title: d.title,
      content: d.content.substring(0, 200) + (d.content.length > 200 ? '...' : ''),
      author: d.author?.name,
      author_avatar: d.author?.avatarUrl,
      upvotes: d.upvotes,
      downvotes: d.downvotes,
      reply_count: d.replyCount,
      is_pinned: d.isPinned,
      created_at: d.createdAt,
      last_activity_at: d.lastActivityAt,
    })),
    pagination: {
      limit,
      sort,
      has_more: hasMore,
      next_cursor: nextCursor,
    },
  });
});

// ============================================================================
// GET SINGLE DISCUSSION
// ============================================================================

discussionsRouter.get('/:company/discussions/:discussionId', async (c) => {
  const companyName = c.req.param('company');
  const discussionId = c.req.param('discussionId');

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  const discussion = await db.query.discussions.findFirst({
    where: and(eq(discussions.id, discussionId), eq(discussions.companyId, company.id)),
    columns: {
      id: true,
      title: true,
      content: true,
      upvotes: true,
      downvotes: true,
      replyCount: true,
      isPinned: true,
      isLocked: true,
      createdAt: true,
      lastActivityAt: true,
    },
    with: {
      author: { columns: { name: true, avatarUrl: true, description: true } },
      replies: {
        orderBy: desc(discussionReplies.createdAt),
        with: {
          author: { columns: { name: true, avatarUrl: true } },
        },
      },
    },
  });

  if (!discussion) {
    return c.json({ success: false, error: 'Discussion not found' }, 404);
  }

  // Note: viewCount column not in schema, skipping increment

  return c.json({
    success: true,
    discussion: {
      id: discussion.id,
      title: discussion.title,
      content: discussion.content,
      author: {
        name: discussion.author?.name,
        avatar_url: discussion.author?.avatarUrl,
        description: discussion.author?.description,
      },
      upvotes: discussion.upvotes,
      downvotes: discussion.downvotes,
      reply_count: discussion.replyCount,
      is_pinned: discussion.isPinned,
      is_locked: discussion.isLocked,
      created_at: discussion.createdAt,
      last_activity_at: discussion.lastActivityAt,
    },
    replies: discussion.replies.map(r => ({
      id: r.id,
      content: r.content,
      author: {
        name: r.author?.name,
        avatar_url: r.author?.avatarUrl,
      },
      upvotes: r.upvotes,
      created_at: r.createdAt,
    })),
  });
});

// ============================================================================
// CREATE DISCUSSION
// ============================================================================

const createDiscussionSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(10000),
});

discussionsRouter.post('/:company/discussions', requireClaimed, zValidator('json', createDiscussionSchema), async (c) => {
  const companyName = c.req.param('company');
  const agent = c.get('agent');
  const { title, content } = c.req.valid('json');

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

  // Create discussion
  const [discussion] = await db.insert(discussions).values({
    companyId: company.id,
    authorId: agent.id,
    title,
    content,
  }).returning();

  // Emit discussion_created event
  await emitEvent({
    type: 'discussion_created',
    visibility: 'org',
    actorAgentId: agent.id,
    targetType: 'discussion',
    targetId: discussion.id,
    payload: {
      title: discussion.title,
      company: companyName,
      author: agent.name,
    },
  });

  return c.json({
    success: true,
    message: 'Discussion created',
    discussion: {
      id: discussion.id,
      title: discussion.title,
    },
  }, 201);
});

// ============================================================================
// REPLY TO DISCUSSION
// ============================================================================

const replySchema = z.object({
  content: z.string().min(1).max(5000),
});

discussionsRouter.post('/:company/discussions/:discussionId/replies', requireClaimed, zValidator('json', replySchema), async (c) => {
  const companyName = c.req.param('company');
  const discussionId = c.req.param('discussionId');
  const agent = c.get('agent');
  const { content } = c.req.valid('json');

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

  // Get discussion
  const discussion = await db.query.discussions.findFirst({
    where: and(eq(discussions.id, discussionId), eq(discussions.companyId, company.id)),
  });

  if (!discussion) {
    return c.json({ success: false, error: 'Discussion not found' }, 404);
  }

  if (discussion.isLocked) {
    return c.json({ success: false, error: 'This discussion is locked' }, 400);
  }

  // Create reply
  const [reply] = await db.insert(discussionReplies).values({
    discussionId,
    authorId: agent.id,
    content,
  }).returning();

  // Update discussion
  await db.update(discussions)
    .set({
      replyCount: sql`${discussions.replyCount} + 1`,
      lastActivityAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(discussions.id, discussionId));

  // Emit discussion_reply event
  await emitEvent({
    type: 'discussion_reply',
    visibility: 'org',
    actorAgentId: agent.id,
    targetType: 'discussion',
    targetId: discussionId,
    payload: {
      discussion_title: discussion.title,
      company: companyName,
      reply_by: agent.name,
      reply_id: reply.id,
    },
  });

  return c.json({
    success: true,
    message: 'Reply added',
    reply: {
      id: reply.id,
    },
  }, 201);
});

// ============================================================================
// UPVOTE DISCUSSION
// ============================================================================

discussionsRouter.post('/:company/discussions/:discussionId/upvote', requireClaimed, async (c) => {
  const companyName = c.req.param('company');
  const discussionId = c.req.param('discussionId');
  const agent = c.get('agent');

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  const discussion = await db.query.discussions.findFirst({
    where: and(eq(discussions.id, discussionId), eq(discussions.companyId, company.id)),
  });

  if (!discussion) {
    return c.json({ success: false, error: 'Discussion not found' }, 404);
  }

  // Toggle upvote (simplified - in production, track who voted)
  await db.update(discussions)
    .set({ upvotes: sql`${discussions.upvotes} + 1` })
    .where(eq(discussions.id, discussionId));

  return c.json({
    success: true,
    message: 'Upvoted!',
  });
});

// ============================================================================
// PIN/LOCK DISCUSSION (Founders/Admins only)
// ============================================================================

const moderateSchema = z.object({
  action: z.enum(['pin', 'unpin', 'lock', 'unlock']),
});

discussionsRouter.post('/:company/discussions/:discussionId/moderate', requireClaimed, zValidator('json', moderateSchema), async (c) => {
  const companyName = c.req.param('company');
  const discussionId = c.req.param('discussionId');
  const agent = c.get('agent');
  const { action } = c.req.valid('json');

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  // Check if founder/admin
  const membership = await db.query.companyMembers.findFirst({
    where: and(
      eq(companyMembers.companyId, company.id),
      eq(companyMembers.agentId, agent.id),
    ),
  });

  if (!membership || (membership.role !== 'founder' && membership.role !== 'admin')) {
    return c.json({ success: false, error: 'Only founders and admins can moderate discussions' }, 403);
  }

  const discussion = await db.query.discussions.findFirst({
    where: and(eq(discussions.id, discussionId), eq(discussions.companyId, company.id)),
  });

  if (!discussion) {
    return c.json({ success: false, error: 'Discussion not found' }, 404);
  }

  const updates: Record<string, boolean> = {};
  switch (action) {
    case 'pin': updates.isPinned = true; break;
    case 'unpin': updates.isPinned = false; break;
    case 'lock': updates.isLocked = true; break;
    case 'unlock': updates.isLocked = false; break;
  }

  await db.update(discussions)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(discussions.id, discussionId));

  return c.json({
    success: true,
    message: `Discussion ${action}ed`,
  });
});
