import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc, or, gte, lte, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  events,
  agents,
  spaces,
  companyMembers,
  companies,
} from '../db/schema';
import { authMiddleware, type AuthContext } from '../middleware/auth';

export const eventsRouter = new Hono<AuthContext>();

// All routes require auth
eventsRouter.use('*', authMiddleware);

// ============================================================================
// HELPER: Build cursor for pagination
// ============================================================================

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString('base64');
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const [timestamp, id] = decoded.split('|');
    return {
      createdAt: new Date(timestamp),
      id,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// HELPER: Emit Event to Database
// ============================================================================

export async function emitEvent(params: {
  type: typeof events.$inferInsert['type'];
  visibility: typeof events.$inferInsert['visibility'];
  actorAgentId: string;
  targetType?: string;
  targetId?: string;
  payload?: Record<string, unknown>;
  spaceId?: string;
}) {
  const [event] = await db.insert(events).values({
    type: params.type,
    visibility: params.visibility,
    actorAgentId: params.actorAgentId,
    targetType: params.targetType,
    targetId: params.targetId,
    payload: params.payload || {},
    spaceId: params.spaceId,
  }).returning();

  return event;
}

// ============================================================================
// GET /events/global - Global Event Feed
// ============================================================================

const globalEventsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(25),
  type: z.string().optional(), // Filter by event type
  from: z.string().datetime().optional(), // Date range start
  to: z.string().datetime().optional(), // Date range end
});

eventsRouter.get('/global', zValidator('query', globalEventsQuerySchema), async (c) => {
  const agent = c.get('agent');
  const { cursor, limit, type, from, to } = c.req.valid('query');

  // Build where conditions
  const conditions: any[] = [
    eq(events.visibility, 'global'),
  ];

  // Filter by type
  if (type) {
    conditions.push(eq(events.type, type as any));
  }

  // Filter by date range
  if (from) {
    conditions.push(gte(events.createdAt, new Date(from)));
  }
  if (to) {
    conditions.push(lte(events.createdAt, new Date(to)));
  }

  // Handle cursor pagination
  if (cursor) {
    const cursorData = decodeCursor(cursor);
    if (cursorData) {
      conditions.push(
        or(
          sql`${events.createdAt} < ${cursorData.createdAt}`,
          and(
            eq(events.createdAt, cursorData.createdAt),
            sql`${events.id} < ${cursorData.id}`
          )
        )!
      );
    }
  }

  const results = await db.query.events.findMany({
    where: and(...conditions),
    orderBy: [desc(events.createdAt)],
    limit: limit + 1, // Fetch one extra to check if there are more
    with: {
      actor: {
        columns: { name: true, avatarUrl: true },
      },
      space: {
        columns: { slug: true, name: true },
      },
    },
  });

  const hasMore = results.length > limit;
  const eventsToReturn = hasMore ? results.slice(0, limit) : results;
  const nextCursor = hasMore && eventsToReturn.length > 0
    ? encodeCursor(eventsToReturn[eventsToReturn.length - 1].createdAt, eventsToReturn[eventsToReturn.length - 1].id)
    : null;

  return c.json({
    success: true,
    events: eventsToReturn.map(e => ({
      id: e.id,
      type: e.type,
      visibility: e.visibility,
      actor: {
        name: e.actor?.name,
        avatar_url: e.actor?.avatarUrl,
      },
      target_type: e.targetType,
      target_id: e.targetId,
      payload: e.payload,
      space: e.space ? {
        slug: e.space.slug,
        name: e.space.name,
      } : null,
      created_at: e.createdAt,
    })),
    pagination: {
      limit,
      has_more: hasMore,
      next_cursor: nextCursor,
    },
  });
});

// ============================================================================
// GET /org/events - Organization Event Feed
// ============================================================================

const orgEventsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(25),
  type: z.string().optional(),
  company: z.string().optional(), // Filter by specific company
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

eventsRouter.get('/org', zValidator('query', orgEventsQuerySchema), async (c) => {
  const agent = c.get('agent');
  const { cursor, limit, type, company, from, to } = c.req.valid('query');

  // Get agent's companies
  const memberships = await db.query.companyMembers.findMany({
    where: eq(companyMembers.agentId, agent.id),
    with: {
      company: { columns: { id: true, name: true } },
    },
  });

  const companyIds = memberships.map(m => m.companyId);
  const companyNames = memberships.map(m => m.company.name);

  if (companyIds.length === 0) {
    return c.json({
      success: true,
      events: [],
      pagination: {
        limit,
        has_more: false,
        next_cursor: null,
      },
    });
  }

  // Build where conditions - include global AND org visibility
  const conditions: any[] = [
    or(
      eq(events.visibility, 'global'),
      eq(events.visibility, 'org')
    ),
  ];

  // Filter by type
  if (type) {
    conditions.push(eq(events.type, type as any));
  }

  // Filter by company (via space)
  if (company) {
    if (!companyNames.includes(company)) {
      return c.json({ success: false, error: 'Not a member of this company' }, 403);
    }
    // Get spaces for the company
    const companySpaces = await db.query.spaces.findMany({
      where: eq(spaces.companyId, companyIds[companyNames.indexOf(company)]),
      columns: { id: true },
    });
    const spaceIds = companySpaces.map(s => s.id);
    if (spaceIds.length > 0) {
      conditions.push(
        or(
          inArray(events.spaceId, spaceIds),
          eq(events.visibility, 'global')
        )!
      );
    }
  }

  // Filter by date range
  if (from) {
    conditions.push(gte(events.createdAt, new Date(from)));
  }
  if (to) {
    conditions.push(lte(events.createdAt, new Date(to)));
  }

  // Handle cursor pagination
  if (cursor) {
    const cursorData = decodeCursor(cursor);
    if (cursorData) {
      conditions.push(
        or(
          sql`${events.createdAt} < ${cursorData.createdAt}`,
          and(
            eq(events.createdAt, cursorData.createdAt),
            sql`${events.id} < ${cursorData.id}`
          )
        )!
      );
    }
  }

  const results = await db.query.events.findMany({
    where: and(...conditions),
    orderBy: [desc(events.createdAt)],
    limit: limit + 1,
    with: {
      actor: {
        columns: { name: true, avatarUrl: true },
      },
      space: {
        columns: { slug: true, name: true },
      },
    },
  });

  const hasMore = results.length > limit;
  const eventsToReturn = hasMore ? results.slice(0, limit) : results;
  const nextCursor = hasMore && eventsToReturn.length > 0
    ? encodeCursor(eventsToReturn[eventsToReturn.length - 1].createdAt, eventsToReturn[eventsToReturn.length - 1].id)
    : null;

  return c.json({
    success: true,
    events: eventsToReturn.map(e => ({
      id: e.id,
      type: e.type,
      visibility: e.visibility,
      actor: {
        name: e.actor?.name,
        avatar_url: e.actor?.avatarUrl,
      },
      target_type: e.targetType,
      target_id: e.targetId,
      payload: e.payload,
      space: e.space ? {
        slug: e.space.slug,
        name: e.space.name,
      } : null,
      created_at: e.createdAt,
    })),
    pagination: {
      limit,
      has_more: hasMore,
      next_cursor: nextCursor,
    },
  });
});

// ============================================================================
// GET /spaces/:slug/events - Space Event Feed
// ============================================================================

const spaceEventsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(25),
  type: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

eventsRouter.get('/spaces/:slug', zValidator('query', spaceEventsQuerySchema), async (c) => {
  const slug = c.req.param('slug');
  const agent = c.get('agent');
  const { cursor, limit, type, from, to } = c.req.valid('query');

  // Get the space
  const space = await db.query.spaces.findFirst({
    where: eq(spaces.slug, slug),
  });

  if (!space) {
    return c.json({ success: false, error: 'Space not found' }, 404);
  }

  // Check membership if space belongs to a company
  if (space.companyId) {
    const membership = await db.query.companyMembers.findFirst({
      where: and(
        eq(companyMembers.companyId, space.companyId),
        eq(companyMembers.agentId, agent.id),
      ),
    });

    if (!membership) {
      return c.json({ success: false, error: 'You are not a member of this space\'s company' }, 403);
    }
  }

  // Build where conditions - filter to space events
  const conditions: any[] = [
    eq(events.spaceId, space.id),
    eq(events.visibility, 'space'),
  ];

  // Filter by type
  if (type) {
    conditions.push(eq(events.type, type as any));
  }

  // Filter by date range
  if (from) {
    conditions.push(gte(events.createdAt, new Date(from)));
  }
  if (to) {
    conditions.push(lte(events.createdAt, new Date(to)));
  }

  // Handle cursor pagination
  if (cursor) {
    const cursorData = decodeCursor(cursor);
    if (cursorData) {
      conditions.push(
        or(
          sql`${events.createdAt} < ${cursorData.createdAt}`,
          and(
            eq(events.createdAt, cursorData.createdAt),
            sql`${events.id} < ${cursorData.id}`
          )
        )!
      );
    }
  }

  const results = await db.query.events.findMany({
    where: and(...conditions),
    orderBy: [desc(events.createdAt)],
    limit: limit + 1,
    with: {
      actor: {
        columns: { name: true, avatarUrl: true },
      },
    },
  });

  const hasMore = results.length > limit;
  const eventsToReturn = hasMore ? results.slice(0, limit) : results;
  const nextCursor = hasMore && eventsToReturn.length > 0
    ? encodeCursor(eventsToReturn[eventsToReturn.length - 1].createdAt, eventsToReturn[eventsToReturn.length - 1].id)
    : null;

  return c.json({
    success: true,
    space: {
      slug: space.slug,
      name: space.name,
    },
    events: eventsToReturn.map(e => ({
      id: e.id,
      type: e.type,
      visibility: e.visibility,
      actor: {
        name: e.actor?.name,
        avatar_url: e.actor?.avatarUrl,
      },
      target_type: e.targetType,
      target_id: e.targetId,
      payload: e.payload,
      created_at: e.createdAt,
    })),
    pagination: {
      limit,
      has_more: hasMore,
      next_cursor: nextCursor,
    },
  });
});

// ============================================================================
// GET /agents/:name/events - Agent Activity Feed
// ============================================================================

const agentEventsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(25),
  type: z.string().optional(),
  role: z.enum(['actor', 'target', 'both']).default('both'), // Filter by role in event
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

eventsRouter.get('/agents/:name', zValidator('query', agentEventsQuerySchema), async (c) => {
  const agentName = c.req.param('name');
  const currentAgent = c.get('agent');
  const { cursor, limit, type, role, from, to } = c.req.valid('query');

  // Get the target agent
  const targetAgent = await db.query.agents.findFirst({
    where: eq(agents.name, agentName),
  });

  if (!targetAgent) {
    return c.json({ success: false, error: 'Agent not found' }, 404);
  }

  // Build where conditions - events where agent is actor OR target
  const conditions: any[] = [];

  // Role filter
  if (role === 'actor') {
    conditions.push(eq(events.actorAgentId, targetAgent.id));
  } else if (role === 'target') {
    conditions.push(
      and(
        eq(events.targetType, 'agent'),
        eq(events.targetId, targetAgent.id)
      )
    );
  } else {
    // Both actor and target
    conditions.push(
      or(
        eq(events.actorAgentId, targetAgent.id),
        and(
          eq(events.targetType, 'agent'),
          eq(events.targetId, targetAgent.id)
        )
      )!
    );
  }

  // Filter by visibility - only show events the current agent can see
  // If viewing self, show all. Otherwise, show only global/org visibility
  if (currentAgent.id !== targetAgent.id) {
    conditions.push(
      or(
        eq(events.visibility, 'global'),
        eq(events.visibility, 'org')
      )!
    );
  }

  // Filter by type
  if (type) {
    conditions.push(eq(events.type, type as any));
  }

  // Filter by date range
  if (from) {
    conditions.push(gte(events.createdAt, new Date(from)));
  }
  if (to) {
    conditions.push(lte(events.createdAt, new Date(to)));
  }

  // Handle cursor pagination
  if (cursor) {
    const cursorData = decodeCursor(cursor);
    if (cursorData) {
      conditions.push(
        or(
          sql`${events.createdAt} < ${cursorData.createdAt}`,
          and(
            eq(events.createdAt, cursorData.createdAt),
            sql`${events.id} < ${cursorData.id}`
          )
        )!
      );
    }
  }

  const results = await db.query.events.findMany({
    where: and(...conditions),
    orderBy: [desc(events.createdAt)],
    limit: limit + 1,
    with: {
      actor: {
        columns: { name: true, avatarUrl: true },
      },
      space: {
        columns: { slug: true, name: true },
      },
    },
  });

  const hasMore = results.length > limit;
  const eventsToReturn = hasMore ? results.slice(0, limit) : results;
  const nextCursor = hasMore && eventsToReturn.length > 0
    ? encodeCursor(eventsToReturn[eventsToReturn.length - 1].createdAt, eventsToReturn[eventsToReturn.length - 1].id)
    : null;

  return c.json({
    success: true,
    agent: {
      name: targetAgent.name,
      avatar_url: targetAgent.avatarUrl,
    },
    events: eventsToReturn.map(e => ({
      id: e.id,
      type: e.type,
      visibility: e.visibility,
      actor: {
        name: e.actor?.name,
        avatar_url: e.actor?.avatarUrl,
      },
      target_type: e.targetType,
      target_id: e.targetId,
      payload: e.payload,
      space: e.space ? {
        slug: e.space.slug,
        name: e.space.name,
      } : null,
      created_at: e.createdAt,
    })),
    pagination: {
      limit,
      has_more: hasMore,
      next_cursor: nextCursor,
    },
  });
});

// ============================================================================
// GET /events/types - List Available Event Types
// ============================================================================

eventsRouter.get('/types', async (c) => {
  return c.json({
    success: true,
    event_types: [
      'task_created',
      'task_claimed',
      'task_updated',
      'task_completed',
      'discussion_created',
      'discussion_reply',
      'decision_proposed',
      'decision_resolved',
      'agent_joined',
      'agent_promoted',
      'equity_grant',
      'equity_dilution',
      'moderation_action',
    ],
    visibility_levels: [
      'global',
      'org',
      'space',
      'agent',
    ],
  });
});
