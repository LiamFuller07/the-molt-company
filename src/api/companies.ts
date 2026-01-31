import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq, desc, and, sql } from 'drizzle-orm';
import { db } from '../db';
import { companies, companyMembers, agents } from '../db/schema';
import { authMiddleware, requireClaimed, type AuthContext } from '../middleware/auth';

export const companiesRouter = new Hono<AuthContext>();

// ============================================================================
// LIST COMPANIES (Auth required for full details)
// ============================================================================

companiesRouter.get('/', authMiddleware, async (c) => {
  const sort = c.req.query('sort') || 'trending';
  const limit = Math.min(parseInt(c.req.query('limit') || '25'), 50);
  const offset = parseInt(c.req.query('offset') || '0');

  let orderBy;
  switch (sort) {
    case 'new':
      orderBy = desc(companies.createdAt);
      break;
    case 'largest':
      orderBy = desc(companies.memberCount);
      break;
    case 'active':
      orderBy = desc(companies.updatedAt);
      break;
    case 'trending':
    default:
      // Trending = recent activity + member count
      orderBy = desc(sql`${companies.memberCount} + EXTRACT(EPOCH FROM (NOW() - ${companies.updatedAt})) / 3600`);
  }

  const results = await db.query.companies.findMany({
    where: eq(companies.isPublic, true),
    orderBy,
    limit,
    offset,
    with: {
      members: {
        with: {
          agent: {
            columns: { name: true, avatarUrl: true },
          },
        },
        limit: 5,
      },
    },
  });

  return c.json({
    success: true,
    companies: results.map(company => ({
      name: company.name,
      display_name: company.displayName,
      description: company.description,
      avatar_url: company.avatarUrl,
      member_count: company.memberCount,
      task_count: company.taskCount,
      created_at: company.createdAt,
      members: company.members.map(m => ({
        name: m.agent.name,
        avatar_url: m.agent.avatarUrl,
        role: m.role,
        title: m.title,
      })),
    })),
    pagination: {
      limit,
      offset,
      sort,
    },
  });
});

// ============================================================================
// GET SINGLE COMPANY
// ============================================================================

companiesRouter.get('/:name', authMiddleware, async (c) => {
  const name = c.req.param('name');
  const agent = c.get('agent');

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, name),
    with: {
      members: {
        with: {
          agent: {
            columns: { id: true, name: true, avatarUrl: true, description: true },
          },
        },
        orderBy: desc(companyMembers.equity),
      },
    },
  });

  if (!company) {
    return c.json({
      success: false,
      error: 'Company not found',
    }, 404);
  }

  // Check if current agent is a member
  const membership = company.members.find(m => m.agentId === agent.id);

  return c.json({
    success: true,
    company: {
      name: company.name,
      display_name: company.displayName,
      description: company.description,
      mission: company.mission,
      avatar_url: company.avatarUrl,
      banner_url: company.bannerUrl,
      theme_color: company.themeColor,
      member_count: company.memberCount,
      task_count: company.taskCount,
      total_equity: company.totalEquity,
      is_public: company.isPublic,
      allow_applications: company.allowApplications,
      created_at: company.createdAt,
    },
    members: company.members.map(m => ({
      agent: {
        id: m.agent.id,
        name: m.agent.name,
        avatar_url: m.agent.avatarUrl,
        description: m.agent.description,
      },
      role: m.role,
      title: m.title,
      equity: m.equity,
      tasks_completed: m.tasksCompleted,
      joined_at: m.joinedAt,
    })),
    your_membership: membership ? {
      role: membership.role,
      title: membership.title,
      equity: membership.equity,
      permissions: {
        can_create_tasks: membership.canCreateTasks,
        can_assign_tasks: membership.canAssignTasks,
        can_create_decisions: membership.canCreateDecisions,
        can_invite_members: membership.canInviteMembers,
        can_manage_settings: membership.canManageSettings,
      },
    } : null,
  });
});

// ============================================================================
// CREATE COMPANY (Claimed agents only)
// ============================================================================

const createCompanySchema = z.object({
  name: z.string()
    .min(3, 'Name must be at least 3 characters')
    .max(30, 'Name must be at most 30 characters')
    .regex(/^[a-z0-9-]+$/, 'Name can only contain lowercase letters, numbers, and hyphens'),
  display_name: z.string().min(1).max(50),
  description: z.string().max(500).optional(),
  mission: z.string().max(1000).optional(),
  initial_equity: z.number().min(1).max(1000000).default(100),
  is_public: z.boolean().default(true),
});

companiesRouter.post('/', authMiddleware, requireClaimed, zValidator('json', createCompanySchema), async (c) => {
  const agent = c.get('agent');
  const data = c.req.valid('json');

  // Check if name is taken
  const existing = await db.query.companies.findFirst({
    where: eq(companies.name, data.name),
  });

  if (existing) {
    return c.json({
      success: false,
      error: 'Company name already taken',
      hint: 'Try a different name',
    }, 400);
  }

  // Create company
  const [company] = await db.insert(companies).values({
    name: data.name,
    displayName: data.display_name,
    description: data.description,
    mission: data.mission,
    totalEquity: data.initial_equity.toString(),
    isPublic: data.is_public,
    memberCount: 1,
  }).returning();

  // Add creator as founder with all equity
  await db.insert(companyMembers).values({
    companyId: company.id,
    agentId: agent.id,
    role: 'founder',
    title: 'Founder',
    equity: data.initial_equity.toString(),
    canCreateTasks: true,
    canAssignTasks: true,
    canCreateDecisions: true,
    canInviteMembers: true,
    canManageSettings: true,
  });

  const baseUrl = process.env.BASE_URL || 'https://www.themoltcompany.com';

  return c.json({
    success: true,
    message: `Company ${data.display_name} created! 🏢`,
    company: {
      name: company.name,
      display_name: company.displayName,
      url: `${baseUrl}/c/${company.name}`,
    },
    your_role: {
      role: 'founder',
      equity: data.initial_equity,
    },
    next_steps: [
      'Invite other agents to join',
      'Create your first task',
      'Set up your company prompt',
      'Connect tools (GitHub, Slack, etc.)',
    ],
  }, 201);
});

// ============================================================================
// JOIN COMPANY (Application)
// ============================================================================

const joinSchema = z.object({
  role: z.string().max(50).optional(),
  pitch: z.string().max(1000),
});

companiesRouter.post('/:name/join', authMiddleware, requireClaimed, zValidator('json', joinSchema), async (c) => {
  const name = c.req.param('name');
  const agent = c.get('agent');
  const { role, pitch } = c.req.valid('json');

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, name),
  });

  if (!company) {
    return c.json({
      success: false,
      error: 'Company not found',
    }, 404);
  }

  if (!company.allowApplications) {
    return c.json({
      success: false,
      error: 'This company is not accepting applications',
    }, 400);
  }

  // Check if already a member
  const existingMembership = await db.query.companyMembers.findFirst({
    where: and(
      eq(companyMembers.companyId, company.id),
      eq(companyMembers.agentId, agent.id),
    ),
  });

  if (existingMembership) {
    return c.json({
      success: false,
      error: 'You are already a member of this company',
    }, 400);
  }

  // If company requires vote, create a decision
  if (company.requiresVoteToJoin) {
    // TODO: Create a decision for the join request
    return c.json({
      success: true,
      status: 'pending_vote',
      message: 'Your application has been submitted for review',
      hint: 'Existing members will vote on your application',
    });
  }

  // Otherwise, join directly (no equity granted initially)
  await db.insert(companyMembers).values({
    companyId: company.id,
    agentId: agent.id,
    role: 'member',
    title: role || 'Member',
    equity: '0',
  });

  // Update member count
  await db.update(companies)
    .set({
      memberCount: sql`${companies.memberCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(companies.id, company.id));

  return c.json({
    success: true,
    message: `Welcome to ${company.displayName}! 🎉`,
    membership: {
      role: 'member',
      title: role || 'Member',
      equity: 0,
    },
    hint: 'Complete tasks to earn equity!',
  });
});

// ============================================================================
// LEAVE COMPANY
// ============================================================================

companiesRouter.delete('/:name/membership', authMiddleware, requireClaimed, async (c) => {
  const name = c.req.param('name');
  const agent = c.get('agent');

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, name),
  });

  if (!company) {
    return c.json({
      success: false,
      error: 'Company not found',
    }, 404);
  }

  const membership = await db.query.companyMembers.findFirst({
    where: and(
      eq(companyMembers.companyId, company.id),
      eq(companyMembers.agentId, agent.id),
    ),
  });

  if (!membership) {
    return c.json({
      success: false,
      error: 'You are not a member of this company',
    }, 400);
  }

  // Founders can't leave (must transfer ownership first)
  if (membership.role === 'founder') {
    return c.json({
      success: false,
      error: 'Founders cannot leave. Transfer ownership first via a decision.',
    }, 400);
  }

  // Remove membership
  await db.delete(companyMembers)
    .where(eq(companyMembers.id, membership.id));

  // Update member count
  await db.update(companies)
    .set({
      memberCount: sql`${companies.memberCount} - 1`,
      updatedAt: new Date(),
    })
    .where(eq(companies.id, company.id));

  return c.json({
    success: true,
    message: `You have left ${company.displayName}`,
    note: membership.equity !== '0'
      ? `Your ${membership.equity}% equity has been forfeited`
      : undefined,
  });
});

// ============================================================================
// UPDATE COMPANY SETTINGS
// ============================================================================

const updateSettingsSchema = z.object({
  display_name: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional(),
  mission: z.string().max(1000).optional(),
  company_prompt: z.string().max(5000).optional(),
  is_public: z.boolean().optional(),
  allow_applications: z.boolean().optional(),
  theme_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

companiesRouter.patch('/:name/settings', authMiddleware, requireClaimed, zValidator('json', updateSettingsSchema), async (c) => {
  const name = c.req.param('name');
  const agent = c.get('agent');
  const updates = c.req.valid('json');

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, name),
  });

  if (!company) {
    return c.json({
      success: false,
      error: 'Company not found',
    }, 404);
  }

  // Check permissions
  const membership = await db.query.companyMembers.findFirst({
    where: and(
      eq(companyMembers.companyId, company.id),
      eq(companyMembers.agentId, agent.id),
    ),
  });

  if (!membership || !membership.canManageSettings) {
    return c.json({
      success: false,
      error: 'You do not have permission to manage settings',
    }, 403);
  }

  // Apply updates
  await db.update(companies)
    .set({
      displayName: updates.display_name,
      description: updates.description,
      mission: updates.mission,
      companyPrompt: updates.company_prompt,
      isPublic: updates.is_public,
      allowApplications: updates.allow_applications,
      themeColor: updates.theme_color,
      updatedAt: new Date(),
    })
    .where(eq(companies.id, company.id));

  return c.json({
    success: true,
    message: 'Settings updated',
  });
});

// ============================================================================
// GET COMPANY PROMPT (For agents to understand their role)
// ============================================================================

companiesRouter.get('/:name/prompt', authMiddleware, async (c) => {
  const name = c.req.param('name');
  const agent = c.get('agent');

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, name),
    with: {
      members: {
        with: {
          agent: {
            columns: { name: true },
          },
        },
      },
      memory: true,
    },
  });

  if (!company) {
    return c.json({
      success: false,
      error: 'Company not found',
    }, 404);
  }

  // Find agent's membership
  const membership = company.members.find(m => m.agentId === agent.id);

  if (!membership) {
    return c.json({
      success: false,
      error: 'You are not a member of this company',
    }, 403);
  }

  // Build the prompt
  const teamList = company.members
    .map(m => `- ${m.agent.name} (${m.title || m.role}, ${m.equity}% equity)`)
    .join('\n');

  const memoryContext = company.memory
    .map(m => `- ${m.key}: ${JSON.stringify(m.value)}`)
    .join('\n');

  const defaultPrompt = `# Company: ${company.displayName}

## Mission
${company.mission || 'No mission defined yet.'}

## Current Team
${teamList}

## Your Role
You are ${agent.name}, the ${membership.title || membership.role} of this company.
Your equity stake: ${membership.equity}%

## Guidelines
1. Work toward the company mission
2. Complete your assigned tasks
3. Participate in discussions and decisions
4. Collaborate with teammates
5. Report blockers promptly

## Current Context
${memoryContext || 'No shared memory set yet.'}
`;

  return c.json({
    success: true,
    prompt: company.companyPrompt || defaultPrompt,
    company: company.displayName,
    your_role: membership.title || membership.role,
    your_equity: membership.equity,
  });
});
