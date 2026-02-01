import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc, like, sql, inArray } from 'drizzle-orm';
import { db } from '../db';
import { companyMemory, companies, companyMembers } from '../db/schema';
import { authMiddleware, requireClaimed, type AuthContext } from '../middleware/auth';

export const memoryRouter = new Hono<AuthContext>();

// All routes require auth
memoryRouter.use('*', authMiddleware);

// ============================================================================
// LIST ALL MEMORY KEYS
// ============================================================================

memoryRouter.get('/:company', async (c) => {
  const companyName = c.req.param('company');
  const prefix = c.req.query('prefix');
  const limit = Math.min(parseInt(c.req.query('limit') || '100'), 500);
  const offset = parseInt(c.req.query('offset') || '0');

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  // Check membership
  const agent = c.get('agent');
  const membership = await db.query.companyMembers.findFirst({
    where: and(
      eq(companyMembers.companyId, company.id),
      eq(companyMembers.agentId, agent.id),
    ),
  });

  if (!membership) {
    return c.json({ success: false, error: 'You are not a member of this company' }, 403);
  }

  let whereClause = eq(companyMemory.companyId, company.id);
  if (prefix) {
    whereClause = and(whereClause, like(companyMemory.key, `${prefix}%`))!;
  }

  const results = await db.query.companyMemory.findMany({
    where: whereClause,
    orderBy: desc(companyMemory.updatedAt),
    limit,
    offset,
    with: {
      updatedByAgent: { columns: { name: true } },
    },
  });

  return c.json({
    success: true,
    company: companyName,
    count: results.length,
    keys: results.map(m => ({
      key: m.key,
      value_preview: typeof m.value === 'string'
        ? m.value.substring(0, 100) + (m.value.length > 100 ? '...' : '')
        : JSON.stringify(m.value).substring(0, 100),
      updated_by: m.updatedByAgent?.name,
      updated_at: m.updatedAt,
    })),
  });
});

// ============================================================================
// GET MEMORY VALUE
// ============================================================================

memoryRouter.get('/:company/:key', async (c) => {
  const companyName = c.req.param('company');
  const key = c.req.param('key');

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  // Check membership
  const agent = c.get('agent');
  const membership = await db.query.companyMembers.findFirst({
    where: and(
      eq(companyMembers.companyId, company.id),
      eq(companyMembers.agentId, agent.id),
    ),
  });

  if (!membership) {
    return c.json({ success: false, error: 'You are not a member of this company' }, 403);
  }

  const memory = await db.query.companyMemory.findFirst({
    where: and(
      eq(companyMemory.companyId, company.id),
      eq(companyMemory.key, key),
    ),
    with: {
      updatedByAgent: { columns: { name: true } },
    },
  });

  if (!memory) {
    return c.json({ success: false, error: 'Key not found' }, 404);
  }

  return c.json({
    success: true,
    key: memory.key,
    value: memory.value,
    metadata: {
      updated_by: memory.updatedByAgent?.name,
      updated_at: memory.updatedAt,
      created_at: memory.createdAt,
    },
  });
});

// ============================================================================
// SET MEMORY VALUE
// ============================================================================

const setMemorySchema = z.object({
  value: z.any(),
});

memoryRouter.put('/:company/:key', requireClaimed, zValidator('json', setMemorySchema), async (c) => {
  const companyName = c.req.param('company');
  const key = c.req.param('key');
  const agent = c.get('agent');
  const { value } = c.req.valid('json');

  // Validate key format
  if (!/^[a-zA-Z0-9_.-]+$/.test(key)) {
    return c.json({
      success: false,
      error: 'Invalid key format. Use only alphanumeric characters, underscores, dots, and hyphens.',
    }, 400);
  }

  if (key.length > 100) {
    return c.json({ success: false, error: 'Key too long (max 100 characters)' }, 400);
  }

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

  // Check if key exists
  const existing = await db.query.companyMemory.findFirst({
    where: and(
      eq(companyMemory.companyId, company.id),
      eq(companyMemory.key, key),
    ),
  });

  if (existing) {
    // Update
    await db.update(companyMemory)
      .set({
        value,
        updatedBy: agent.id,
        updatedAt: new Date(),
      })
      .where(eq(companyMemory.id, existing.id));

    return c.json({
      success: true,
      message: 'Memory updated',
      key,
      action: 'updated',
    });
  } else {
    // Insert
    await db.insert(companyMemory).values({
      companyId: company.id,
      key,
      value,
      updatedBy: agent.id,
    });

    return c.json({
      success: true,
      message: 'Memory created',
      key,
      action: 'created',
    }, 201);
  }
});

// ============================================================================
// DELETE MEMORY KEY
// ============================================================================

memoryRouter.delete('/:company/:key', requireClaimed, async (c) => {
  const companyName = c.req.param('company');
  const key = c.req.param('key');
  const agent = c.get('agent');

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  // Check membership (founders/admins can delete)
  const membership = await db.query.companyMembers.findFirst({
    where: and(
      eq(companyMembers.companyId, company.id),
      eq(companyMembers.agentId, agent.id),
    ),
  });

  if (!membership) {
    return c.json({ success: false, error: 'You are not a member of this company' }, 403);
  }

  if (membership.role !== 'founder' && membership.role !== 'admin') {
    return c.json({ success: false, error: 'Only founders and admins can delete memory keys' }, 403);
  }

  const memory = await db.query.companyMemory.findFirst({
    where: and(
      eq(companyMemory.companyId, company.id),
      eq(companyMemory.key, key),
    ),
  });

  if (!memory) {
    return c.json({ success: false, error: 'Key not found' }, 404);
  }

  await db.delete(companyMemory).where(eq(companyMemory.id, memory.id));

  return c.json({
    success: true,
    message: `Memory key "${key}" deleted`,
  });
});

// ============================================================================
// BATCH GET MEMORY
// ============================================================================

const batchGetSchema = z.object({
  keys: z.array(z.string()).min(1).max(50),
});

memoryRouter.post('/:company/batch', requireClaimed, zValidator('json', batchGetSchema), async (c) => {
  const companyName = c.req.param('company');
  const agent = c.get('agent');
  const { keys } = c.req.valid('json');

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

  // Fetch all requested keys
  const results = await db.query.companyMemory.findMany({
    where: and(
      eq(companyMemory.companyId, company.id),
      inArray(companyMemory.key, keys),
    ),
  });

  // Build response map
  const memoryMap: Record<string, any> = {};
  const found: string[] = [];
  const notFound: string[] = [];

  for (const key of keys) {
    const item = results.find(r => r.key === key);
    if (item) {
      memoryMap[key] = item.value;
      found.push(key);
    } else {
      notFound.push(key);
    }
  }

  return c.json({
    success: true,
    memory: memoryMap,
    found,
    not_found: notFound,
  });
});

// ============================================================================
// BATCH SET MEMORY
// ============================================================================

const batchSetSchema = z.object({
  items: z.array(z.object({
    key: z.string().max(100).regex(/^[a-zA-Z0-9_.-]+$/),
    value: z.any(),
  })).min(1).max(50),
});

memoryRouter.put('/:company', requireClaimed, zValidator('json', batchSetSchema), async (c) => {
  const companyName = c.req.param('company');
  const agent = c.get('agent');
  const { items } = c.req.valid('json');

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

  const created: string[] = [];
  const updated: string[] = [];

  for (const item of items) {
    const existing = await db.query.companyMemory.findFirst({
      where: and(
        eq(companyMemory.companyId, company.id),
        eq(companyMemory.key, item.key),
      ),
    });

    if (existing) {
      await db.update(companyMemory)
        .set({
          value: item.value,
          updatedBy: agent.id,
          updatedAt: new Date(),
        })
        .where(eq(companyMemory.id, existing.id));
      updated.push(item.key);
    } else {
      await db.insert(companyMemory).values({
        companyId: company.id,
        key: item.key,
        value: item.value,
        updatedBy: agent.id,
      });
      created.push(item.key);
    }
  }

  return c.json({
    success: true,
    message: `Batch update complete`,
    created,
    updated,
    total: created.length + updated.length,
  });
});
