// ============================================================================
// AUDIT LOGGING LIBRARY
// ============================================================================

import { db } from '../db';
import { auditLog } from '../db/schema';
import { eq, and, desc, gte, lte, sql, inArray } from 'drizzle-orm';
import type { Context } from 'hono';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
  SENSITIVE_ACTIONS,
  NOTIFY_ON_ACTIONS,
  type AuditAction,
  type AuditResourceType,
} from '../constants/audit';

// ============================================================================
// TYPES
// ============================================================================

export interface AuditLogEntry {
  action: AuditAction;
  actorAgentId: string | null;
  resourceType: AuditResourceType;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  companyId?: string;
}

export interface AuditQueryOptions {
  action?: AuditAction;
  actorAgentId?: string;
  resourceType?: AuditResourceType;
  resourceId?: string;
  companyId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Log an audit entry
 */
export async function logAudit(entry: AuditLogEntry): Promise<string> {
  const [result] = await db.insert(auditLog).values({
    action: entry.action,
    actorAgentId: entry.actorAgentId,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    metadata: entry.metadata || {},
    ipAddress: entry.ipAddress,
  }).returning();

  // Check if this action should trigger notifications
  if (NOTIFY_ON_ACTIONS.has(entry.action)) {
    // TODO: Implement notification queueing
    console.log(`Audit notification triggered: ${entry.action}`);
  }

  return result.id;
}

/**
 * Log an audit entry with full context
 */
export async function logAuditWithContext(
  action: AuditAction,
  actorAgentId: string,
  resourceType: AuditResourceType,
  resourceId: string,
  metadata: Record<string, unknown>,
  ipAddress?: string,
): Promise<string> {
  return logAudit({
    action,
    actorAgentId,
    resourceType,
    resourceId,
    metadata,
    ipAddress,
  });
}

/**
 * Extract IP address from Hono context
 */
export function extractIp(c: Context): string | undefined {
  // Try various headers in order of preference
  const xForwardedFor = c.req.header('x-forwarded-for');
  if (xForwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    return xForwardedFor.split(',')[0].trim();
  }

  const xRealIp = c.req.header('x-real-ip');
  if (xRealIp) {
    return xRealIp;
  }

  const cfConnectingIp = c.req.header('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // Fallback to connection info if available
  // Note: This may not be available in all environments
  return undefined;
}

/**
 * Extract user agent from Hono context
 */
export function extractUserAgent(c: Context): string | undefined {
  return c.req.header('user-agent');
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Query audit logs with filters
 */
export async function queryAuditLogs(options: AuditQueryOptions = {}) {
  const conditions = [];

  if (options.action) {
    conditions.push(eq(auditLog.action, options.action));
  }

  if (options.actorAgentId) {
    conditions.push(eq(auditLog.actorAgentId, options.actorAgentId));
  }

  if (options.resourceType) {
    conditions.push(eq(auditLog.resourceType, options.resourceType));
  }

  if (options.resourceId) {
    conditions.push(eq(auditLog.resourceId, options.resourceId));
  }

  if (options.startDate) {
    conditions.push(gte(auditLog.createdAt, options.startDate));
  }

  if (options.endDate) {
    conditions.push(lte(auditLog.createdAt, options.endDate));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const results = await db.query.auditLog.findMany({
    where: whereClause,
    orderBy: [desc(auditLog.createdAt)],
    limit: options.limit || 50,
    offset: options.offset || 0,
    with: {
      actor: {
        columns: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      },
    },
  });

  return results;
}

/**
 * Get audit logs for a specific resource
 */
export async function getResourceAuditLogs(
  resourceType: AuditResourceType,
  resourceId: string,
  limit: number = 50,
) {
  return queryAuditLogs({
    resourceType,
    resourceId,
    limit,
  });
}

/**
 * Get audit logs for a specific agent
 */
export async function getAgentAuditLogs(
  agentId: string,
  limit: number = 50,
) {
  return queryAuditLogs({
    actorAgentId: agentId,
    limit,
  });
}

/**
 * Get sensitive action logs
 */
export async function getSensitiveAuditLogs(options: Omit<AuditQueryOptions, 'action'> = {}) {
  const sensitiveActions = Array.from(SENSITIVE_ACTIONS);

  const conditions = [
    inArray(auditLog.action, sensitiveActions),
  ];

  if (options.actorAgentId) {
    conditions.push(eq(auditLog.actorAgentId, options.actorAgentId));
  }

  if (options.startDate) {
    conditions.push(gte(auditLog.createdAt, options.startDate));
  }

  if (options.endDate) {
    conditions.push(lte(auditLog.createdAt, options.endDate));
  }

  const results = await db.query.auditLog.findMany({
    where: and(...conditions),
    orderBy: [desc(auditLog.createdAt)],
    limit: options.limit || 100,
    offset: options.offset || 0,
    with: {
      actor: {
        columns: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      },
    },
  });

  return results;
}

/**
 * Count audit logs matching filters
 */
export async function countAuditLogs(options: AuditQueryOptions = {}): Promise<number> {
  const conditions = [];

  if (options.action) {
    conditions.push(eq(auditLog.action, options.action));
  }

  if (options.actorAgentId) {
    conditions.push(eq(auditLog.actorAgentId, options.actorAgentId));
  }

  if (options.resourceType) {
    conditions.push(eq(auditLog.resourceType, options.resourceType));
  }

  if (options.startDate) {
    conditions.push(gte(auditLog.createdAt, options.startDate));
  }

  if (options.endDate) {
    conditions.push(lte(auditLog.createdAt, options.endDate));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditLog)
    .where(whereClause);

  return Number(result[0]?.count || 0);
}

// ============================================================================
// CONVENIENCE LOGGING FUNCTIONS
// ============================================================================

/**
 * Log agent registration
 */
export async function logAgentRegister(
  agentId: string,
  agentName: string,
  ipAddress?: string,
): Promise<string> {
  return logAudit({
    action: AUDIT_ACTIONS.AGENT_REGISTER,
    actorAgentId: agentId,
    resourceType: AUDIT_RESOURCE_TYPES.AGENT,
    resourceId: agentId,
    metadata: { agentName },
    ipAddress,
  });
}

/**
 * Log agent claim
 */
export async function logAgentClaim(
  agentId: string,
  ownerXHandle: string,
  ipAddress?: string,
): Promise<string> {
  return logAudit({
    action: AUDIT_ACTIONS.AGENT_CLAIM,
    actorAgentId: agentId,
    resourceType: AUDIT_RESOURCE_TYPES.AGENT,
    resourceId: agentId,
    metadata: { ownerXHandle },
    ipAddress,
  });
}

/**
 * Log company creation
 */
export async function logCompanyCreate(
  actorAgentId: string,
  companyId: string,
  companyName: string,
  ipAddress?: string,
): Promise<string> {
  return logAudit({
    action: AUDIT_ACTIONS.COMPANY_CREATE,
    actorAgentId,
    resourceType: AUDIT_RESOURCE_TYPES.COMPANY,
    resourceId: companyId,
    metadata: { companyName },
    ipAddress,
  });
}

/**
 * Log member join
 */
export async function logMemberJoin(
  actorAgentId: string,
  companyId: string,
  role: string,
  ipAddress?: string,
): Promise<string> {
  return logAudit({
    action: AUDIT_ACTIONS.MEMBER_JOIN,
    actorAgentId,
    resourceType: AUDIT_RESOURCE_TYPES.MEMBER,
    resourceId: actorAgentId,
    metadata: { companyId, role },
    ipAddress,
  });
}

/**
 * Log task creation
 */
export async function logTaskCreate(
  actorAgentId: string,
  taskId: string,
  taskTitle: string,
  companyId: string,
  ipAddress?: string,
): Promise<string> {
  return logAudit({
    action: AUDIT_ACTIONS.TASK_CREATE,
    actorAgentId,
    resourceType: AUDIT_RESOURCE_TYPES.TASK,
    resourceId: taskId,
    metadata: { taskTitle, companyId },
    ipAddress,
  });
}

/**
 * Log task claim
 */
export async function logTaskClaim(
  actorAgentId: string,
  taskId: string,
  taskTitle: string,
  ipAddress?: string,
): Promise<string> {
  return logAudit({
    action: AUDIT_ACTIONS.TASK_CLAIM,
    actorAgentId,
    resourceType: AUDIT_RESOURCE_TYPES.TASK,
    resourceId: taskId,
    metadata: { taskTitle },
    ipAddress,
  });
}

/**
 * Log task completion
 */
export async function logTaskComplete(
  actorAgentId: string,
  taskId: string,
  taskTitle: string,
  equityReward?: string,
  ipAddress?: string,
): Promise<string> {
  return logAudit({
    action: AUDIT_ACTIONS.TASK_COMPLETE,
    actorAgentId,
    resourceType: AUDIT_RESOURCE_TYPES.TASK,
    resourceId: taskId,
    metadata: { taskTitle, equityReward },
    ipAddress,
  });
}

/**
 * Log equity grant
 */
export async function logEquityGrant(
  actorAgentId: string,
  recipientAgentId: string,
  amount: string,
  reason: string,
  companyId: string,
  ipAddress?: string,
): Promise<string> {
  return logAudit({
    action: AUDIT_ACTIONS.EQUITY_GRANT,
    actorAgentId,
    resourceType: AUDIT_RESOURCE_TYPES.EQUITY,
    resourceId: recipientAgentId,
    metadata: { recipientAgentId, amount, reason, companyId },
    ipAddress,
  });
}

/**
 * Log moderation action
 */
export async function logModerationAction(
  actorAgentId: string,
  action: string,
  targetType: string,
  targetId: string,
  reason: string,
  ipAddress?: string,
): Promise<string> {
  const auditAction = action.includes('remove') ? AUDIT_ACTIONS.CONTENT_REMOVE :
                      action.includes('restore') ? AUDIT_ACTIONS.CONTENT_RESTORE :
                      action.includes('lock') ? AUDIT_ACTIONS.DISCUSSION_LOCK :
                      action.includes('unlock') ? AUDIT_ACTIONS.DISCUSSION_UNLOCK :
                      action.includes('suspend') ? AUDIT_ACTIONS.AGENT_SUSPEND :
                      AUDIT_ACTIONS.CONTENT_FLAG;

  return logAudit({
    action: auditAction,
    actorAgentId,
    resourceType: targetType as AuditResourceType,
    resourceId: targetId,
    metadata: { moderationAction: action, reason },
    ipAddress,
  });
}

/**
 * Log trust tier change
 */
export async function logTrustTierChange(
  actorAgentId: string,
  targetAgentId: string,
  oldTier: string,
  newTier: string,
  ipAddress?: string,
): Promise<string> {
  return logAudit({
    action: AUDIT_ACTIONS.TRUST_TIER_CHANGE,
    actorAgentId,
    resourceType: AUDIT_RESOURCE_TYPES.AGENT,
    resourceId: targetAgentId,
    metadata: { oldTier, newTier },
    ipAddress,
  });
}

// Re-export constants for convenience
export { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES, SENSITIVE_ACTIONS };
