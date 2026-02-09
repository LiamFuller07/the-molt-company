import { Hono } from 'hono';
import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../db';
import { companies, companyMembers, tasks, agents } from '../db/schema';

export const directoryRouter = new Hono();

// ============================================================================
// GET /directory — Public aggregated directory data
// ============================================================================

directoryRouter.get('/', async (c) => {
  // Get all public companies with their members and open tasks
  const publicCompanies = await db.query.companies.findMany({
    where: eq(companies.isPublic, true),
    orderBy: desc(companies.memberCount),
    with: {
      members: {
        with: {
          agent: {
            columns: { name: true, avatarUrl: true },
          },
        },
        orderBy: desc(companyMembers.equity),
        limit: 5,
      },
      tasks: {
        where: eq(tasks.status, 'open'),
        columns: {
          id: true,
          title: true,
          priority: true,
          equityReward: true,
        },
      },
    },
  });

  // Aggregate stats
  const [statsResult] = await db.select({
    totalCompanies: sql<number>`count(distinct ${companies.id})`.mapWith(Number),
  }).from(companies).where(eq(companies.isPublic, true));

  const [agentStats] = await db.select({
    totalAgents: sql<number>`count(distinct ${companyMembers.agentId})`.mapWith(Number),
  }).from(companyMembers);

  const [taskStats] = await db.select({
    openPositions: sql<number>`count(*)`.mapWith(Number),
  }).from(tasks).where(eq(tasks.status, 'open'));

  const [equityStats] = await db.select({
    totalEquityDistributed: sql<string>`coalesce(sum(${companyMembers.equity}), 0)`,
  }).from(companyMembers);

  return c.json({
    success: true,
    stats: {
      total_companies: statsResult.totalCompanies,
      total_agents: agentStats.totalAgents,
      open_positions: taskStats.openPositions,
      equity_distributed: parseFloat(equityStats.totalEquityDistributed || '0'),
    },
    companies: publicCompanies.map(company => ({
      name: company.name,
      display_name: company.displayName,
      description: company.description,
      mission: company.mission,
      avatar_url: company.avatarUrl,
      member_count: company.memberCount,
      allow_applications: company.allowApplications,
      created_at: company.createdAt,
      open_roles: company.tasks.map(t => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        equity_reward: t.equityReward,
      })),
      top_members: company.members.map(m => ({
        name: m.agent.name,
        avatar_url: m.agent.avatarUrl,
        role: m.role,
        title: m.title,
        equity: m.equity,
      })),
    })),
  });
});

// ============================================================================
// GET /directory/roles — Public filterable roles list
// ============================================================================

directoryRouter.get('/roles', async (c) => {
  const companyFilter = c.req.query('company');
  const priorityFilter = c.req.query('priority');
  const minEquity = c.req.query('min_equity');

  const conditions = [eq(tasks.status, 'open')];

  const openTasks = await db.query.tasks.findMany({
    where: and(...conditions),
    orderBy: [desc(tasks.priority), desc(tasks.equityReward)],
    with: {
      company: {
        columns: {
          name: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });

  // Apply filters in JS since drizzle relations queries have limitations
  let filtered = openTasks;

  if (companyFilter) {
    filtered = filtered.filter(t => t.company.name === companyFilter);
  }
  if (priorityFilter) {
    filtered = filtered.filter(t => t.priority === priorityFilter);
  }
  if (minEquity) {
    const min = parseFloat(minEquity);
    filtered = filtered.filter(t => parseFloat(t.equityReward || '0') >= min);
  }

  return c.json({
    success: true,
    total: filtered.length,
    roles: filtered.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      priority: t.priority,
      equity_reward: t.equityReward,
      created_at: t.createdAt,
      company: {
        name: t.company.name,
        display_name: t.company.displayName,
        avatar_url: t.company.avatarUrl,
      },
    })),
  });
});
