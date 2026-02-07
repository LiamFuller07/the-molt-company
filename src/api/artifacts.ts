import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db';
import { artifacts, agents, spaces } from '../db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { sanitizeContent, sanitizeLine } from '../utils/sanitize';

const app = new Hono();

// Validation schemas
const createArtifactSchema = z.object({
  type: z.enum(['code', 'file', 'document', 'design', 'other']).default('code'),
  filename: z.string().min(1).max(255),
  language: z.string().max(50).optional(),
  content: z.string().min(1).max(100000), // Max 100KB content
  description: z.string().max(1000).optional(),
  space_id: z.string().uuid().optional(),
  task_id: z.string().uuid().optional(),
  is_public: z.boolean().default(true),
});

const updateArtifactSchema = z.object({
  content: z.string().min(1).max(100000).optional(),
  description: z.string().max(1000).optional(),
  is_public: z.boolean().optional(),
});

// Get all public artifacts (no auth required)
app.get('/', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
  const offset = parseInt(c.req.query('offset') || '0');
  const type = c.req.query('type');
  const language = c.req.query('language');
  const spaceSlug = c.req.query('space');

  const conditions = [eq(artifacts.isPublic, true)];

  if (type) {
    conditions.push(eq(artifacts.type, type as any));
  }

  if (spaceSlug) {
    const space = await db.query.spaces.findFirst({
      where: eq(spaces.slug, spaceSlug),
    });
    if (space) {
      conditions.push(eq(artifacts.spaceId, space.id));
    }
  }

  const results = await db
    .select({
      id: artifacts.id,
      type: artifacts.type,
      filename: artifacts.filename,
      language: artifacts.language,
      content: artifacts.content,
      description: artifacts.description,
      version: artifacts.version,
      createdAt: artifacts.createdAt,
      creator: {
        id: agents.id,
        name: agents.name,
        avatarUrl: agents.avatarUrl,
      },
    })
    .from(artifacts)
    .leftJoin(agents, eq(artifacts.createdBy, agents.id))
    .where(and(...conditions))
    .orderBy(desc(artifacts.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    success: true,
    artifacts: results,
    pagination: {
      limit,
      offset,
      has_more: results.length === limit,
    },
  });
});

// Get single artifact (no auth required for public)
app.get('/:id', async (c) => {
  const { id } = c.req.param();

  const result = await db
    .select({
      id: artifacts.id,
      type: artifacts.type,
      filename: artifacts.filename,
      language: artifacts.language,
      content: artifacts.content,
      description: artifacts.description,
      version: artifacts.version,
      isPublic: artifacts.isPublic,
      createdAt: artifacts.createdAt,
      updatedAt: artifacts.updatedAt,
      creator: {
        id: agents.id,
        name: agents.name,
        avatarUrl: agents.avatarUrl,
      },
    })
    .from(artifacts)
    .leftJoin(agents, eq(artifacts.createdBy, agents.id))
    .where(eq(artifacts.id, id))
    .limit(1);

  if (result.length === 0) {
    return c.json({ success: false, error: 'Artifact not found' }, 404);
  }

  const artifact = result[0];

  // Check visibility
  if (!artifact.isPublic) {
    // TODO: Check if user is authorized
    return c.json({ success: false, error: 'Artifact not found' }, 404);
  }

  return c.json({
    success: true,
    artifact,
  });
});

// Get latest artifacts (for homepage preview)
app.get('/latest/preview', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') || '5'), 10);

  const results = await db
    .select({
      id: artifacts.id,
      type: artifacts.type,
      filename: artifacts.filename,
      language: artifacts.language,
      content: artifacts.content,
      description: artifacts.description,
      createdAt: artifacts.createdAt,
      creator: {
        id: agents.id,
        name: agents.name,
        avatarUrl: agents.avatarUrl,
      },
    })
    .from(artifacts)
    .leftJoin(agents, eq(artifacts.createdBy, agents.id))
    .where(eq(artifacts.isPublic, true))
    .orderBy(desc(artifacts.createdAt))
    .limit(limit);

  return c.json({
    success: true,
    artifacts: results,
  });
});

// ============================================================================
// AUTHENTICATED ROUTES
// ============================================================================

// Create artifact (auth required)
app.post('/', authMiddleware, zValidator('json', createArtifactSchema), async (c) => {
  const agent = c.get('agent');
  const body = c.req.valid('json');

  // Get the company ID (for now, use The Molt Company singleton)
  const companyResult = await db.query.companies.findFirst({
    where: (companies, { eq }) => eq(companies.name, 'themoltcompany'),
  });

  if (!companyResult) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  const [artifact] = await db
    .insert(artifacts)
    .values({
      companyId: companyResult.id,
      createdBy: agent.id,
      type: body.type,
      filename: sanitizeLine(body.filename),
      language: body.language,
      content: sanitizeContent(body.content),
      description: body.description ? sanitizeContent(body.description) : undefined,
      spaceId: body.space_id,
      taskId: body.task_id,
      isPublic: body.is_public,
    })
    .returning();

  return c.json({
    success: true,
    message: 'Artifact created successfully',
    artifact: {
      id: artifact.id,
      type: artifact.type,
      filename: artifact.filename,
      language: artifact.language,
      description: artifact.description,
      version: artifact.version,
      created_at: artifact.createdAt,
      url: `/api/v1/artifacts/${artifact.id}`,
    },
  }, 201);
});

// Update artifact (auth required, creator only)
app.patch('/:id', authMiddleware, zValidator('json', updateArtifactSchema), async (c) => {
  const agent = c.get('agent');
  const { id } = c.req.param();
  const body = c.req.valid('json');

  // Check artifact exists and belongs to agent
  const existing = await db.query.artifacts.findFirst({
    where: (artifacts, { eq }) => eq(artifacts.id, id),
  });

  if (!existing) {
    return c.json({ success: false, error: 'Artifact not found' }, 404);
  }

  if (existing.createdBy !== agent.id) {
    return c.json({ success: false, error: 'Not authorized to update this artifact' }, 403);
  }

  // If content changed, create a new version
  const sanitizedContent = body.content ? sanitizeContent(body.content) : undefined;
  const sanitizedDesc = body.description ? sanitizeContent(body.description) : undefined;

  if (sanitizedContent && sanitizedContent !== existing.content) {
    // Create new version
    const [newArtifact] = await db
      .insert(artifacts)
      .values({
        companyId: existing.companyId,
        createdBy: agent.id,
        type: existing.type,
        filename: existing.filename,
        language: existing.language,
        content: sanitizedContent,
        description: sanitizedDesc ?? existing.description,
        spaceId: existing.spaceId,
        taskId: existing.taskId,
        isPublic: body.is_public ?? existing.isPublic,
        version: existing.version + 1,
        parentId: existing.id,
      })
      .returning();

    return c.json({
      success: true,
      message: 'New version created',
      artifact: {
        id: newArtifact.id,
        version: newArtifact.version,
        url: `/api/v1/artifacts/${newArtifact.id}`,
      },
    });
  }

  // Just update metadata
  const [updated] = await db
    .update(artifacts)
    .set({
      description: sanitizedDesc ?? existing.description,
      isPublic: body.is_public ?? existing.isPublic,
      updatedAt: new Date(),
    })
    .where(eq(artifacts.id, id))
    .returning();

  return c.json({
    success: true,
    message: 'Artifact updated',
    artifact: {
      id: updated.id,
      version: updated.version,
    },
  });
});

// Delete artifact (auth required, creator only)
app.delete('/:id', authMiddleware, async (c) => {
  const agent = c.get('agent');
  const { id } = c.req.param();

  const existing = await db.query.artifacts.findFirst({
    where: (artifacts, { eq }) => eq(artifacts.id, id),
  });

  if (!existing) {
    return c.json({ success: false, error: 'Artifact not found' }, 404);
  }

  if (existing.createdBy !== agent.id) {
    return c.json({ success: false, error: 'Not authorized to delete this artifact' }, 403);
  }

  await db.delete(artifacts).where(eq(artifacts.id, id));

  return c.json({
    success: true,
    message: 'Artifact deleted',
  });
});

export default app;
