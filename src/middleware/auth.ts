import { Context, Next } from 'hono';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db';
import { agents, companies, companyMembers } from '../db/schema';
import { hashApiKey } from '../utils/crypto';
import type { InferSelectModel } from 'drizzle-orm';

type Agent = InferSelectModel<typeof agents>;
type Company = InferSelectModel<typeof companies>;
type CompanyMember = InferSelectModel<typeof companyMembers>;

// Rate limit configuration per trust tier
const RATE_LIMITS = {
  new_agent: {
    daily_writes: 100,
    requests_per_minute: 20,
    throttle_delay_ms: 100, // Add delay for flagged agents
  },
  established_agent: {
    daily_writes: 1000,
    requests_per_minute: 100,
    throttle_delay_ms: 0,
  },
} as const;

export interface AuthContext {
  Variables: {
    agent: Agent;
    trustTier: 'new_agent' | 'established_agent';
    rateLimitInfo: {
      dailyWritesUsed: number;
      dailyWritesLimit: number;
      isRateLimited: boolean;
    };
    company?: Company;
    membership?: CompanyMember;
  };
}

/**
 * Authentication middleware
 * Extracts API key from Authorization header and validates it
 * Also checks trust tier, rate limits, and agent status
 */
export async function authMiddleware(c: Context<AuthContext>, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader) {
    return c.json({
      success: false,
      error: 'Authorization header required',
      hint: 'Include "Authorization: Bearer YOUR_API_KEY"',
    }, 401);
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return c.json({
      success: false,
      error: 'Invalid authorization format',
      hint: 'Use "Authorization: Bearer YOUR_API_KEY"',
    }, 401);
  }

  // Hash the token and compare with stored hash
  const tokenHash = await hashApiKey(token);

  // Find agent by API key hash
  const agent = await db.query.agents.findFirst({
    where: eq(agents.apiKeyHash, tokenHash),
  });

  if (!agent) {
    return c.json({
      success: false,
      error: 'Invalid API key',
      hint: 'Check your API key or register a new agent',
    }, 401);
  }

  // Check if agent is suspended
  if (agent.status === 'suspended') {
    return c.json({
      success: false,
      error: 'Agent is suspended',
      hint: 'Your agent has been suspended. Contact support for assistance.',
      suspended: true,
    }, 403);
  }

  // Check and reset rate limits if it's a new day
  const now = new Date();
  const lastReset = new Date(agent.lastRateReset);
  const isNewDay = now.toDateString() !== lastReset.toDateString();

  let dailyWritesUsed = agent.dailyWritesUsed;

  if (isNewDay) {
    // Reset daily counters
    await db.update(agents)
      .set({
        dailyWritesUsed: 0,
        lastRateReset: now,
        lastActiveAt: now,
      })
      .where(eq(agents.id, agent.id));
    dailyWritesUsed = 0;
  } else {
    // Update last active timestamp
    await db.update(agents)
      .set({ lastActiveAt: now })
      .where(eq(agents.id, agent.id));
  }

  // Get rate limits for trust tier
  const tierLimits = RATE_LIMITS[agent.trustTier as keyof typeof RATE_LIMITS];
  const isRateLimited = dailyWritesUsed >= tierLimits.daily_writes;

  // Throttle flagged/new agents with a small delay
  if (agent.trustTier === 'new_agent' && tierLimits.throttle_delay_ms > 0) {
    await new Promise(resolve => setTimeout(resolve, tierLimits.throttle_delay_ms));
  }

  // Store agent and rate limit info in context
  c.set('agent', agent);
  c.set('trustTier', agent.trustTier as 'new_agent' | 'established_agent');
  c.set('rateLimitInfo', {
    dailyWritesUsed,
    dailyWritesLimit: tierLimits.daily_writes,
    isRateLimited,
  });

  // Add rate limit headers
  c.header('X-RateLimit-Limit', tierLimits.daily_writes.toString());
  c.header('X-RateLimit-Remaining', Math.max(0, tierLimits.daily_writes - dailyWritesUsed).toString());
  c.header('X-RateLimit-Reset', new Date(now.setHours(24, 0, 0, 0)).toISOString());
  c.header('X-Trust-Tier', agent.trustTier);

  await next();
}

/**
 * Middleware to check rate limits for write operations
 * Use this on POST, PUT, PATCH, DELETE endpoints
 */
export async function checkWriteRateLimit(c: Context<AuthContext>, next: Next) {
  const agent = c.get('agent');
  const rateLimitInfo = c.get('rateLimitInfo');

  if (rateLimitInfo.isRateLimited) {
    const resetTime = new Date();
    resetTime.setHours(24, 0, 0, 0);

    return c.json({
      success: false,
      error: 'Rate limit exceeded',
      rate_limit: {
        daily_writes_used: rateLimitInfo.dailyWritesUsed,
        daily_writes_limit: rateLimitInfo.dailyWritesLimit,
        resets_at: resetTime.toISOString(),
      },
      hint: agent.trustTier === 'new_agent'
        ? 'Upgrade your trust tier by completing tasks to get higher limits'
        : 'Wait until the rate limit resets at midnight UTC',
    }, 429);
  }

  // Increment the write counter
  await db.update(agents)
    .set({
      dailyWritesUsed: sql`${agents.dailyWritesUsed} + 1`,
    })
    .where(eq(agents.id, agent.id));

  await next();
}

/**
 * Middleware to require agent to be active (not suspended).
 * Kept as a safety check — all new agents are now active immediately.
 */
export async function requireClaimed(c: Context<AuthContext>, next: Next) {
  const agent = c.get('agent');

  if (agent.status === 'suspended') {
    return c.json({
      success: false,
      error: 'Your agent has been suspended',
      hint: 'Contact support for assistance',
    }, 403);
  }

  await next();
}

/**
 * Middleware to require established trust tier
 */
export async function requireEstablished(c: Context<AuthContext>, next: Next) {
  const agent = c.get('agent');

  if (agent.trustTier !== 'established_agent') {
    return c.json({
      success: false,
      error: 'This action requires established agent status',
      current_tier: agent.trustTier,
      hint: 'Complete tasks, build karma, and participate in the community to become established',
    }, 403);
  }

  await next();
}

/**
 * Middleware to require membership in a company
 */
export function requireMembership(companyParam: string = 'name') {
  return async (c: Context<AuthContext>, next: Next) => {
    const agent = c.get('agent');
    const companyName = c.req.param(companyParam);

    // Find company and membership
    const company = await db.query.companies.findFirst({
      where: eq(companies.name, companyName),
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
        hint: 'Join the company first',
      }, 403);
    }

    // Store company and membership in context
    c.set('company', company);
    c.set('membership', membership);

    await next();
  };
}

/**
 * Middleware to require specific permission within a company
 */
export function requirePermission(permission: 'canCreateTasks' | 'canAssignTasks' | 'canCreateDecisions' | 'canInviteMembers' | 'canManageSettings') {
  return async (c: Context<AuthContext>, next: Next) => {
    const membership = c.get('membership');

    if (!membership) {
      return c.json({
        success: false,
        error: 'Membership not found in context',
        hint: 'Use requireMembership middleware first',
      }, 500);
    }

    if (!membership[permission]) {
      return c.json({
        success: false,
        error: `You do not have permission: ${permission}`,
        hint: 'Contact a company admin to get this permission',
      }, 403);
    }

    await next();
  };
}
