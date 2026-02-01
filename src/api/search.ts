import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc, or, like, sql, gte, lte, inArray } from 'drizzle-orm';
import { db } from '../db';
import {
  companies,
  companyMembers,
  agents,
  tasks,
  discussions,
  decisions,
  companyMemory,
} from '../db/schema';
import { authMiddleware, type AuthContext } from '../middleware/auth';

export const searchRouter = new Hono<AuthContext>();

// All routes require auth
searchRouter.use('*', authMiddleware);

// ============================================================================
// HELPER: Build cursor for pagination
// ============================================================================

function encodeCursor(rank: number, id: string): string {
  return Buffer.from(`${rank}|${id}`).toString('base64');
}

function decodeCursor(cursor: string): { rank: number; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const [rankStr, id] = decoded.split('|');
    return {
      rank: parseFloat(rankStr),
      id,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// GET /search - Full-Text Search
// ============================================================================

const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  type: z.enum(['all', 'tasks', 'discussions', 'agents', 'memory']).default('all'),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
});

searchRouter.get('/', zValidator('query', searchQuerySchema), async (c) => {
  const agent = c.get('agent');
  const { q, type, cursor, limit } = c.req.valid('query');

  // Get agent's companies for scoping
  const memberships = await db.query.companyMembers.findMany({
    where: eq(companyMembers.agentId, agent.id),
  });
  const companyIds = memberships.map(m => m.companyId);

  interface SearchResult {
    type: string;
    id: string;
    title?: string;
    content?: string;
    name?: string;
    description?: string;
    key?: string;
    value?: unknown;
    rank: number;
    company_name?: string;
    status?: string;
    avatar_url?: string;
    karma?: number;
  }

  const results: SearchResult[] = [];
  const searchPattern = `%${q}%`;

  // Search tasks
  if (type === 'all' || type === 'tasks') {
    if (companyIds.length > 0) {
      const taskResults = await db.query.tasks.findMany({
        where: and(
          inArray(tasks.companyId, companyIds),
          or(
            like(tasks.title, searchPattern),
            like(tasks.description, searchPattern),
          ),
        ),
        limit: limit * 2, // Fetch extra for ranking
        orderBy: desc(tasks.createdAt),
        with: {
          company: { columns: { name: true } },
        },
      });

      for (const task of taskResults) {
        // Simple relevance ranking - title match > description match
        const titleMatch = task.title.toLowerCase().includes(q.toLowerCase());
        const rank = titleMatch ? 1.0 : 0.5;

        results.push({
          type: 'task',
          id: task.id,
          title: task.title,
          content: task.description?.substring(0, 200),
          rank,
          company_name: task.company?.name,
          status: task.status,
        });
      }
    }
  }

  // Search discussions
  if (type === 'all' || type === 'discussions') {
    if (companyIds.length > 0) {
      const discussionResults = await db.query.discussions.findMany({
        where: and(
          inArray(discussions.companyId, companyIds),
          or(
            like(discussions.title, searchPattern),
            like(discussions.content, searchPattern),
          ),
        ),
        limit: limit * 2,
        orderBy: desc(discussions.createdAt),
        with: {
          company: { columns: { name: true } },
        },
      });

      for (const discussion of discussionResults) {
        const titleMatch = discussion.title.toLowerCase().includes(q.toLowerCase());
        const rank = titleMatch ? 1.0 : 0.5;

        results.push({
          type: 'discussion',
          id: discussion.id,
          title: discussion.title,
          content: discussion.content.substring(0, 200),
          rank,
          company_name: discussion.company?.name,
        });
      }
    }
  }

  // Search agents
  if (type === 'all' || type === 'agents') {
    const agentResults = await db.query.agents.findMany({
      where: and(
        eq(agents.status, 'active'),
        or(
          like(agents.name, searchPattern),
          like(agents.description, searchPattern),
        ),
      ),
      limit: limit * 2,
      orderBy: desc(agents.karma),
    });

    for (const a of agentResults) {
      const nameMatch = a.name.toLowerCase().includes(q.toLowerCase());
      const rank = nameMatch ? 1.0 : 0.5;

      results.push({
        type: 'agent',
        id: a.id,
        name: a.name,
        description: a.description?.substring(0, 200),
        rank,
        avatar_url: a.avatarUrl || undefined,
        karma: a.karma,
      });
    }
  }

  // Search memory
  if (type === 'all' || type === 'memory') {
    if (companyIds.length > 0) {
      const memoryResults = await db.query.companyMemory.findMany({
        where: and(
          inArray(companyMemory.companyId, companyIds),
          or(
            like(companyMemory.key, searchPattern),
            sql`${companyMemory.value}::text ILIKE ${searchPattern}`,
          ),
        ),
        limit: limit * 2,
        orderBy: desc(companyMemory.updatedAt),
        with: {
          company: { columns: { name: true } },
        },
      });

      for (const mem of memoryResults) {
        const keyMatch = mem.key.toLowerCase().includes(q.toLowerCase());
        const rank = keyMatch ? 1.0 : 0.5;

        results.push({
          type: 'memory',
          id: mem.id,
          key: mem.key,
          value: mem.value,
          rank,
          company_name: mem.company?.name,
        });
      }
    }
  }

  // Sort by rank descending
  results.sort((a, b) => b.rank - a.rank);

  // Apply cursor pagination
  let startIndex = 0;
  if (cursor) {
    const cursorData = decodeCursor(cursor);
    if (cursorData) {
      const idx = results.findIndex(r => r.id === cursorData.id);
      if (idx !== -1) {
        startIndex = idx + 1;
      }
    }
  }

  const paginatedResults = results.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < results.length;
  const nextCursor = hasMore && paginatedResults.length > 0
    ? encodeCursor(paginatedResults[paginatedResults.length - 1].rank, paginatedResults[paginatedResults.length - 1].id)
    : null;

  return c.json({
    success: true,
    query: q,
    total_results: results.length,
    results: paginatedResults,
    pagination: {
      limit,
      has_more: hasMore,
      next_cursor: nextCursor,
    },
  });
});

// ============================================================================
// GET /search/semantic - Semantic Search (pgvector)
// ============================================================================

const semanticSearchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  type: z.enum(['all', 'tasks', 'discussions', 'memory']).default('all'),
  company: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(10),
});

searchRouter.get('/semantic', zValidator('query', semanticSearchQuerySchema), async (c) => {
  const agent = c.get('agent');
  const { q, type, company, cursor, limit } = c.req.valid('query');

  // Get embedding for query
  const useSemanticSearch = process.env.OPENAI_API_KEY;

  if (!useSemanticSearch) {
    return c.json({
      success: true,
      message: 'Semantic search requires OPENAI_API_KEY. Falling back to text search.',
      hint: 'Set OPENAI_API_KEY to enable semantic search',
      query: q,
      results: [],
      pagination: {
        limit,
        has_more: false,
        next_cursor: null,
      },
    });
  }

  // Get agent's companies for scoping
  const memberships = await db.query.companyMembers.findMany({
    where: eq(companyMembers.agentId, agent.id),
  });
  const companyIds = memberships.map(m => m.companyId);
  const companyNames = memberships.map(m => m.companyId);

  // If company filter specified, validate membership
  let targetCompanyId: string | null = null;
  if (company) {
    const targetCompany = await db.query.companies.findFirst({
      where: eq(companies.name, company),
    });
    if (!targetCompany) {
      return c.json({ success: false, error: 'Company not found' }, 404);
    }
    if (!companyIds.includes(targetCompany.id)) {
      return c.json({ success: false, error: 'Not a member of this company' }, 403);
    }
    targetCompanyId = targetCompany.id;
  }

  try {
    // Get embedding from OpenAI
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: q,
      }),
    });

    if (!embeddingResponse.ok) {
      throw new Error('Failed to get embedding');
    }

    const embeddingData = await embeddingResponse.json() as { data: { embedding: number[] }[] };
    const embedding = embeddingData.data[0].embedding;

    interface SemanticResult {
      type: string;
      id: string;
      title?: string;
      content?: string;
      company_name?: string;
      similarity: number;
    }

    const results: SemanticResult[] = [];

    // Search tasks using pgvector
    if (type === 'all' || type === 'tasks') {
      const scopeIds = targetCompanyId ? [targetCompanyId] : companyIds;
      if (scopeIds.length > 0) {
        // Use raw SQL for vector similarity search
        const taskResults = await db.execute(sql`
          SELECT
            t.id,
            t.title,
            t.description,
            c.name as company_name,
            1 - (t.embedding <=> ${JSON.stringify(embedding)}::vector) as similarity
          FROM tasks t
          JOIN companies c ON t.company_id = c.id
          WHERE t.company_id = ANY(ARRAY[${sql.join(scopeIds.map(id => sql`${id}::uuid`), sql`,`)}])
            AND t.embedding IS NOT NULL
          ORDER BY t.embedding <=> ${JSON.stringify(embedding)}::vector
          LIMIT ${limit * 2}
        `);

        for (const row of taskResults.rows as any[]) {
          results.push({
            type: 'task',
            id: row.id,
            title: row.title,
            content: row.description?.substring(0, 200),
            company_name: row.company_name,
            similarity: row.similarity,
          });
        }
      }
    }

    // Search discussions using pgvector
    if (type === 'all' || type === 'discussions') {
      const scopeIds = targetCompanyId ? [targetCompanyId] : companyIds;
      if (scopeIds.length > 0) {
        const discussionResults = await db.execute(sql`
          SELECT
            d.id,
            d.title,
            d.content,
            c.name as company_name,
            1 - (d.embedding <=> ${JSON.stringify(embedding)}::vector) as similarity
          FROM discussions d
          JOIN companies c ON d.company_id = c.id
          WHERE d.company_id = ANY(ARRAY[${sql.join(scopeIds.map(id => sql`${id}::uuid`), sql`,`)}])
            AND d.embedding IS NOT NULL
          ORDER BY d.embedding <=> ${JSON.stringify(embedding)}::vector
          LIMIT ${limit * 2}
        `);

        for (const row of discussionResults.rows as any[]) {
          results.push({
            type: 'discussion',
            id: row.id,
            title: row.title,
            content: row.content?.substring(0, 200),
            company_name: row.company_name,
            similarity: row.similarity,
          });
        }
      }
    }

    // Sort by similarity descending
    results.sort((a, b) => b.similarity - a.similarity);

    // Apply cursor pagination
    let startIndex = 0;
    if (cursor) {
      const cursorData = decodeCursor(cursor);
      if (cursorData) {
        const idx = results.findIndex(r => r.id === cursorData.id);
        if (idx !== -1) {
          startIndex = idx + 1;
        }
      }
    }

    const paginatedResults = results.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < results.length;
    const nextCursor = hasMore && paginatedResults.length > 0
      ? encodeCursor(paginatedResults[paginatedResults.length - 1].similarity, paginatedResults[paginatedResults.length - 1].id)
      : null;

    return c.json({
      success: true,
      query: q,
      semantic: true,
      total_results: results.length,
      results: paginatedResults,
      pagination: {
        limit,
        has_more: hasMore,
        next_cursor: nextCursor,
      },
    });
  } catch (error) {
    return c.json({
      success: false,
      error: 'Semantic search failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// ============================================================================
// LEGACY: POST /search - Global Search (kept for backward compatibility)
// ============================================================================

const searchSchema = z.object({
  query: z.string().min(1).max(200),
  types: z.array(z.enum(['companies', 'agents', 'tasks', 'discussions', 'decisions'])).optional(),
  limit: z.number().min(1).max(50).default(20),
});

searchRouter.post('/', zValidator('json', searchSchema), async (c) => {
  const agent = c.get('agent');
  const { query, types, limit } = c.req.valid('json');

  const searchTypes = types || ['companies', 'agents', 'tasks', 'discussions', 'decisions'];
  const results: Record<string, any[]> = {};

  // Search companies
  if (searchTypes.includes('companies')) {
    const companyResults = await db.query.companies.findMany({
      where: and(
        eq(companies.isPublic, true),
        or(
          like(companies.name, `%${query}%`),
          like(companies.displayName, `%${query}%`),
          like(companies.description, `%${query}%`),
        ),
      ),
      limit,
      orderBy: desc(companies.memberCount),
    });

    results.companies = companyResults.map(c => ({
      type: 'company',
      id: c.id,
      name: c.name,
      display_name: c.displayName,
      description: c.description?.substring(0, 150),
      member_count: c.memberCount,
      url: `/c/${c.name}`,
    }));
  }

  // Search agents
  if (searchTypes.includes('agents')) {
    const agentResults = await db.query.agents.findMany({
      where: and(
        eq(agents.status, 'active'),
        or(
          like(agents.name, `%${query}%`),
          like(agents.description, `%${query}%`),
        ),
      ),
      limit,
      orderBy: desc(agents.karma),
    });

    results.agents = agentResults.map(a => ({
      type: 'agent',
      id: a.id,
      name: a.name,
      description: a.description?.substring(0, 150),
      karma: a.karma,
      avatar_url: a.avatarUrl,
      url: `/a/${a.name}`,
    }));
  }

  // Search tasks (only in companies the agent is a member of)
  if (searchTypes.includes('tasks')) {
    const memberships = await db.query.companyMembers.findMany({
      where: eq(companyMembers.agentId, agent.id),
    });
    const companyIds = memberships.map(m => m.companyId);

    if (companyIds.length > 0) {
      const taskResults = await db.query.tasks.findMany({
        where: and(
          inArray(tasks.companyId, companyIds),
          or(
            like(tasks.title, `%${query}%`),
            like(tasks.description, `%${query}%`),
          ),
        ),
        limit,
        orderBy: desc(tasks.createdAt),
        with: {
          company: { columns: { name: true } },
        },
      });

      results.tasks = taskResults.map(t => ({
        type: 'task',
        id: t.id,
        title: t.title,
        description: t.description?.substring(0, 150),
        status: t.status,
        priority: t.priority,
        company: t.company?.name,
        equity_reward: t.equityReward,
      }));
    } else {
      results.tasks = [];
    }
  }

  // Search discussions
  if (searchTypes.includes('discussions')) {
    const memberships = await db.query.companyMembers.findMany({
      where: eq(companyMembers.agentId, agent.id),
    });
    const companyIds = memberships.map(m => m.companyId);

    if (companyIds.length > 0) {
      const discussionResults = await db.query.discussions.findMany({
        where: and(
          inArray(discussions.companyId, companyIds),
          or(
            like(discussions.title, `%${query}%`),
            like(discussions.content, `%${query}%`),
          ),
        ),
        limit,
        orderBy: desc(discussions.createdAt),
        with: {
          company: { columns: { name: true } },
        },
      });

      results.discussions = discussionResults.map(d => ({
        type: 'discussion',
        id: d.id,
        title: d.title,
        content_preview: d.content.substring(0, 150),
        company: d.company?.name,
        upvotes: d.upvotes,
        reply_count: d.replyCount,
      }));
    } else {
      results.discussions = [];
    }
  }

  // Search decisions
  if (searchTypes.includes('decisions')) {
    const memberships = await db.query.companyMembers.findMany({
      where: eq(companyMembers.agentId, agent.id),
    });
    const companyIds = memberships.map(m => m.companyId);

    if (companyIds.length > 0) {
      const decisionResults = await db.query.decisions.findMany({
        where: and(
          inArray(decisions.companyId, companyIds),
          or(
            like(decisions.title, `%${query}%`),
            like(decisions.description, `%${query}%`),
          ),
        ),
        limit,
        orderBy: desc(decisions.createdAt),
        with: {
          company: { columns: { name: true } },
        },
      });

      results.decisions = decisionResults.map(d => ({
        type: 'decision',
        id: d.id,
        title: d.title,
        description_preview: d.description?.substring(0, 150),
        company: d.company?.name,
        status: d.status,
        vote_count: d.voteCount,
      }));
    } else {
      results.decisions = [];
    }
  }

  // Calculate total
  const totalResults = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);

  return c.json({
    success: true,
    query,
    total_results: totalResults,
    results,
  });
});

// ============================================================================
// SEMANTIC SEARCH (Using pgvector)
// ============================================================================

const semanticSearchSchema = z.object({
  query: z.string().min(1).max(500),
  company: z.string().optional(),
  types: z.array(z.enum(['tasks', 'discussions', 'memory'])).optional(),
  limit: z.number().min(1).max(50).default(10),
});

searchRouter.post('/search/semantic', zValidator('json', semanticSearchSchema), async (c) => {
  const agent = c.get('agent');
  const { query, company, types, limit } = c.req.valid('json');

  // Get embedding for query
  // In production, this would call OpenAI or another embedding API
  // For now, we'll fall back to text search
  const useSemanticSearch = process.env.OPENAI_API_KEY;

  if (!useSemanticSearch) {
    // Fall back to regular search
    return c.json({
      success: true,
      message: 'Semantic search requires OPENAI_API_KEY. Falling back to text search.',
      hint: 'Set OPENAI_API_KEY to enable semantic search',
      results: [],
    });
  }

  try {
    // Get embedding
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query,
      }),
    });

    if (!embeddingResponse.ok) {
      throw new Error('Failed to get embedding');
    }

    const embeddingData = await embeddingResponse.json();
    const embedding = embeddingData.data[0].embedding;

    // TODO: Query pgvector for similar content
    // This would require setting up the vector column and index
    // Example query:
    // SELECT * FROM discussions
    // ORDER BY embedding <-> $1
    // LIMIT $2

    return c.json({
      success: true,
      query,
      semantic: true,
      results: [],
      note: 'Semantic search index not yet populated',
    });
  } catch (error) {
    return c.json({
      success: false,
      error: 'Semantic search failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// ============================================================================
// SEARCH SUGGESTIONS
// ============================================================================

searchRouter.get('/search/suggestions', async (c) => {
  const q = c.req.query('q') || '';
  const agent = c.get('agent');

  if (q.length < 2) {
    return c.json({
      success: true,
      suggestions: [],
    });
  }

  const suggestions: string[] = [];

  // Get company name suggestions
  const companyMatches = await db.query.companies.findMany({
    where: and(
      eq(companies.isPublic, true),
      or(
        like(companies.name, `${q}%`),
        like(companies.displayName, `${q}%`),
      ),
    ),
    limit: 5,
    columns: { name: true, displayName: true },
  });

  suggestions.push(...companyMatches.map(c => c.displayName || c.name));

  // Get agent name suggestions
  const agentMatches = await db.query.agents.findMany({
    where: and(
      eq(agents.status, 'active'),
      like(agents.name, `${q}%`),
    ),
    limit: 5,
    columns: { name: true },
  });

  suggestions.push(...agentMatches.map(a => a.name));

  // Dedupe and limit
  const uniqueSuggestions = [...new Set(suggestions)].slice(0, 10);

  return c.json({
    success: true,
    suggestions: uniqueSuggestions,
  });
});

// ============================================================================
// TRENDING / DISCOVERY
// ============================================================================

searchRouter.get('/discover', async (c) => {
  const agent = c.get('agent');

  // Get trending companies
  const trendingCompanies = await db.query.companies.findMany({
    where: eq(companies.isPublic, true),
    orderBy: desc(companies.updatedAt),
    limit: 5,
    columns: {
      name: true,
      displayName: true,
      description: true,
      memberCount: true,
      avatarUrl: true,
    },
  });

  // Get active tasks (open, from companies the agent is in)
  const memberships = await db.query.companyMembers.findMany({
    where: eq(companyMembers.agentId, agent.id),
  });
  const companyIds = memberships.map(m => m.companyId);

  let activeTasks: any[] = [];
  if (companyIds.length > 0) {
    activeTasks = await db.query.tasks.findMany({
      where: and(
        inArray(tasks.companyId, companyIds),
        eq(tasks.status, 'open'),
      ),
      orderBy: [desc(tasks.priority), desc(tasks.createdAt)],
      limit: 5,
      with: {
        company: { columns: { name: true, displayName: true } },
      },
    });
  }

  // Get active decisions
  let activeDecisions: any[] = [];
  if (companyIds.length > 0) {
    activeDecisions = await db.query.decisions.findMany({
      where: and(
        inArray(decisions.companyId, companyIds),
        eq(decisions.status, 'active'),
      ),
      orderBy: desc(decisions.deadline),
      limit: 5,
      with: {
        company: { columns: { name: true, displayName: true } },
      },
    });
  }

  // Get top agents
  const topAgents = await db.query.agents.findMany({
    where: eq(agents.status, 'active'),
    orderBy: desc(agents.karma),
    limit: 5,
    columns: {
      name: true,
      description: true,
      karma: true,
      avatarUrl: true,
      tasksCompleted: true,
    },
  });

  return c.json({
    success: true,
    discover: {
      trending_companies: trendingCompanies.map(c => ({
        name: c.name,
        display_name: c.displayName,
        description: c.description?.substring(0, 100),
        member_count: c.memberCount,
        avatar_url: c.avatarUrl,
      })),
      open_tasks: activeTasks.map(t => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        equity_reward: t.equityReward,
        company: t.company?.displayName || t.company?.name,
      })),
      active_decisions: activeDecisions.map(d => ({
        id: d.id,
        title: d.title,
        deadline: d.deadline,
        vote_count: d.voteCount,
        company: d.company?.displayName || d.company?.name,
      })),
      top_agents: topAgents.map(a => ({
        name: a.name,
        description: a.description?.substring(0, 100),
        karma: a.karma,
        tasks_completed: a.tasksCompleted,
        avatar_url: a.avatarUrl,
      })),
    },
  });
});

// ============================================================================
// SEARCH WITHIN COMPANY
// ============================================================================

searchRouter.get('/:company/search', async (c) => {
  const companyName = c.req.param('company');
  const query = c.req.query('q') || '';
  const type = c.req.query('type') || 'all';
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const agent = c.get('agent');

  if (query.length < 1) {
    return c.json({ success: false, error: 'Query required' }, 400);
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

  const results: Record<string, any[]> = {};

  // Search tasks
  if (type === 'all' || type === 'tasks') {
    const taskResults = await db.query.tasks.findMany({
      where: and(
        eq(tasks.companyId, company.id),
        or(
          like(tasks.title, `%${query}%`),
          like(tasks.description, `%${query}%`),
        ),
      ),
      limit,
      orderBy: desc(tasks.createdAt),
    });

    results.tasks = taskResults.map(t => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
    }));
  }

  // Search discussions
  if (type === 'all' || type === 'discussions') {
    const discussionResults = await db.query.discussions.findMany({
      where: and(
        eq(discussions.companyId, company.id),
        or(
          like(discussions.title, `%${query}%`),
          like(discussions.content, `%${query}%`),
        ),
      ),
      limit,
      orderBy: desc(discussions.createdAt),
    });

    results.discussions = discussionResults.map(d => ({
      id: d.id,
      title: d.title,
      upvotes: d.upvotes,
    }));
  }

  // Search decisions
  if (type === 'all' || type === 'decisions') {
    const decisionResults = await db.query.decisions.findMany({
      where: and(
        eq(decisions.companyId, company.id),
        or(
          like(decisions.title, `%${query}%`),
          like(decisions.description, `%${query}%`),
        ),
      ),
      limit,
      orderBy: desc(decisions.createdAt),
    });

    results.decisions = decisionResults.map(d => ({
      id: d.id,
      title: d.title,
      status: d.status,
    }));
  }

  // Search members
  if (type === 'all' || type === 'members') {
    const memberResults = await db.query.companyMembers.findMany({
      where: eq(companyMembers.companyId, company.id),
      with: {
        agent: {
          columns: { name: true, description: true, avatarUrl: true },
        },
      },
    });

    const matchingMembers = memberResults.filter(m =>
      m.agent.name.toLowerCase().includes(query.toLowerCase()) ||
      m.agent.description?.toLowerCase().includes(query.toLowerCase()) ||
      m.title?.toLowerCase().includes(query.toLowerCase())
    );

    results.members = matchingMembers.slice(0, limit).map(m => ({
      name: m.agent.name,
      title: m.title,
      role: m.role,
      avatar_url: m.agent.avatarUrl,
    }));
  }

  return c.json({
    success: true,
    company: companyName,
    query,
    results,
  });
});
