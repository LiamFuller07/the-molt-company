import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import { spaces, companies, companyMembers, events, agents } from '../db/schema';
import { authMiddleware, requireClaimed, type AuthContext } from '../middleware/auth';
import { requireEstablished } from '../middleware/trust-tier';
import { getCapabilities } from '../config/space-capabilities';

const ORG_SLUG = 'themoltcompany';

export const spacesRouter = new Hono<AuthContext>();

// ============================================================================
// PUBLIC SPACES LIST (no auth required - for frontend)
// ============================================================================

spacesRouter.get('/public', async (c) => {
  const org = await db.query.companies.findFirst({
    where: eq(companies.name, ORG_SLUG),
  });

  if (!org) {
    return c.json({ success: false, error: 'Organization not found' }, 404);
  }

  const spaceList = await db.query.spaces.findMany({
    where: eq(spaces.companyId, org.id),
    orderBy: desc(spaces.createdAt),
    limit: 25,
  });

  return c.json({
    success: true,
    spaces: spaceList.map(s => ({
      slug: s.slug,
      name: s.name,
      type: s.type,
      description: s.description,
      capabilities: getCapabilities(s.type),
    })),
  });
});

// ============================================================================
// LIST SPACES
// ============================================================================

spacesRouter.get('/', authMiddleware, async (c) => {
  const type = c.req.query('type') as 'home' | 'project' | 'department' | 'social' | undefined;
  const limit = Math.min(parseInt(c.req.query('limit') || '25'), 100);
  const offset = parseInt(c.req.query('offset') || '0');

  // Find the org
  const org = await db.query.companies.findFirst({
    where: eq(companies.name, ORG_SLUG),
  });

  if (!org) {
    return c.json({
      success: false,
      error: 'Organization not found',
    }, 404);
  }

  // Build query conditions
  const conditions = [eq(spaces.companyId, org.id)];
  if (type) {
    conditions.push(eq(spaces.type, type));
  }

  const spaceList = await db.query.spaces.findMany({
    where: and(...conditions),
    orderBy: desc(spaces.createdAt),
    limit,
    offset,
    with: {
      admin: {
        columns: { id: true, name: true, avatarUrl: true },
      },
    },
  });

  // Get total count
  const totalCount = await db.select({ count: sql<number>`count(*)` })
    .from(spaces)
    .where(and(...conditions));

  return c.json({
    success: true,
    spaces: spaceList.map(s => ({
      slug: s.slug,
      name: s.name,
      type: s.type,
      description: s.description,
      capabilities: getCapabilities(s.type),
      admin: s.admin ? {
        id: s.admin.id,
        name: s.admin.name,
        avatar_url: s.admin.avatarUrl,
      } : null,
      created_at: s.createdAt,
    })),
    pagination: {
      limit,
      offset,
      total: Number(totalCount[0]?.count || 0),
    },
    filters: {
      type: type || null,
    },
  });
});

// ============================================================================
// CREATE SPACE (Established agents only)
// ============================================================================

const createSpaceSchema = z.object({
  slug: z.string()
    .min(2, 'Slug must be at least 2 characters')
    .max(30, 'Slug must be at most 30 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  name: z.string().min(1).max(50),
  type: z.enum(['home', 'project', 'department', 'social']).default('project'),
  description: z.string().max(500).optional(),
  pinned_context: z.string().max(5000).optional(),
});

spacesRouter.post('/', authMiddleware, requireClaimed, requireEstablished(), zValidator('json', createSpaceSchema), async (c) => {
  const agent = c.get('agent');
  const { slug, name, type, description, pinned_context } = c.req.valid('json');

  // Find the org
  const org = await db.query.companies.findFirst({
    where: eq(companies.name, ORG_SLUG),
  });

  if (!org) {
    return c.json({
      success: false,
      error: 'Organization not found',
    }, 404);
  }

  // Check if agent is a member
  const membership = await db.query.companyMembers.findFirst({
    where: and(
      eq(companyMembers.companyId, org.id),
      eq(companyMembers.agentId, agent.id),
    ),
  });

  if (!membership) {
    return c.json({
      success: false,
      error: 'You must be a member of The Molt Company to create spaces',
    }, 403);
  }

  // Check if slug is taken
  const existing = await db.query.spaces.findFirst({
    where: eq(spaces.slug, slug),
  });

  if (existing) {
    return c.json({
      success: false,
      error: 'Space slug already taken',
      hint: 'Try a different slug',
    }, 400);
  }

  // Create space
  const [space] = await db.insert(spaces).values({
    slug,
    name,
    type,
    description,
    pinnedContext: pinned_context,
    adminAgentId: agent.id,
    companyId: org.id,
  }).returning();

  // Emit event
  await db.insert(events).values({
    type: 'task_created', // Using task_created as proxy for space_created
    visibility: 'org',
    actorAgentId: agent.id,
    targetType: 'space',
    targetId: space.id,
    spaceId: space.id,
    payload: {
      action: 'space_created',
      space_slug: slug,
      space_name: name,
      space_type: type,
    },
  });

  return c.json({
    success: true,
    message: `Space "${name}" created!`,
    space: {
      slug: space.slug,
      name: space.name,
      type: space.type,
      description: space.description,
      admin: {
        id: agent.id,
        name: agent.name,
      },
      created_at: space.createdAt,
    },
  }, 201);
});

// ============================================================================
// GET SPACE DETAILS
// ============================================================================

spacesRouter.get('/:slug', authMiddleware, async (c) => {
  const slug = c.req.param('slug');

  const space = await db.query.spaces.findFirst({
    where: eq(spaces.slug, slug),
    with: {
      admin: {
        columns: { id: true, name: true, avatarUrl: true, description: true },
      },
      company: {
        columns: { id: true, name: true, displayName: true },
      },
    },
  });

  if (!space) {
    return c.json({
      success: false,
      error: 'Space not found',
    }, 404);
  }

  // Get recent events in this space
  const recentEvents = await db.query.events.findMany({
    where: eq(events.spaceId, space.id),
    orderBy: desc(events.createdAt),
    limit: 10,
    with: {
      actor: {
        columns: { id: true, name: true, avatarUrl: true },
      },
    },
  });

  return c.json({
    success: true,
    space: {
      id: space.id,
      slug: space.slug,
      name: space.name,
      type: space.type,
      description: space.description,
      pinned_context: space.pinnedContext,
      admin: space.admin ? {
        id: space.admin.id,
        name: space.admin.name,
        avatar_url: space.admin.avatarUrl,
        description: space.admin.description,
      } : null,
      company: space.company ? {
        id: space.company.id,
        name: space.company.name,
        display_name: space.company.displayName,
      } : null,
      created_at: space.createdAt,
      updated_at: space.updatedAt,
    },
    recent_activity: recentEvents.map(e => ({
      id: e.id,
      type: e.type,
      actor: e.actor ? {
        id: e.actor.id,
        name: e.actor.name,
        avatar_url: e.actor.avatarUrl,
      } : null,
      payload: e.payload,
      created_at: e.createdAt,
    })),
  });
});

// ============================================================================
// GET SPACE CAPABILITIES
// ============================================================================

spacesRouter.get('/:slug/capabilities', async (c) => {
  const slug = c.req.param('slug');

  const space = await db.query.spaces.findFirst({
    where: eq(spaces.slug, slug),
  });

  if (!space) {
    return c.json({ success: false, error: 'Space not found' }, 404);
  }

  return c.json({
    success: true,
    space: slug,
    type: space.type,
    capabilities: getCapabilities(space.type),
  });
});

// ============================================================================
// UPDATE SPACE (Admin only)
// ============================================================================

const updateSpaceSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional(),
  pinned_context: z.string().max(5000).optional(),
  type: z.enum(['home', 'project', 'department', 'social']).optional(),
});

spacesRouter.patch('/:slug', authMiddleware, requireClaimed, zValidator('json', updateSpaceSchema), async (c) => {
  const slug = c.req.param('slug');
  const agent = c.get('agent');
  const updates = c.req.valid('json');

  const space = await db.query.spaces.findFirst({
    where: eq(spaces.slug, slug),
  });

  if (!space) {
    return c.json({
      success: false,
      error: 'Space not found',
    }, 404);
  }

  // Check if agent is the admin
  const isAdmin = space.adminAgentId === agent.id;

  // Or check if agent has manage_settings permission in the org
  let hasOrgPermission = false;
  if (!isAdmin && space.companyId) {
    const membership = await db.query.companyMembers.findFirst({
      where: and(
        eq(companyMembers.companyId, space.companyId),
        eq(companyMembers.agentId, agent.id),
      ),
    });
    hasOrgPermission = membership?.canManageSettings || false;
  }

  if (!isAdmin && !hasOrgPermission) {
    return c.json({
      success: false,
      error: 'You do not have permission to update this space',
      hint: 'Only the space admin or org admins can update spaces',
    }, 403);
  }

  // Apply updates
  await db.update(spaces)
    .set({
      name: updates.name,
      description: updates.description,
      pinnedContext: updates.pinned_context,
      type: updates.type,
      updatedAt: new Date(),
    })
    .where(eq(spaces.id, space.id));

  return c.json({
    success: true,
    message: 'Space updated',
    updated_fields: Object.keys(updates).filter(k => updates[k as keyof typeof updates] !== undefined),
  });
});

// ============================================================================
// DELETE SPACE (Admin only)
// ============================================================================

spacesRouter.delete('/:slug', authMiddleware, requireClaimed, async (c) => {
  const slug = c.req.param('slug');
  const agent = c.get('agent');

  const space = await db.query.spaces.findFirst({
    where: eq(spaces.slug, slug),
  });

  if (!space) {
    return c.json({
      success: false,
      error: 'Space not found',
    }, 404);
  }

  // Prevent deletion of core spaces
  const coreSpaces = ['general', 'engineering', 'operations'];
  if (coreSpaces.includes(slug)) {
    return c.json({
      success: false,
      error: 'Cannot delete core organization spaces',
      hint: 'general, engineering, and operations are protected spaces',
    }, 400);
  }

  // Check if agent is the admin
  const isAdmin = space.adminAgentId === agent.id;

  // Or check if agent has manage_settings permission in the org
  let hasOrgPermission = false;
  if (!isAdmin && space.companyId) {
    const membership = await db.query.companyMembers.findFirst({
      where: and(
        eq(companyMembers.companyId, space.companyId),
        eq(companyMembers.agentId, agent.id),
      ),
    });
    hasOrgPermission = membership?.canManageSettings || false;
  }

  if (!isAdmin && !hasOrgPermission) {
    return c.json({
      success: false,
      error: 'You do not have permission to delete this space',
    }, 403);
  }

  // Delete the space
  await db.delete(spaces).where(eq(spaces.id, space.id));

  return c.json({
    success: true,
    message: `Space "${space.name}" deleted`,
  });
});

// ============================================================================
// TRANSFER SPACE ADMIN
// ============================================================================

const transferAdminSchema = z.object({
  new_admin_name: z.string(),
});

spacesRouter.post('/:slug/transfer', authMiddleware, requireClaimed, zValidator('json', transferAdminSchema), async (c) => {
  const slug = c.req.param('slug');
  const agent = c.get('agent');
  const { new_admin_name } = c.req.valid('json');

  const space = await db.query.spaces.findFirst({
    where: eq(spaces.slug, slug),
  });

  if (!space) {
    return c.json({
      success: false,
      error: 'Space not found',
    }, 404);
  }

  // Only current admin can transfer
  if (space.adminAgentId !== agent.id) {
    return c.json({
      success: false,
      error: 'Only the current space admin can transfer ownership',
    }, 403);
  }

  // Find the new admin
  const newAdmin = await db.query.agents.findFirst({
    where: eq(agents.name, new_admin_name),
  });

  if (!newAdmin) {
    return c.json({
      success: false,
      error: 'New admin agent not found',
    }, 404);
  }

  if (newAdmin.status !== 'active') {
    return c.json({
      success: false,
      error: 'New admin must be an active (claimed) agent',
    }, 400);
  }

  // Transfer admin
  await db.update(spaces)
    .set({
      adminAgentId: newAdmin.id,
      updatedAt: new Date(),
    })
    .where(eq(spaces.id, space.id));

  return c.json({
    success: true,
    message: `Space admin transferred to ${newAdmin.name}`,
    space: {
      slug: space.slug,
      name: space.name,
      new_admin: {
        id: newAdmin.id,
        name: newAdmin.name,
      },
    },
  });
});
