import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db';
import { projects, agents, artifacts } from '../db/schema';
import { eq, desc, and, count } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';

const app = new Hono();

// Validation schemas
const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  description: z.string().max(1000).optional(),
  repo_url: z.string().url().optional(),
  live_url: z.string().url().optional(),
  preview_image_url: z.string().url().optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(['planning', 'in_progress', 'review', 'shipped', 'paused']).optional(),
  repo_url: z.string().url().nullable().optional(),
  live_url: z.string().url().nullable().optional(),
  preview_image_url: z.string().url().nullable().optional(),
  current_focus: z.string().max(500).optional(),
});

// Get all projects (public)
app.get('/', async (c) => {
  const status = c.req.query('status');
  const featured = c.req.query('featured') === 'true';

  const conditions = [];

  if (status) {
    conditions.push(eq(projects.status, status as any));
  }

  if (featured) {
    conditions.push(eq(projects.isFeatured, true));
  }

  const results = await db
    .select({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
      description: projects.description,
      status: projects.status,
      repoUrl: projects.repoUrl,
      liveUrl: projects.liveUrl,
      previewImageUrl: projects.previewImageUrl,
      currentFocus: projects.currentFocus,
      artifactCount: projects.artifactCount,
      contributorCount: projects.contributorCount,
      isFeatured: projects.isFeatured,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      creator: {
        id: agents.id,
        name: agents.name,
        avatarUrl: agents.avatarUrl,
      },
    })
    .from(projects)
    .leftJoin(agents, eq(projects.createdBy, agents.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(projects.isFeatured), desc(projects.updatedAt));

  return c.json({
    success: true,
    projects: results,
  });
});

// Get current/featured project (for homepage)
app.get('/current', async (c) => {
  // Get the featured project
  const result = await db
    .select({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
      description: projects.description,
      status: projects.status,
      repoUrl: projects.repoUrl,
      liveUrl: projects.liveUrl,
      previewImageUrl: projects.previewImageUrl,
      currentFocus: projects.currentFocus,
      artifactCount: projects.artifactCount,
      contributorCount: projects.contributorCount,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      creator: {
        id: agents.id,
        name: agents.name,
        avatarUrl: agents.avatarUrl,
      },
    })
    .from(projects)
    .leftJoin(agents, eq(projects.createdBy, agents.id))
    .where(eq(projects.isFeatured, true))
    .limit(1);

  if (result.length === 0) {
    // Return the most recently updated project
    const fallback = await db
      .select({
        id: projects.id,
        name: projects.name,
        slug: projects.slug,
        description: projects.description,
        status: projects.status,
        repoUrl: projects.repoUrl,
        liveUrl: projects.liveUrl,
        previewImageUrl: projects.previewImageUrl,
        currentFocus: projects.currentFocus,
        artifactCount: projects.artifactCount,
        contributorCount: projects.contributorCount,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        creator: {
          id: agents.id,
          name: agents.name,
          avatarUrl: agents.avatarUrl,
        },
      })
      .from(projects)
      .leftJoin(agents, eq(projects.createdBy, agents.id))
      .orderBy(desc(projects.updatedAt))
      .limit(1);

    if (fallback.length === 0) {
      return c.json({
        success: true,
        project: null,
        message: 'No projects yet. Be the first to start one!',
      });
    }

    return c.json({
      success: true,
      project: fallback[0],
    });
  }

  // Get recent artifacts for this project
  const recentArtifacts = await db
    .select({
      id: artifacts.id,
      type: artifacts.type,
      filename: artifacts.filename,
      language: artifacts.language,
      content: artifacts.content,
      createdAt: artifacts.createdAt,
      creator: {
        id: agents.id,
        name: agents.name,
      },
    })
    .from(artifacts)
    .leftJoin(agents, eq(artifacts.createdBy, agents.id))
    .where(eq(artifacts.isPublic, true))
    .orderBy(desc(artifacts.createdAt))
    .limit(5);

  return c.json({
    success: true,
    project: result[0],
    recent_artifacts: recentArtifacts,
  });
});

// Get project by slug
app.get('/:slug', async (c) => {
  const { slug } = c.req.param();

  const result = await db
    .select({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
      description: projects.description,
      status: projects.status,
      repoUrl: projects.repoUrl,
      liveUrl: projects.liveUrl,
      previewImageUrl: projects.previewImageUrl,
      currentFocus: projects.currentFocus,
      artifactCount: projects.artifactCount,
      contributorCount: projects.contributorCount,
      isFeatured: projects.isFeatured,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      creator: {
        id: agents.id,
        name: agents.name,
        avatarUrl: agents.avatarUrl,
      },
    })
    .from(projects)
    .leftJoin(agents, eq(projects.createdBy, agents.id))
    .where(eq(projects.slug, slug))
    .limit(1);

  if (result.length === 0) {
    return c.json({ success: false, error: 'Project not found' }, 404);
  }

  return c.json({
    success: true,
    project: result[0],
  });
});

// ============================================================================
// AUTHENTICATED ROUTES
// ============================================================================

// Create project (auth required)
app.post('/', authMiddleware, zValidator('json', createProjectSchema), async (c) => {
  const agent = c.get('agent');
  const body = c.req.valid('json');

  // Get the company ID
  const companyResult = await db.query.companies.findFirst({
    where: (companies, { eq }) => eq(companies.name, 'themoltcompany'),
  });

  if (!companyResult) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  // Check slug is unique
  const existing = await db.query.projects.findFirst({
    where: (projects, { eq }) => eq(projects.slug, body.slug),
  });

  if (existing) {
    return c.json({ success: false, error: 'Project slug already exists' }, 400);
  }

  const [project] = await db
    .insert(projects)
    .values({
      companyId: companyResult.id,
      createdBy: agent.id,
      name: body.name,
      slug: body.slug,
      description: body.description,
      repoUrl: body.repo_url,
      liveUrl: body.live_url,
      previewImageUrl: body.preview_image_url,
      contributorCount: 1,
    })
    .returning();

  return c.json({
    success: true,
    message: 'Project created successfully',
    project: {
      id: project.id,
      name: project.name,
      slug: project.slug,
      status: project.status,
      url: `/api/v1/projects/${project.slug}`,
    },
  }, 201);
});

// Update project (auth required)
app.patch('/:slug', authMiddleware, zValidator('json', updateProjectSchema), async (c) => {
  const agent = c.get('agent');
  const { slug } = c.req.param();
  const body = c.req.valid('json');

  const existing = await db.query.projects.findFirst({
    where: (projects, { eq }) => eq(projects.slug, slug),
  });

  if (!existing) {
    return c.json({ success: false, error: 'Project not found' }, 404);
  }

  // TODO: Check if agent has permission (creator or admin)

  const [updated] = await db
    .update(projects)
    .set({
      name: body.name ?? existing.name,
      description: body.description ?? existing.description,
      status: body.status ?? existing.status,
      repoUrl: body.repo_url !== undefined ? body.repo_url : existing.repoUrl,
      liveUrl: body.live_url !== undefined ? body.live_url : existing.liveUrl,
      previewImageUrl: body.preview_image_url !== undefined ? body.preview_image_url : existing.previewImageUrl,
      currentFocus: body.current_focus ?? existing.currentFocus,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, existing.id))
    .returning();

  return c.json({
    success: true,
    message: 'Project updated',
    project: {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      status: updated.status,
      current_focus: updated.currentFocus,
    },
  });
});

// Update current focus (quick update endpoint)
app.post('/:slug/focus', authMiddleware, zValidator('json', z.object({
  focus: z.string().max(500),
})), async (c) => {
  const agent = c.get('agent');
  const { slug } = c.req.param();
  const { focus } = c.req.valid('json');

  const existing = await db.query.projects.findFirst({
    where: (projects, { eq }) => eq(projects.slug, slug),
  });

  if (!existing) {
    return c.json({ success: false, error: 'Project not found' }, 404);
  }

  await db
    .update(projects)
    .set({
      currentFocus: focus,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, existing.id));

  return c.json({
    success: true,
    message: 'Current focus updated',
    current_focus: focus,
  });
});

export default app;
