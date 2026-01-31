/**
 * Health Check API
 * Phase 22: Comprehensive health monitoring endpoints
 */

import { Hono } from 'hono';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';
import { redis, isRedisHealthy } from '../lib/redis.js';
import {
  areQueuesHealthy,
  getAllQueueMetrics,
  isOutboxHealthy,
  getOutboxStats,
  isRateLimitHealthy,
  getRateLimitStats,
} from '../monitoring/index.js';

const healthRouter = new Hono();

/**
 * Health check result structure
 */
interface HealthCheck {
  name: string;
  healthy: boolean;
  latency?: number;
  message?: string;
  details?: Record<string, unknown>;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: Record<string, HealthCheck>;
}

// Track server start time for uptime
const startTime = Date.now();

/**
 * Check PostgreSQL connection
 */
async function checkPostgres(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return {
      name: 'postgres',
      healthy: true,
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'postgres',
      healthy: false,
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check Redis connection
 */
async function checkRedis(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const healthy = await isRedisHealthy();
    if (healthy) {
      return {
        name: 'redis',
        healthy: true,
        latency: Date.now() - start,
      };
    }
    return {
      name: 'redis',
      healthy: false,
      latency: Date.now() - start,
      message: 'Redis ping failed',
    };
  } catch (error) {
    return {
      name: 'redis',
      healthy: false,
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check queue health
 */
async function checkQueues(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const { healthy, issues } = await areQueuesHealthy();
    return {
      name: 'queues',
      healthy,
      latency: Date.now() - start,
      message: issues.length > 0 ? issues.join('; ') : undefined,
    };
  } catch (error) {
    return {
      name: 'queues',
      healthy: false,
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check outbox health
 */
async function checkOutbox(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const { healthy, issues } = await isOutboxHealthy();
    return {
      name: 'outbox',
      healthy,
      latency: Date.now() - start,
      message: issues.length > 0 ? issues.join('; ') : undefined,
    };
  } catch (error) {
    return {
      name: 'outbox',
      healthy: false,
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check rate limiting health
 */
async function checkRateLimits(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const { healthy, issues } = await isRateLimitHealthy();
    return {
      name: 'rate_limits',
      healthy,
      latency: Date.now() - start,
      message: issues.length > 0 ? issues.join('; ') : undefined,
    };
  } catch (error) {
    return {
      name: 'rate_limits',
      healthy: false,
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Run all health checks
 */
async function runHealthChecks(): Promise<HealthStatus> {
  const [postgres, redisCheck, queues, outbox, rateLimits] = await Promise.all([
    checkPostgres(),
    checkRedis(),
    checkQueues(),
    checkOutbox(),
    checkRateLimits(),
  ]);

  const checks = {
    postgres,
    redis: redisCheck,
    queues,
    outbox,
    rate_limits: rateLimits,
  };

  // Determine overall status
  const allHealthy = Object.values(checks).every((c) => c.healthy);
  const anyUnhealthy = Object.values(checks).some((c) => !c.healthy);

  // Critical services (postgres, redis) determine unhealthy state
  const criticalUnhealthy = !postgres.healthy || !redisCheck.healthy;

  let status: HealthStatus['status'] = 'healthy';
  if (criticalUnhealthy) {
    status = 'unhealthy';
  } else if (anyUnhealthy) {
    status = 'degraded';
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks,
  };
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * Simple liveness probe
 * Returns 200 if server is running
 */
healthRouter.get('/live', (c) => {
  return c.json({ status: 'ok' }, 200);
});

/**
 * Readiness probe
 * Returns 200 if all critical services are healthy
 */
healthRouter.get('/ready', async (c) => {
  try {
    const postgres = await checkPostgres();
    const redisCheck = await checkRedis();

    if (postgres.healthy && redisCheck.healthy) {
      return c.json({ status: 'ready' }, 200);
    }

    return c.json({
      status: 'not_ready',
      checks: { postgres, redis: redisCheck },
    }, 503);
  } catch (error) {
    return c.json({
      status: 'not_ready',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 503);
  }
});

/**
 * Comprehensive health check
 * Returns detailed status of all system components
 */
healthRouter.get('/', async (c) => {
  try {
    const health = await runHealthChecks();
    const statusCode = health.status === 'healthy' ? 200
      : health.status === 'degraded' ? 200
      : 503;

    return c.json(health, statusCode);
  } catch (error) {
    return c.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 503);
  }
});

/**
 * Detailed queue metrics
 */
healthRouter.get('/queues', async (c) => {
  try {
    const metrics = await getAllQueueMetrics();
    return c.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * Detailed outbox metrics
 */
healthRouter.get('/outbox', async (c) => {
  try {
    const stats = await getOutboxStats();
    return c.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * Detailed rate limit metrics
 */
healthRouter.get('/rate-limits', async (c) => {
  try {
    const stats = await getRateLimitStats();
    return c.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * Metrics endpoint (Prometheus format)
 */
healthRouter.get('/metrics', async (c) => {
  try {
    const health = await runHealthChecks();
    const queueMetrics = await getAllQueueMetrics();
    const outboxStats = await getOutboxStats();
    const rateLimitStats = await getRateLimitStats();

    // Build Prometheus metrics
    const lines: string[] = [];

    // Health status (1 = healthy, 0.5 = degraded, 0 = unhealthy)
    const healthValue = health.status === 'healthy' ? 1
      : health.status === 'degraded' ? 0.5
      : 0;
    lines.push(`# HELP molt_health_status Overall system health (1=healthy, 0.5=degraded, 0=unhealthy)`);
    lines.push(`# TYPE molt_health_status gauge`);
    lines.push(`molt_health_status ${healthValue}`);

    // Uptime
    lines.push(`# HELP molt_uptime_seconds Server uptime in seconds`);
    lines.push(`# TYPE molt_uptime_seconds counter`);
    lines.push(`molt_uptime_seconds ${health.uptime}`);

    // Component health
    lines.push(`# HELP molt_component_health Component health status (1=healthy, 0=unhealthy)`);
    lines.push(`# TYPE molt_component_health gauge`);
    for (const [name, check] of Object.entries(health.checks)) {
      lines.push(`molt_component_health{component="${name}"} ${check.healthy ? 1 : 0}`);
    }

    // Component latency
    lines.push(`# HELP molt_component_latency_ms Component check latency in milliseconds`);
    lines.push(`# TYPE molt_component_latency_ms gauge`);
    for (const [name, check] of Object.entries(health.checks)) {
      if (check.latency !== undefined) {
        lines.push(`molt_component_latency_ms{component="${name}"} ${check.latency}`);
      }
    }

    // Queue metrics
    lines.push(`# HELP molt_queue_jobs Queue job counts by status`);
    lines.push(`# TYPE molt_queue_jobs gauge`);
    for (const [name, metrics] of Object.entries(queueMetrics.queues)) {
      lines.push(`molt_queue_jobs{queue="${name}",status="waiting"} ${metrics.waiting}`);
      lines.push(`molt_queue_jobs{queue="${name}",status="active"} ${metrics.active}`);
      lines.push(`molt_queue_jobs{queue="${name}",status="completed"} ${metrics.completed}`);
      lines.push(`molt_queue_jobs{queue="${name}",status="failed"} ${metrics.failed}`);
      lines.push(`molt_queue_jobs{queue="${name}",status="delayed"} ${metrics.delayed}`);
    }

    // Outbox metrics
    lines.push(`# HELP molt_outbox_backlog Number of unpublished events`);
    lines.push(`# TYPE molt_outbox_backlog gauge`);
    lines.push(`molt_outbox_backlog ${outboxStats.backlogCount}`);

    lines.push(`# HELP molt_outbox_latency_ms Average publish latency in milliseconds`);
    lines.push(`# TYPE molt_outbox_latency_ms gauge`);
    lines.push(`molt_outbox_latency_ms ${outboxStats.avgLatencyMs}`);

    // Rate limit metrics
    lines.push(`# HELP molt_rate_limit_agents_at_limit Number of agents at rate limit`);
    lines.push(`# TYPE molt_rate_limit_agents_at_limit gauge`);
    lines.push(`molt_rate_limit_agents_at_limit ${rateLimitStats.stats.agentsAtLimit}`);

    lines.push(`# HELP molt_rate_limit_429s_today Total 429 responses today`);
    lines.push(`# TYPE molt_rate_limit_429s_today counter`);
    lines.push(`molt_rate_limit_429s_today ${rateLimitStats.stats.total429sToday}`);

    return c.text(lines.join('\n'), 200, {
      'Content-Type': 'text/plain; version=0.0.4',
    });
  } catch (error) {
    return c.text(`# Error generating metrics: ${error}`, 500);
  }
});

export { healthRouter };
export default healthRouter;
