/**
 * Rate Limit Monitoring
 * Phase 22: Monitor rate limiting across agents and endpoints
 */

import { redis } from '../lib/redis.js';
import { db } from '../db/index.js';
import { agents } from '../db/schema.js';
import { desc, gte, lt, and } from 'drizzle-orm';

/**
 * Rate limit statistics for an agent
 */
export interface AgentRateLimitStats {
  agentId: string;
  agentName: string;
  dailyWritesUsed: number;
  dailyWritesLimit: number;
  utilizationPercent: number;
  nearLimit: boolean; // Over 80% utilized
  atLimit: boolean;   // At 100% or exceeded
}

/**
 * System-wide rate limit overview
 */
export interface RateLimitOverview {
  /** Agents near or at their rate limits */
  topTalkers: AgentRateLimitStats[];
  /** Agents that have been rate limited (429s) in the time window */
  recentlyLimited: Array<{
    agentId: string;
    agentName: string;
    limitedCount: number;
    lastLimitedAt: Date;
  }>;
  /** Count of 429 responses by time bucket */
  rateLimitsByHour: Array<{
    hour: string;
    count: number;
  }>;
  /** Overall statistics */
  stats: {
    totalAgents: number;
    agentsNearLimit: number;
    agentsAtLimit: number;
    total429sToday: number;
  };
  timestamp: Date;
}

/**
 * Redis keys for rate limit tracking
 */
const REDIS_KEYS = {
  /** Track 429 responses: rate_limit:429:{agentId}:{timestamp} */
  rate429: (agentId: string) => `rate_limit:429:${agentId}`,
  /** Track hourly 429 counts: rate_limit:hourly:429:{hour} */
  hourly429: (hour: string) => `rate_limit:hourly:429:${hour}`,
  /** Track agent limit events: rate_limit:events:{agentId} */
  events: (agentId: string) => `rate_limit:events:${agentId}`,
};

/**
 * Get rate limit stats for all agents
 */
export async function getAgentRateLimitStats(): Promise<AgentRateLimitStats[]> {
  try {
    const allAgents = await db.query.agents.findMany({
      columns: {
        id: true,
        name: true,
        dailyWritesUsed: true,
        dailyWritesLimit: true,
      },
      orderBy: desc(agents.dailyWritesUsed),
    });

    return allAgents.map((agent) => {
      const utilizationPercent = agent.dailyWritesLimit > 0
        ? Math.round((agent.dailyWritesUsed / agent.dailyWritesLimit) * 100)
        : 0;

      return {
        agentId: agent.id,
        agentName: agent.name,
        dailyWritesUsed: agent.dailyWritesUsed,
        dailyWritesLimit: agent.dailyWritesLimit,
        utilizationPercent,
        nearLimit: utilizationPercent >= 80,
        atLimit: utilizationPercent >= 100,
      };
    });
  } catch (error) {
    console.error('[Rate Limit Monitoring] Failed to get agent stats:', error);
    return [];
  }
}

/**
 * Get top talkers (agents using most of their rate limit)
 */
export async function getTopTalkers(limit = 10): Promise<AgentRateLimitStats[]> {
  const allStats = await getAgentRateLimitStats();

  return allStats
    .filter((stat) => stat.dailyWritesUsed > 0)
    .sort((a, b) => b.utilizationPercent - a.utilizationPercent)
    .slice(0, limit);
}

/**
 * Get agents near or at their rate limit
 */
export async function getAgentsNearLimit(threshold = 80): Promise<AgentRateLimitStats[]> {
  const allStats = await getAgentRateLimitStats();

  return allStats.filter((stat) => stat.utilizationPercent >= threshold);
}

/**
 * Record a 429 rate limit event
 */
export async function recordRateLimitEvent(agentId: string): Promise<void> {
  try {
    const now = new Date();
    const hourKey = now.toISOString().substring(0, 13); // YYYY-MM-DDTHH

    // Increment agent-specific counter
    await redis.incr(REDIS_KEYS.rate429(agentId));
    await redis.expire(REDIS_KEYS.rate429(agentId), 86400); // 24 hour TTL

    // Increment hourly counter
    await redis.incr(REDIS_KEYS.hourly429(hourKey));
    await redis.expire(REDIS_KEYS.hourly429(hourKey), 172800); // 48 hour TTL

    // Record event with timestamp
    await redis.zadd(REDIS_KEYS.events(agentId), now.getTime(), now.toISOString());
    await redis.zremrangebyscore(REDIS_KEYS.events(agentId), '-inf', now.getTime() - 86400000);

    console.log(`[Rate Limit] Recorded 429 for agent: ${agentId}`);
  } catch (error) {
    console.error('[Rate Limit Monitoring] Failed to record event:', error);
  }
}

/**
 * Get 429 count for an agent today
 */
export async function getAgent429Count(agentId: string): Promise<number> {
  try {
    const count = await redis.get(REDIS_KEYS.rate429(agentId));
    return count ? parseInt(count, 10) : 0;
  } catch (error) {
    console.error('[Rate Limit Monitoring] Failed to get 429 count:', error);
    return 0;
  }
}

/**
 * Get recently rate-limited agents
 */
export async function getRecentlyLimitedAgents(limit = 10): Promise<Array<{
  agentId: string;
  agentName: string;
  limitedCount: number;
  lastLimitedAt: Date;
}>> {
  try {
    // Get all agents
    const allAgents = await db.query.agents.findMany({
      columns: {
        id: true,
        name: true,
      },
    });

    const results: Array<{
      agentId: string;
      agentName: string;
      limitedCount: number;
      lastLimitedAt: Date;
    }> = [];

    for (const agent of allAgents) {
      const count = await getAgent429Count(agent.id);
      if (count > 0) {
        // Get last limited timestamp
        const events = await redis.zrevrange(REDIS_KEYS.events(agent.id), 0, 0);
        const lastLimitedAt = events[0] ? new Date(events[0]) : new Date();

        results.push({
          agentId: agent.id,
          agentName: agent.name,
          limitedCount: count,
          lastLimitedAt,
        });
      }
    }

    return results
      .sort((a, b) => b.limitedCount - a.limitedCount)
      .slice(0, limit);
  } catch (error) {
    console.error('[Rate Limit Monitoring] Failed to get limited agents:', error);
    return [];
  }
}

/**
 * Get 429 counts by hour (last 24 hours)
 */
export async function getRateLimitsByHour(): Promise<Array<{
  hour: string;
  count: number;
}>> {
  try {
    const results: Array<{ hour: string; count: number }> = [];
    const now = new Date();

    for (let i = 0; i < 24; i++) {
      const hour = new Date(now.getTime() - i * 3600000);
      const hourKey = hour.toISOString().substring(0, 13);
      const count = await redis.get(REDIS_KEYS.hourly429(hourKey));

      results.push({
        hour: hourKey,
        count: count ? parseInt(count, 10) : 0,
      });
    }

    return results.reverse();
  } catch (error) {
    console.error('[Rate Limit Monitoring] Failed to get hourly stats:', error);
    return [];
  }
}

/**
 * Get total 429 count today
 */
export async function getTotal429sToday(): Promise<number> {
  const hourlyStats = await getRateLimitsByHour();
  const now = new Date();
  const todayPrefix = now.toISOString().substring(0, 10);

  return hourlyStats
    .filter((stat) => stat.hour.startsWith(todayPrefix))
    .reduce((sum, stat) => sum + stat.count, 0);
}

/**
 * Get comprehensive rate limit overview
 */
export async function getRateLimitStats(): Promise<RateLimitOverview> {
  const [
    topTalkers,
    recentlyLimited,
    rateLimitsByHour,
    agentStats,
    total429sToday,
  ] = await Promise.all([
    getTopTalkers(10),
    getRecentlyLimitedAgents(10),
    getRateLimitsByHour(),
    getAgentRateLimitStats(),
    getTotal429sToday(),
  ]);

  return {
    topTalkers,
    recentlyLimited,
    rateLimitsByHour,
    stats: {
      totalAgents: agentStats.length,
      agentsNearLimit: agentStats.filter((s) => s.nearLimit).length,
      agentsAtLimit: agentStats.filter((s) => s.atLimit).length,
      total429sToday,
    },
    timestamp: new Date(),
  };
}

/**
 * Check if rate limiting is healthy
 */
export async function isRateLimitHealthy(): Promise<{
  healthy: boolean;
  issues: string[];
}> {
  const stats = await getRateLimitStats();
  const issues: string[] = [];

  // Check for too many agents at limit
  if (stats.stats.agentsAtLimit > 5) {
    issues.push(`${stats.stats.agentsAtLimit} agents at rate limit`);
  }

  // Check for high 429 rate
  if (stats.stats.total429sToday > 100) {
    issues.push(`High 429 count today: ${stats.stats.total429sToday}`);
  }

  // Check for burst of recent 429s
  const lastHour = stats.rateLimitsByHour[stats.rateLimitsByHour.length - 1];
  if (lastHour && lastHour.count > 50) {
    issues.push(`High 429s in last hour: ${lastHour.count}`);
  }

  return {
    healthy: issues.length === 0,
    issues,
  };
}

/**
 * Reset rate limit counters for an agent
 */
export async function resetAgentRateLimit(agentId: string): Promise<boolean> {
  try {
    await db
      .update(agents)
      .set({
        dailyWritesUsed: 0,
        lastRateReset: new Date(),
      })
      .where(and(
        gte(agents.id, agentId),
        lt(agents.id, agentId + '\uffff')
      ));

    // Clear Redis counters
    await redis.del(REDIS_KEYS.rate429(agentId));
    await redis.del(REDIS_KEYS.events(agentId));

    console.log(`[Rate Limit] Reset rate limit for agent: ${agentId}`);
    return true;
  } catch (error) {
    console.error('[Rate Limit Monitoring] Failed to reset rate limit:', error);
    return false;
  }
}

/**
 * Get rate limit summary for a specific agent
 */
export async function getAgentRateLimitSummary(agentId: string): Promise<{
  dailyWritesUsed: number;
  dailyWritesLimit: number;
  utilizationPercent: number;
  recentLimitedCount: number;
  nearLimit: boolean;
  atLimit: boolean;
} | null> {
  try {
    const agent = await db.query.agents.findFirst({
      where: (agents, { eq }) => eq(agents.id, agentId),
      columns: {
        dailyWritesUsed: true,
        dailyWritesLimit: true,
      },
    });

    if (!agent) {
      return null;
    }

    const recentLimitedCount = await getAgent429Count(agentId);
    const utilizationPercent = agent.dailyWritesLimit > 0
      ? Math.round((agent.dailyWritesUsed / agent.dailyWritesLimit) * 100)
      : 0;

    return {
      dailyWritesUsed: agent.dailyWritesUsed,
      dailyWritesLimit: agent.dailyWritesLimit,
      utilizationPercent,
      recentLimitedCount,
      nearLimit: utilizationPercent >= 80,
      atLimit: utilizationPercent >= 100,
    };
  } catch (error) {
    console.error('[Rate Limit Monitoring] Failed to get agent summary:', error);
    return null;
  }
}

export default {
  getAgentRateLimitStats,
  getTopTalkers,
  getAgentsNearLimit,
  recordRateLimitEvent,
  getAgent429Count,
  getRecentlyLimitedAgents,
  getRateLimitsByHour,
  getTotal429sToday,
  getRateLimitStats,
  isRateLimitHealthy,
  resetAgentRateLimit,
  getAgentRateLimitSummary,
};
