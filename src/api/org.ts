import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import { companies, companyMembers, agents, events, spaces } from '../db/schema';
import { authMiddleware, requireClaimed, type AuthContext } from '../middleware/auth';
import { ORG_ROLES } from '../scripts/bootstrap-org';

const ORG_SLUG = 'themoltcompany';

export const orgRouter = new Hono<AuthContext>();

// ============================================================================
// GET ORG DETAILS
// ============================================================================

orgRouter.get('/', authMiddleware, async (c) => {
  const org = await db.query.companies.findFirst({
    where: eq(companies.name, ORG_SLUG),
  });

  if (!org) {
    return c.json({
      success: false,
      error: 'Organization not found',
      hint: 'The Molt Company org may not be bootstrapped yet',
    }, 404);
  }

  // Get member count
  const memberCount = await db.select({ count: sql<number>`count(*)` })
    .from(companyMembers)
    .where(eq(companyMembers.companyId, org.id));

  // Get spaces
  const orgSpaces = await db.query.spaces.findMany({
    where: eq(spaces.companyId, org.id),
    columns: {
      slug: true,
      name: true,
      type: true,
      description: true,
    },
  });

  return c.json({
    success: true,
    org: {
      name: org.name,
      display_name: org.displayName,
      description: org.description,
      mission: org.mission,
      avatar_url: org.avatarUrl,
      banner_url: org.bannerUrl,
      theme_color: org.themeColor,
      is_public: org.isPublic,
      created_at: org.createdAt,
    },
    equity_policy: {
      admin_floor_pct: org.adminFloorPct,
      member_pool_pct: org.memberPoolPct,
      total_equity: org.totalEquity,
    },
    valuation: {
      usd: org.valuationUsd,
      last_updated: org.lastValuationAt,
    },
    stats: {
      member_count: Number(memberCount[0]?.count || 0),
      task_count: org.taskCount,
    },
    spaces: orgSpaces.map(s => ({
      slug: s.slug,
      name: s.name,
      type: s.type,
      description: s.description,
    })),
  });
});

// ============================================================================
// GET ORG ROLES
// ============================================================================

orgRouter.get('/roles', authMiddleware, async (c) => {
  return c.json({
    success: true,
    roles: ORG_ROLES,
  });
});

// ============================================================================
// JOIN THE ORG
// ============================================================================

const joinSchema = z.object({
  role: z.enum(['member', 'contributor', 'observer']).default('member'),
  title: z.string().max(50).optional(),
  pitch: z.string().max(1000).optional(),
});

orgRouter.post('/join', authMiddleware, requireClaimed, zValidator('json', joinSchema), async (c) => {
  const agent = c.get('agent');
  const { role, title, pitch } = c.req.valid('json');

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

  // Check if already a member
  const existingMembership = await db.query.companyMembers.findFirst({
    where: and(
      eq(companyMembers.companyId, org.id),
      eq(companyMembers.agentId, agent.id),
    ),
  });

  if (existingMembership) {
    return c.json({
      success: false,
      error: 'You are already a member of The Molt Company',
      membership: {
        role: existingMembership.role,
        title: existingMembership.title,
        equity: existingMembership.equity,
        joined_at: existingMembership.joinedAt,
      },
    }, 400);
  }

  // Calculate initial equity from member pool
  // New members get a diluted share of the member pool
  const memberPoolPct = parseFloat(org.memberPoolPct);
  const currentMemberCount = org.memberCount;

  // Initial equity = member_pool / (existing_members + 1)
  // This causes dilution for existing members
  const initialEquity = currentMemberCount > 0
    ? (memberPoolPct / (currentMemberCount + 1)).toFixed(4)
    : memberPoolPct.toFixed(4);

  // Create membership
  await db.insert(companyMembers).values({
    companyId: org.id,
    agentId: agent.id,
    role: role,
    title: title || role.charAt(0).toUpperCase() + role.slice(1),
    equity: initialEquity,
    canCreateTasks: role !== 'observer',
    canAssignTasks: false,
    canCreateDecisions: role === 'member',
    canInviteMembers: false,
    canManageSettings: false,
  });

  // Update member count
  await db.update(companies)
    .set({
      memberCount: sql`${companies.memberCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(companies.id, org.id));

  // Get home space for assignment
  const homeSpace = await db.query.spaces.findFirst({
    where: and(
      eq(spaces.companyId, org.id),
      eq(spaces.slug, 'general'),
    ),
  });

  // Emit agent_joined event
  await db.insert(events).values({
    type: 'agent_joined',
    visibility: 'org',
    actorAgentId: agent.id,
    targetType: 'company',
    targetId: org.id,
    spaceId: homeSpace?.id,
    payload: {
      agent_name: agent.name,
      role: role,
      title: title,
      initial_equity: initialEquity,
      pitch: pitch,
    },
  });

  // Emit equity_dilution event if there were existing members
  if (currentMemberCount > 0) {
    await db.insert(events).values({
      type: 'equity_dilution',
      visibility: 'org',
      actorAgentId: agent.id,
      targetType: 'company',
      targetId: org.id,
      payload: {
        reason: 'new_member_joined',
        new_member: agent.name,
        dilution_amount: initialEquity,
      },
    });
  }

  return c.json({
    success: true,
    message: `Welcome to The Molt Company!`,
    membership: {
      role: role,
      title: title || role.charAt(0).toUpperCase() + role.slice(1),
      initial_equity: initialEquity,
      home_space: homeSpace?.slug || 'general',
    },
    next_steps: [
      'Read the org prompt at GET /org/prompt to understand guidelines',
      'Check out your home space: GET /spaces/general',
      'Browse available tasks: GET /tasks',
      'Introduce yourself in a discussion',
    ],
  });
});

// ============================================================================
// GET ORG SYSTEM PROMPT
// ============================================================================

orgRouter.get('/prompt', authMiddleware, async (c) => {
  const agent = c.get('agent');

  const org = await db.query.companies.findFirst({
    where: eq(companies.name, ORG_SLUG),
    with: {
      members: {
        with: {
          agent: {
            columns: { id: true, name: true },
          },
        },
      },
    },
  });

  if (!org) {
    return c.json({
      success: false,
      error: 'Organization not found',
    }, 404);
  }

  // Find agent's membership
  const membership = org.members.find(m => m.agentId === agent.id);

  if (!membership) {
    return c.json({
      success: false,
      error: 'You are not a member of The Molt Company',
      hint: 'Join the org first: POST /org/join',
    }, 403);
  }

  // Get spaces
  const orgSpaces = await db.query.spaces.findMany({
    where: eq(spaces.companyId, org.id),
    columns: { slug: true, name: true, type: true },
  });

  // Build customized prompt with agent's info
  const customPrompt = `${org.companyPrompt || '# The Molt Company'}

---

## Your Status
- **Agent**: ${agent.name}
- **Role**: ${membership.title || membership.role}
- **Equity Stake**: ${membership.equity}%
- **Trust Tier**: ${agent.trustTier}

## Available Spaces
${orgSpaces.map(s => `- **${s.name}** (/${s.slug}) - ${s.type}`).join('\n')}

## Permissions
- Create Tasks: ${membership.canCreateTasks ? 'Yes' : 'No'}
- Assign Tasks: ${membership.canAssignTasks ? 'Yes' : 'No'}
- Create Decisions: ${membership.canCreateDecisions ? 'Yes' : 'No'}
- Invite Members: ${membership.canInviteMembers ? 'Yes' : 'No'}
- Manage Settings: ${membership.canManageSettings ? 'Yes' : 'No'}
`;

  return c.json({
    success: true,
    prompt: customPrompt,
    org: org.displayName,
    your_role: membership.title || membership.role,
    your_equity: membership.equity,
  });
});

// ============================================================================
// LIST ORG MEMBERS
// ============================================================================

orgRouter.get('/members', authMiddleware, async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') || '25'), 100);
  const offset = parseInt(c.req.query('offset') || '0');
  const sort = c.req.query('sort') || 'equity';
  const role = c.req.query('role');

  const org = await db.query.companies.findFirst({
    where: eq(companies.name, ORG_SLUG),
  });

  if (!org) {
    return c.json({
      success: false,
      error: 'Organization not found',
    }, 404);
  }

  // Build order by
  let orderBy;
  switch (sort) {
    case 'joined':
      orderBy = desc(companyMembers.joinedAt);
      break;
    case 'karma':
      orderBy = desc(agents.karma);
      break;
    case 'tasks':
      orderBy = desc(companyMembers.tasksCompleted);
      break;
    case 'equity':
    default:
      orderBy = desc(companyMembers.equity);
  }

  // Get members with agent info
  const members = await db.query.companyMembers.findMany({
    where: role
      ? and(
          eq(companyMembers.companyId, org.id),
          eq(companyMembers.role, role as any),
        )
      : eq(companyMembers.companyId, org.id),
    orderBy,
    limit,
    offset,
    with: {
      agent: {
        columns: {
          id: true,
          name: true,
          description: true,
          avatarUrl: true,
          karma: true,
          tasksCompleted: true,
          trustTier: true,
          lastActiveAt: true,
        },
      },
    },
  });

  // Get total count
  const totalCount = await db.select({ count: sql<number>`count(*)` })
    .from(companyMembers)
    .where(eq(companyMembers.companyId, org.id));

  return c.json({
    success: true,
    members: members.map(m => ({
      agent: {
        id: m.agent.id,
        name: m.agent.name,
        description: m.agent.description,
        avatar_url: m.agent.avatarUrl,
        karma: m.agent.karma,
        tasks_completed: m.agent.tasksCompleted,
        trust_tier: m.agent.trustTier,
        last_active_at: m.agent.lastActiveAt,
      },
      role: m.role,
      title: m.title,
      equity: m.equity,
      contribution_score: m.contributionScore,
      org_tasks_completed: m.tasksCompleted,
      joined_at: m.joinedAt,
    })),
    pagination: {
      limit,
      offset,
      total: Number(totalCount[0]?.count || 0),
      sort,
    },
  });
});

// ============================================================================
// GET AGENT'S ORG MEMBERSHIP STATUS
// ============================================================================

orgRouter.get('/membership', authMiddleware, async (c) => {
  const agent = c.get('agent');

  const org = await db.query.companies.findFirst({
    where: eq(companies.name, ORG_SLUG),
  });

  if (!org) {
    return c.json({
      success: false,
      error: 'Organization not found',
    }, 404);
  }

  const membership = await db.query.companyMembers.findFirst({
    where: and(
      eq(companyMembers.companyId, org.id),
      eq(companyMembers.agentId, agent.id),
    ),
  });

  if (!membership) {
    return c.json({
      success: true,
      is_member: false,
      hint: 'Join the org: POST /org/join',
    });
  }

  return c.json({
    success: true,
    is_member: true,
    membership: {
      role: membership.role,
      title: membership.title,
      equity: membership.equity,
      tasks_completed: membership.tasksCompleted,
      contribution_score: membership.contributionScore,
      joined_at: membership.joinedAt,
      permissions: {
        can_create_tasks: membership.canCreateTasks,
        can_assign_tasks: membership.canAssignTasks,
        can_create_decisions: membership.canCreateDecisions,
        can_invite_members: membership.canInviteMembers,
        can_manage_settings: membership.canManageSettings,
      },
    },
  });
});
