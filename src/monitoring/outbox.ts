/**
 * Event Outbox Monitoring
 * Phase 22: Monitor the transactional outbox for WebSocket event publishing
 */

import { db } from '../db/index.js';
import { events } from '../db/schema.js';
import { isNull, asc, desc, count, lt, and, gte, sql } from 'drizzle-orm';

/**
 * Outbox backlog metrics
 */
export interface OutboxBacklog {
  /** Number of unpublished events */
  count: number;
  /** Age of oldest unpublished event in milliseconds */
  oldestAge: number;
  /** Oldest unpublished event timestamp */
  oldestTimestamp: Date | null;
  /** Whether an alert should be triggered */
  alert: boolean;
  /** Alert reason if applicable */
  alertReason: string | null;
  /** Timestamp of this measurement */
  measuredAt: Date;
}

/**
 * Outbox health metrics
 */
export interface OutboxHealth {
  status: 'healthy' | 'degraded' | 'critical';
  backlog: OutboxBacklog;
  publishRate: {
    last1m: number;
    last5m: number;
    last15m: number;
  };
  avgPublishLatency: number; // milliseconds
}

/**
 * Alert thresholds for outbox monitoring
 */
const ALERT_THRESHOLDS = {
  /** Alert if more than 100 unpublished events */
  maxBacklogCount: 100,
  /** Alert if oldest event is more than 60 seconds old */
  maxBacklogAgeMs: 60000,
  /** Critical if more than 500 unpublished events */
  criticalBacklogCount: 500,
  /** Critical if oldest event is more than 5 minutes old */
  criticalBacklogAgeMs: 300000,
};

/**
 * Get the current outbox backlog
 */
export async function getOutboxBacklog(): Promise<OutboxBacklog> {
  try {
    // Get unpublished events ordered by creation time
    const unpublished = await db.query.events.findMany({
      where: isNull(events.wsPublishedAt),
      orderBy: asc(events.createdAt),
      limit: 1, // We only need the oldest for age calculation
    });

    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(events)
      .where(isNull(events.wsPublishedAt));

    const backlogCount = countResult?.count || 0;

    // Calculate oldest age
    const now = Date.now();
    let oldestAge = 0;
    let oldestTimestamp: Date | null = null;

    if (unpublished.length > 0 && unpublished[0].createdAt) {
      oldestTimestamp = unpublished[0].createdAt;
      oldestAge = now - oldestTimestamp.getTime();
    }

    // Determine if alert should be triggered
    let alert = false;
    let alertReason: string | null = null;

    if (backlogCount > ALERT_THRESHOLDS.maxBacklogCount) {
      alert = true;
      alertReason = `Backlog count (${backlogCount}) exceeds threshold (${ALERT_THRESHOLDS.maxBacklogCount})`;
    } else if (oldestAge > ALERT_THRESHOLDS.maxBacklogAgeMs) {
      alert = true;
      alertReason = `Oldest event age (${Math.round(oldestAge / 1000)}s) exceeds threshold (${ALERT_THRESHOLDS.maxBacklogAgeMs / 1000}s)`;
    }

    return {
      count: backlogCount,
      oldestAge,
      oldestTimestamp,
      alert,
      alertReason,
      measuredAt: new Date(),
    };
  } catch (error) {
    console.error('[Outbox Monitoring] Failed to get backlog:', error);
    return {
      count: -1,
      oldestAge: -1,
      oldestTimestamp: null,
      alert: true,
      alertReason: 'Failed to query outbox: ' + (error instanceof Error ? error.message : 'Unknown error'),
      measuredAt: new Date(),
    };
  }
}

/**
 * Get the number of events published in a time window
 */
export async function getPublishRate(windowMs: number): Promise<number> {
  try {
    const since = new Date(Date.now() - windowMs);

    const [result] = await db
      .select({ count: count() })
      .from(events)
      .where(
        and(
          gte(events.wsPublishedAt, since)
        )
      );

    return result?.count || 0;
  } catch (error) {
    console.error('[Outbox Monitoring] Failed to get publish rate:', error);
    return -1;
  }
}

/**
 * Get average publish latency (time from creation to publish)
 */
export async function getAveragePublishLatency(limit = 100): Promise<number> {
  try {
    // Get recent published events with both timestamps
    const recentPublished = await db.query.events.findMany({
      where: sql`${events.wsPublishedAt} IS NOT NULL`,
      orderBy: desc(events.wsPublishedAt),
      limit,
    });

    if (recentPublished.length === 0) {
      return 0;
    }

    // Calculate average latency
    let totalLatency = 0;
    let count = 0;

    for (const event of recentPublished) {
      if (event.createdAt && event.wsPublishedAt) {
        const latency = event.wsPublishedAt.getTime() - event.createdAt.getTime();
        if (latency >= 0) { // Sanity check
          totalLatency += latency;
          count++;
        }
      }
    }

    return count > 0 ? Math.round(totalLatency / count) : 0;
  } catch (error) {
    console.error('[Outbox Monitoring] Failed to get publish latency:', error);
    return -1;
  }
}

/**
 * Get comprehensive outbox health metrics
 */
export async function getOutboxHealth(): Promise<OutboxHealth> {
  const [backlog, rate1m, rate5m, rate15m, avgLatency] = await Promise.all([
    getOutboxBacklog(),
    getPublishRate(60000),       // 1 minute
    getPublishRate(300000),      // 5 minutes
    getPublishRate(900000),      // 15 minutes
    getAveragePublishLatency(),
  ]);

  // Determine health status
  let status: OutboxHealth['status'] = 'healthy';

  if (
    backlog.count >= ALERT_THRESHOLDS.criticalBacklogCount ||
    backlog.oldestAge >= ALERT_THRESHOLDS.criticalBacklogAgeMs
  ) {
    status = 'critical';
  } else if (backlog.alert) {
    status = 'degraded';
  }

  return {
    status,
    backlog,
    publishRate: {
      last1m: rate1m,
      last5m: rate5m,
      last15m: rate15m,
    },
    avgPublishLatency: avgLatency,
  };
}

/**
 * Get stale unpublished events (for manual intervention)
 */
export async function getStaleEvents(thresholdMs = 300000): Promise<Array<{
  id: string;
  type: string;
  createdAt: Date;
  age: number;
}>> {
  try {
    const threshold = new Date(Date.now() - thresholdMs);

    const staleEvents = await db.query.events.findMany({
      where: and(
        isNull(events.wsPublishedAt),
        lt(events.createdAt, threshold)
      ),
      orderBy: asc(events.createdAt),
      limit: 50,
    });

    const now = Date.now();
    return staleEvents.map((event) => ({
      id: event.id,
      type: event.type,
      createdAt: event.createdAt,
      age: now - event.createdAt.getTime(),
    }));
  } catch (error) {
    console.error('[Outbox Monitoring] Failed to get stale events:', error);
    return [];
  }
}

/**
 * Mark stale events as published (cleanup for stuck events)
 */
export async function markStaleAsPublished(eventIds: string[]): Promise<number> {
  if (eventIds.length === 0) {
    return 0;
  }

  try {
    const result = await db
      .update(events)
      .set({ wsPublishedAt: new Date() })
      .where(
        sql`${events.id} IN (${sql.join(eventIds.map(id => sql`${id}`), sql`, `)})`
      );

    console.log(`[Outbox Monitoring] Marked ${eventIds.length} stale events as published`);
    return eventIds.length;
  } catch (error) {
    console.error('[Outbox Monitoring] Failed to mark stale events:', error);
    return 0;
  }
}

/**
 * Check if outbox is healthy
 */
export async function isOutboxHealthy(): Promise<{
  healthy: boolean;
  issues: string[];
}> {
  const health = await getOutboxHealth();
  const issues: string[] = [];

  if (health.status === 'critical') {
    issues.push('Outbox is in critical state');
  }

  if (health.backlog.alertReason) {
    issues.push(health.backlog.alertReason);
  }

  if (health.avgPublishLatency > 5000) {
    issues.push(`High publish latency: ${health.avgPublishLatency}ms`);
  }

  if (health.publishRate.last1m === 0 && health.backlog.count > 0) {
    issues.push('No events published in last minute despite backlog');
  }

  return {
    healthy: health.status === 'healthy',
    issues,
  };
}

/**
 * Get outbox statistics summary
 */
export async function getOutboxStats(): Promise<{
  backlogCount: number;
  publishedLast24h: number;
  avgLatencyMs: number;
  healthStatus: string;
}> {
  const [backlog, published24h, avgLatency] = await Promise.all([
    getOutboxBacklog(),
    getPublishRate(86400000), // 24 hours
    getAveragePublishLatency(),
  ]);

  let healthStatus = 'healthy';
  if (backlog.count >= ALERT_THRESHOLDS.criticalBacklogCount) {
    healthStatus = 'critical';
  } else if (backlog.alert) {
    healthStatus = 'degraded';
  }

  return {
    backlogCount: backlog.count,
    publishedLast24h: published24h,
    avgLatencyMs: avgLatency,
    healthStatus,
  };
}

export default {
  getOutboxBacklog,
  getPublishRate,
  getAveragePublishLatency,
  getOutboxHealth,
  getStaleEvents,
  markStaleAsPublished,
  isOutboxHealthy,
  getOutboxStats,
};
