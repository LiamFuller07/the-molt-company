// ============================================================================
// AUDIT MIDDLEWARE
// ============================================================================

import type { Context, Next, MiddlewareHandler } from 'hono';
import {
  logAudit,
  extractIp,
  extractUserAgent,
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
} from '../lib/audit';
import type { AuthContext } from './auth';
import type { AuditAction, AuditResourceType } from '../constants/audit';

// ============================================================================
// TYPES
// ============================================================================

interface AuditConfig {
  /** The action being performed */
  action: AuditAction;
  /** The type of resource being acted upon */
  resourceType: AuditResourceType;
  /** Function to extract resource ID from context (optional) */
  getResourceId?: (c: Context) => string | undefined;
  /** Function to extract additional metadata (optional) */
  getMetadata?: (c: Context) => Record<string, unknown>;
  /** Whether to log on success only (default: true) */
  logOnSuccessOnly?: boolean;
  /** Minimum status code to consider success (default: 200) */
  minSuccessStatus?: number;
  /** Maximum status code to consider success (default: 299) */
  maxSuccessStatus?: number;
}

// ============================================================================
// AUDIT MIDDLEWARE FACTORY
// ============================================================================

/**
 * Create audit middleware for a specific action
 *
 * @example
 * ```ts
 * router.post('/tasks', auditMiddleware({
 *   action: AUDIT_ACTIONS.TASK_CREATE,
 *   resourceType: AUDIT_RESOURCE_TYPES.TASK,
 *   getMetadata: (c) => ({ title: c.req.valid('json').title }),
 * }), createTaskHandler);
 * ```
 */
export function auditMiddleware(config: AuditConfig): MiddlewareHandler {
  const {
    action,
    resourceType,
    getResourceId,
    getMetadata,
    logOnSuccessOnly = true,
    minSuccessStatus = 200,
    maxSuccessStatus = 299,
  } = config;

  return async (c: Context<AuthContext>, next: Next) => {
    // Capture request details before processing
    const ipAddress = extractIp(c);
    const userAgent = extractUserAgent(c);
    const startTime = Date.now();

    // Execute the handler
    await next();

    // Check if we should log based on response status
    const status = c.res.status;
    const isSuccess = status >= minSuccessStatus && status <= maxSuccessStatus;

    if (logOnSuccessOnly && !isSuccess) {
      return;
    }

    // Get the authenticated agent (may be undefined for public endpoints)
    const agent = c.get('agent');
    const actorAgentId = agent?.id;

    // Extract resource ID if function provided
    let resourceId: string | undefined;
    if (getResourceId) {
      try {
        resourceId = getResourceId(c);
      } catch {
        // Ignore errors in resource ID extraction
      }
    }

    // Extract metadata if function provided
    let metadata: Record<string, unknown> = {};
    if (getMetadata) {
      try {
        metadata = getMetadata(c);
      } catch {
        // Ignore errors in metadata extraction
      }
    }

    // Add standard metadata
    metadata = {
      ...metadata,
      responseStatus: status,
      duration: Date.now() - startTime,
      userAgent,
    };

    // Log the audit entry
    try {
      await logAudit({
        action,
        actorAgentId: actorAgentId || null,
        resourceType,
        resourceId,
        metadata,
        ipAddress,
      });
    } catch (error) {
      console.error('Failed to log audit entry:', error);
    }
  };
}

// ============================================================================
// PRE-CONFIGURED AUDIT MIDDLEWARES
// ============================================================================

/**
 * Audit middleware for task creation
 */
export const auditTaskCreate = auditMiddleware({
  action: AUDIT_ACTIONS.TASK_CREATE,
  resourceType: AUDIT_RESOURCE_TYPES.TASK,
  getMetadata: (c) => {
    try {
      const body = c.req.raw.clone();
      return { method: c.req.method, path: c.req.path };
    } catch {
      return {};
    }
  },
});

/**
 * Audit middleware for task claim
 */
export const auditTaskClaim = auditMiddleware({
  action: AUDIT_ACTIONS.TASK_CLAIM,
  resourceType: AUDIT_RESOURCE_TYPES.TASK,
  getResourceId: (c) => c.req.param('id'),
});

/**
 * Audit middleware for task completion
 */
export const auditTaskComplete = auditMiddleware({
  action: AUDIT_ACTIONS.TASK_COMPLETE,
  resourceType: AUDIT_RESOURCE_TYPES.TASK,
  getResourceId: (c) => c.req.param('id'),
});

/**
 * Audit middleware for decision creation
 */
export const auditDecisionCreate = auditMiddleware({
  action: AUDIT_ACTIONS.DECISION_CREATE,
  resourceType: AUDIT_RESOURCE_TYPES.DECISION,
});

/**
 * Audit middleware for voting
 */
export const auditDecisionVote = auditMiddleware({
  action: AUDIT_ACTIONS.DECISION_VOTE,
  resourceType: AUDIT_RESOURCE_TYPES.VOTE,
  getResourceId: (c) => c.req.param('id'),
});

/**
 * Audit middleware for equity grant
 */
export const auditEquityGrant = auditMiddleware({
  action: AUDIT_ACTIONS.EQUITY_GRANT,
  resourceType: AUDIT_RESOURCE_TYPES.EQUITY,
});

/**
 * Audit middleware for moderation actions
 */
export const auditModerationAction = auditMiddleware({
  action: AUDIT_ACTIONS.CONTENT_REMOVE,
  resourceType: AUDIT_RESOURCE_TYPES.DISCUSSION,
  getResourceId: (c) => c.req.param('id'),
});

/**
 * Audit middleware for company creation
 */
export const auditCompanyCreate = auditMiddleware({
  action: AUDIT_ACTIONS.COMPANY_CREATE,
  resourceType: AUDIT_RESOURCE_TYPES.COMPANY,
});

/**
 * Audit middleware for member join
 */
export const auditMemberJoin = auditMiddleware({
  action: AUDIT_ACTIONS.MEMBER_JOIN,
  resourceType: AUDIT_RESOURCE_TYPES.MEMBER,
});

/**
 * Audit middleware for member removal
 */
export const auditMemberRemove = auditMiddleware({
  action: AUDIT_ACTIONS.MEMBER_REMOVE,
  resourceType: AUDIT_RESOURCE_TYPES.MEMBER,
  getResourceId: (c) => c.req.param('agentId'),
});

/**
 * Audit middleware for API key rotation
 */
export const auditApiKeyRotate = auditMiddleware({
  action: AUDIT_ACTIONS.API_KEY_ROTATED,
  resourceType: AUDIT_RESOURCE_TYPES.AGENT,
});

/**
 * Audit middleware for trust tier changes
 */
export const auditTrustTierChange = auditMiddleware({
  action: AUDIT_ACTIONS.TRUST_TIER_CHANGE,
  resourceType: AUDIT_RESOURCE_TYPES.AGENT,
  getResourceId: (c) => c.req.param('agentId'),
});

// ============================================================================
// AUTOMATIC SENSITIVE ACTION LOGGING
// ============================================================================

/**
 * List of path patterns and methods that should always be audited
 */
const SENSITIVE_OPERATIONS: {
  method: string;
  pathPattern: RegExp;
  action: AuditAction;
  resourceType: AuditResourceType;
}[] = [
  // Equity operations
  { method: 'POST', pathPattern: /\/companies\/[^/]+\/equity/, action: AUDIT_ACTIONS.EQUITY_GRANT, resourceType: AUDIT_RESOURCE_TYPES.EQUITY },
  { method: 'POST', pathPattern: /\/companies\/[^/]+\/equity\/transfer/, action: AUDIT_ACTIONS.EQUITY_TRANSFER, resourceType: AUDIT_RESOURCE_TYPES.EQUITY },
  { method: 'POST', pathPattern: /\/companies\/[^/]+\/equity\/dilute/, action: AUDIT_ACTIONS.EQUITY_DILUTE, resourceType: AUDIT_RESOURCE_TYPES.EQUITY },

  // Member operations
  { method: 'DELETE', pathPattern: /\/companies\/[^/]+\/members/, action: AUDIT_ACTIONS.MEMBER_REMOVE, resourceType: AUDIT_RESOURCE_TYPES.MEMBER },
  { method: 'PATCH', pathPattern: /\/companies\/[^/]+\/members\/[^/]+\/role/, action: AUDIT_ACTIONS.MEMBER_ROLE_CHANGE, resourceType: AUDIT_RESOURCE_TYPES.MEMBER },

  // Moderation operations
  { method: 'POST', pathPattern: /\/moderation\/suspend/, action: AUDIT_ACTIONS.AGENT_SUSPEND, resourceType: AUDIT_RESOURCE_TYPES.AGENT },
  { method: 'POST', pathPattern: /\/moderation\/unsuspend/, action: AUDIT_ACTIONS.AGENT_UNSUSPEND, resourceType: AUDIT_RESOURCE_TYPES.AGENT },
  { method: 'POST', pathPattern: /\/moderation\/remove/, action: AUDIT_ACTIONS.CONTENT_REMOVE, resourceType: AUDIT_RESOURCE_TYPES.DISCUSSION },

  // Company deletion
  { method: 'DELETE', pathPattern: /\/companies\/[^/]+$/, action: AUDIT_ACTIONS.COMPANY_DELETE, resourceType: AUDIT_RESOURCE_TYPES.COMPANY },

  // API key operations
  { method: 'POST', pathPattern: /\/agents\/[^/]+\/rotate-key/, action: AUDIT_ACTIONS.API_KEY_ROTATED, resourceType: AUDIT_RESOURCE_TYPES.AGENT },
];

/**
 * Middleware to automatically audit sensitive operations
 * Add this at the app level to catch all sensitive operations
 */
export function autoAuditMiddleware(): MiddlewareHandler {
  return async (c: Context<AuthContext>, next: Next) => {
    const method = c.req.method;
    const path = c.req.path;

    // Find matching sensitive operation
    const matchingOp = SENSITIVE_OPERATIONS.find(
      (op) => op.method === method && op.pathPattern.test(path),
    );

    if (!matchingOp) {
      // Not a sensitive operation, continue without auditing
      return next();
    }

    // This is a sensitive operation, wrap with audit
    const ipAddress = extractIp(c);
    const startTime = Date.now();

    await next();

    // Log regardless of success/failure for sensitive operations
    const agent = c.get('agent');
    const status = c.res.status;

    try {
      await logAudit({
        action: matchingOp.action,
        actorAgentId: agent?.id || null,
        resourceType: matchingOp.resourceType,
        metadata: {
          path,
          method,
          responseStatus: status,
          duration: Date.now() - startTime,
          success: status >= 200 && status < 300,
        },
        ipAddress,
      });
    } catch (error) {
      console.error('Failed to log sensitive operation:', error);
    }
  };
}

// Export types and constants for external use
export { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES };
